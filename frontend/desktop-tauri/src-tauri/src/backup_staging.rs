use crate::data_protection::{protect, unprotect};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

const MAGIC: &[u8; 8] = b"SMBACK01";
const CHUNK_BYTES: usize = 1024 * 1024;
static NEXT_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StagedBackup {
    pub container_path: PathBuf,
    pub content_hash: String,
    pub plain_size_bytes: u64,
    pub source_modified_unix_seconds: u64,
}

pub fn stage_file(source: &Path, staging_directory: &Path) -> Result<StagedBackup, String> {
    let metadata = fs::metadata(source).map_err(|error| error.to_string())?;
    let content_hash = sha256_file(source)?;
    fs::create_dir_all(staging_directory).map_err(|error| error.to_string())?;
    let id = format!(
        "{:020}-{:06}",
        now_nanos(),
        NEXT_ID.fetch_add(1, Ordering::Relaxed)
    );
    let pending_path = staging_directory.join(format!("{id}.pending"));
    let completed_path = staging_directory.join(format!("{id}.backup"));

    let result = write_encrypted_container(source, &pending_path).and_then(|_| {
        fs::rename(&pending_path, &completed_path).map_err(|error| error.to_string())
    });
    if result.is_err() {
        let _ = fs::remove_file(&pending_path);
    }
    result.map(|_| StagedBackup {
        container_path: completed_path,
        content_hash,
        plain_size_bytes: metadata.len(),
        source_modified_unix_seconds: metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_secs())
            .unwrap_or_default(),
    })
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; CHUNK_BYTES];
    loop {
        let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn write_encrypted_container(source: &Path, destination: &Path) -> Result<(), String> {
    let mut input = File::open(source).map_err(|error| error.to_string())?;
    let mut output = File::create(destination).map_err(|error| error.to_string())?;
    output.write_all(MAGIC).map_err(|error| error.to_string())?;

    let mut buffer = vec![0_u8; CHUNK_BYTES];
    loop {
        let read = input.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        let encrypted = protect(&buffer[..read])?;
        let length = u32::try_from(encrypted.len()).map_err(|_| "Encrypted chunk is too large")?;
        output
            .write_all(&length.to_le_bytes())
            .and_then(|_| output.write_all(&encrypted))
            .map_err(|error| error.to_string())?;
    }
    output.sync_all().map_err(|error| error.to_string())
}

pub fn restore_file(container: &Path, destination: &Path) -> Result<(), String> {
    let mut input = File::open(container).map_err(|error| error.to_string())?;
    let mut magic = [0_u8; MAGIC.len()];
    input
        .read_exact(&mut magic)
        .map_err(|error| error.to_string())?;
    if &magic != MAGIC {
        return Err("Invalid backup container".into());
    }

    let mut output = File::create(destination).map_err(|error| error.to_string())?;
    loop {
        let mut length_bytes = [0_u8; 4];
        match input.read_exact(&mut length_bytes) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(error) => return Err(error.to_string()),
        }
        let length = u32::from_le_bytes(length_bytes) as usize;
        let mut encrypted = vec![0_u8; length];
        input
            .read_exact(&mut encrypted)
            .map_err(|error| error.to_string())?;
        output
            .write_all(&unprotect(&encrypted)?)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn safe_restore_path(original: &Path, suffix: u64) -> PathBuf {
    let stem = original
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("restored");
    let extension = original.extension().and_then(|value| value.to_str());
    let name = match extension {
        Some(extension) => format!("{stem}.restored-{suffix}.{extension}"),
        None => format!("{stem}.restored-{suffix}"),
    };
    original.with_file_name(name)
}

fn now_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stages_multiple_chunks_without_plaintext_and_restores_exactly() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("source.bin");
        let restored = directory.path().join("restored.bin");
        let plaintext = vec![0x5a; CHUNK_BYTES + 123];
        fs::write(&source, &plaintext).unwrap();

        let staged = stage_file(&source, &directory.path().join("staging")).unwrap();

        assert_eq!(
            staged
                .container_path
                .extension()
                .and_then(|value| value.to_str()),
            Some("backup")
        );
        assert!(!fs::read(&staged.container_path)
            .unwrap()
            .windows(32)
            .any(|window| window == &plaintext[..32]));
        restore_file(&staged.container_path, &restored).unwrap();
        assert_eq!(fs::read(restored).unwrap(), plaintext);
        assert_eq!(staged.content_hash.len(), 64);
        assert_eq!(staged.plain_size_bytes, (CHUNK_BYTES + 123) as u64);
    }

    #[test]
    fn rejects_invalid_backup_container() {
        let directory = tempfile::tempdir().unwrap();
        let container = directory.path().join("invalid.backup");
        fs::write(&container, b"not-a-container").unwrap();

        assert!(restore_file(&container, &directory.path().join("restored")).is_err());
    }

    #[test]
    fn restore_path_never_overwrites_the_original() {
        assert_eq!(
            safe_restore_path(Path::new(r"C:\Work\file.txt"), 42),
            PathBuf::from(r"C:\Work\file.restored-42.txt")
        );
        assert_ne!(
            safe_restore_path(Path::new(r"C:\Work\file.txt"), 42),
            PathBuf::from(r"C:\Work\file.txt")
        );
    }
}
