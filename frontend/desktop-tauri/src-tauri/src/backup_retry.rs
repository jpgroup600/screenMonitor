use crate::data_protection::{protect, unprotect};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static NEXT_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PendingBackup {
    pub device_id: String,
    pub source_path: PathBuf,
    pub container_path: PathBuf,
    pub content_hash: String,
    pub plain_size_bytes: u64,
    pub source_modified_unix_seconds: u64,
}

pub struct BackupRetryQueue {
    directory: PathBuf,
}

impl BackupRetryQueue {
    pub fn new(directory: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        Ok(Self { directory })
    }

    pub fn enqueue(&self, pending: &PendingBackup) -> Result<PathBuf, String> {
        let bytes = serde_json::to_vec(pending).map_err(|error| error.to_string())?;
        let path = self.directory.join(format!(
            "{:020}-{:06}.retry",
            now_nanos(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed)
        ));
        fs::write(&path, protect(&bytes)?).map_err(|error| error.to_string())?;
        Ok(path)
    }

    pub fn pending(&self) -> Result<Vec<(PathBuf, PendingBackup)>, String> {
        let mut paths = fs::read_dir(&self.directory)
            .map_err(|error| error.to_string())?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("retry"))
            .collect::<Vec<_>>();
        paths.sort();
        paths
            .into_iter()
            .map(|path| {
                let bytes = fs::read(&path).map_err(|error| error.to_string())?;
                let value = serde_json::from_slice(&unprotect(&bytes)?)
                    .map_err(|error| error.to_string())?;
                Ok((path, value))
            })
            .collect()
    }

    pub fn complete(&self, job_path: &Path, container_path: &Path) -> Result<(), String> {
        if container_path.exists() {
            fs::remove_file(container_path).map_err(|error| error.to_string())?;
        }
        fs::remove_file(job_path).map_err(|error| error.to_string())
    }
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
    fn retry_job_is_encrypted_and_removed_with_container_after_success() {
        let directory = tempfile::tempdir().unwrap();
        let queue = BackupRetryQueue::new(directory.path().join("jobs")).unwrap();
        let container = directory.path().join("file.backup");
        fs::write(&container, b"encrypted").unwrap();
        let pending = PendingBackup {
            device_id: "device-1".into(),
            source_path: r"C:\Work\file.txt".into(),
            container_path: container.clone(),
            content_hash: "a".repeat(64),
            plain_size_bytes: 10,
            source_modified_unix_seconds: 1,
        };

        let job = queue.enqueue(&pending).unwrap();
        assert_ne!(
            fs::read(&job).unwrap(),
            serde_json::to_vec(&pending).unwrap()
        );
        assert_eq!(queue.pending().unwrap()[0].1, pending);
        queue.complete(&job, &container).unwrap();
        assert!(queue.pending().unwrap().is_empty());
        assert!(!container.exists());
    }
}
