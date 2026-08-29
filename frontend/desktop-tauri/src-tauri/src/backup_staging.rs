use crate::data_protection::protect;
#[cfg(test)]
use crate::data_protection::unprotect;
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

pub fn stage_file(source: &Path, staging_directory: &Path) -> Result<PathBuf, String> {
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
    result.map(|_| completed_path)
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

#[cfg(test)]
fn restore_file(container: &Path, destination: &Path) -> Result<(), String> {
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
            staged.extension().and_then(|value| value.to_str()),
            Some("backup")
        );
        assert!(!fs::read(&staged)
            .unwrap()
            .windows(32)
            .any(|window| window == &plaintext[..32]));
        restore_file(&staged, &restored).unwrap();
        assert_eq!(fs::read(restored).unwrap(), plaintext);
    }

    #[test]
    fn rejects_invalid_backup_container() {
        let directory = tempfile::tempdir().unwrap();
        let container = directory.path().join("invalid.backup");
        fs::write(&container, b"not-a-container").unwrap();

        assert!(restore_file(&container, &directory.path().join("restored")).is_err());
    }
}
