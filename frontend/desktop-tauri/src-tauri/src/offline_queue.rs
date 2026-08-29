use crate::data_protection::{protect, unprotect};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static NEXT_ID: AtomicU64 = AtomicU64::new(0);
const DEFAULT_MAX_BYTES: u64 = 512 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum QueuedRequest {
    AppEvent { kind: String, app_name: String },
    AttendanceIdle { event: String },
    Screenshot { bytes: Vec<u8> },
}

#[derive(Debug, Clone)]
pub struct OfflineQueue {
    directory: PathBuf,
    max_bytes: u64,
}

impl OfflineQueue {
    pub fn new(directory: PathBuf) -> Result<Self, String> {
        Self::with_limit(directory, DEFAULT_MAX_BYTES)
    }

    fn with_limit(directory: PathBuf, max_bytes: u64) -> Result<Self, String> {
        fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        Ok(Self {
            directory,
            max_bytes,
        })
    }

    pub fn enqueue(&self, request: &QueuedRequest) -> Result<PathBuf, String> {
        let serialized = serde_json::to_vec(request).map_err(|error| error.to_string())?;
        let protected = protect(&serialized)?;
        let path = self.directory.join(format!(
            "{:020}-{:06}.queue",
            now_nanos(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed)
        ));
        fs::write(&path, protected).map_err(|error| error.to_string())?;
        self.trim()?;
        Ok(path)
    }

    pub fn pending(&self) -> Result<Vec<PathBuf>, String> {
        let mut files = fs::read_dir(&self.directory)
            .map_err(|error| error.to_string())?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("queue"))
            .collect::<Vec<_>>();
        files.sort();
        Ok(files)
    }

    pub fn read(&self, path: &Path) -> Result<QueuedRequest, String> {
        let protected = fs::read(path).map_err(|error| error.to_string())?;
        let serialized = unprotect(&protected)?;
        serde_json::from_slice(&serialized).map_err(|error| error.to_string())
    }

    pub fn remove(&self, path: &Path) -> Result<(), String> {
        fs::remove_file(path).map_err(|error| error.to_string())
    }

    fn trim(&self) -> Result<(), String> {
        let files = self.pending()?;
        let mut total = files.iter().try_fold(0_u64, |sum, path| {
            fs::metadata(path)
                .map(|metadata| sum + metadata.len())
                .map_err(|error| error.to_string())
        })?;
        for path in files {
            if total <= self.max_bytes {
                break;
            }
            let size = fs::metadata(&path)
                .map(|metadata| metadata.len())
                .unwrap_or(0);
            fs::remove_file(path).map_err(|error| error.to_string())?;
            total = total.saturating_sub(size);
        }
        Ok(())
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
    fn encrypted_queue_round_trips_and_deletes_only_after_success() {
        let directory = tempfile::tempdir().unwrap();
        let queue = OfflineQueue::new(directory.path().to_path_buf()).unwrap();
        let request = QueuedRequest::AppEvent {
            kind: "start".into(),
            app_name: "Code.exe".into(),
        };

        let path = queue.enqueue(&request).unwrap();
        assert_ne!(
            fs::read(&path).unwrap(),
            serde_json::to_vec(&request).unwrap()
        );
        assert_eq!(queue.read(&path).unwrap(), request);
        assert_eq!(queue.pending().unwrap(), vec![path.clone()]);

        queue.remove(&path).unwrap();
        assert!(queue.pending().unwrap().is_empty());
    }

    #[test]
    fn queue_discards_oldest_items_when_size_limit_is_exceeded() {
        let directory = tempfile::tempdir().unwrap();
        let queue = OfflineQueue::with_limit(directory.path().to_path_buf(), 1).unwrap();
        queue
            .enqueue(&QueuedRequest::AttendanceIdle {
                event: "start".into(),
            })
            .unwrap();
        assert!(queue.pending().unwrap().is_empty());
    }
}
