use crate::{
    backup_inventory::InventoryFile,
    backup_staging::{self, StagedBackup},
    data_protection::{protect_machine, unprotect_machine},
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

const DEFAULT_MAX_BYTES: u64 = 5 * 1024 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingServiceBackup {
    pub id: String,
    pub source_path: PathBuf,
    pub container_path: PathBuf,
    pub content_hash: String,
    pub plain_size_bytes: u64,
    pub source_modified_unix_seconds: u64,
}

#[derive(Debug, Clone)]
pub struct ServiceBackupQueue {
    directory: PathBuf,
    containers: PathBuf,
    max_bytes: u64,
    stage_lock: Arc<Mutex<()>>,
}

impl ServiceBackupQueue {
    pub fn new(directory: PathBuf) -> Result<Self, String> {
        Self::with_limit(directory, DEFAULT_MAX_BYTES)
    }

    fn with_limit(directory: PathBuf, max_bytes: u64) -> Result<Self, String> {
        let containers = directory.join("containers");
        fs::create_dir_all(&containers).map_err(|error| error.to_string())?;
        Ok(Self {
            directory,
            containers,
            max_bytes,
            stage_lock: Arc::new(Mutex::new(())),
        })
    }

    pub fn stage(&self, source: &Path) -> Result<PendingServiceBackup, String> {
        let _guard = self.stage_lock.lock().map_err(|error| error.to_string())?;
        let metadata = fs::metadata(source).map_err(|error| error.to_string())?;
        let modified = metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_secs());
        if let Some((_, existing)) = self.find(source, metadata.len(), modified)? {
            return Ok(existing);
        }
        let staged = backup_staging::stage_file_machine(source, &self.containers)?;
        let item = self.from_staged(source, staged);
        let serialized = serde_json::to_vec(&item).map_err(|error| error.to_string())?;
        let pending = self.directory.join(format!("{}.pending", item.id));
        let completed = self.directory.join(format!("{}.job", item.id));
        fs::write(&pending, protect_machine(&serialized)?).map_err(|error| error.to_string())?;
        fs::rename(pending, &completed).map_err(|error| error.to_string())?;
        self.trim()?;
        Ok(item)
    }

    pub fn pending(&self) -> Result<Vec<(PathBuf, PendingServiceBackup)>, String> {
        let mut paths = fs::read_dir(&self.directory)
            .map_err(|error| error.to_string())?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("job"))
            .collect::<Vec<_>>();
        paths.sort();
        paths
            .into_iter()
            .map(|path| {
                let serialized =
                    unprotect_machine(&fs::read(&path).map_err(|error| error.to_string())?)?;
                let item =
                    serde_json::from_slice(&serialized).map_err(|error| error.to_string())?;
                Ok((path, item))
            })
            .collect()
    }

    pub fn pending_count(&self) -> Result<usize, String> {
        Ok(fs::read_dir(&self.directory)
            .map_err(|error| error.to_string())?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("job"))
            .count())
    }

    pub fn inventory_files(&self) -> Result<Vec<InventoryFile>, String> {
        Ok(self
            .pending()?
            .into_iter()
            .map(|(_, item)| InventoryFile {
                path: item.source_path,
                size_bytes: item.plain_size_bytes,
                modified_unix_seconds: Some(item.source_modified_unix_seconds),
            })
            .collect())
    }

    pub fn find(
        &self,
        source: &Path,
        size: u64,
        modified: Option<u64>,
    ) -> Result<Option<(PathBuf, PendingServiceBackup)>, String> {
        Ok(self.pending()?.into_iter().rev().find(|(_, item)| {
            item.source_path == source
                && item.plain_size_bytes == size
                && modified.is_none_or(|value| value == item.source_modified_unix_seconds)
        }))
    }

    pub fn complete(&self, job_path: &Path, container_path: &Path) -> Result<(), String> {
        self.validate_job(job_path)?;
        if container_path.parent() != Some(self.containers.as_path()) {
            return Err("Invalid service backup container".into());
        }
        fs::remove_file(job_path).map_err(|error| error.to_string())?;
        fs::remove_file(container_path).map_err(|error| error.to_string())
    }

    fn from_staged(&self, source: &Path, staged: StagedBackup) -> PendingServiceBackup {
        PendingServiceBackup {
            id: format!("{:020}-{}", now_nanos(), &staged.content_hash[..12]),
            source_path: source.to_path_buf(),
            container_path: staged.container_path,
            content_hash: staged.content_hash,
            plain_size_bytes: staged.plain_size_bytes,
            source_modified_unix_seconds: staged.source_modified_unix_seconds,
        }
    }

    fn validate_job(&self, path: &Path) -> Result<(), String> {
        if path.parent() != Some(self.directory.as_path())
            || path.extension().and_then(|value| value.to_str()) != Some("job")
        {
            return Err("Invalid service backup job".into());
        }
        Ok(())
    }

    fn trim(&self) -> Result<(), String> {
        let pending = self.pending()?;
        let mut total = pending
            .iter()
            .map(|(_, item)| {
                fs::metadata(&item.container_path)
                    .map(|value| value.len())
                    .unwrap_or(0)
            })
            .sum::<u64>();
        for (job, item) in pending {
            if total <= self.max_bytes {
                break;
            }
            let size = fs::metadata(&item.container_path)
                .map(|value| value.len())
                .unwrap_or(0);
            let _ = fs::remove_file(&job);
            let _ = fs::remove_file(&item.container_path);
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
    fn service_backup_is_encrypted_discoverable_and_removed_after_upload() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("plan.txt");
        fs::write(&source, b"version captured by service").unwrap();
        let queue = ServiceBackupQueue::new(directory.path().join("queue")).unwrap();
        let item = queue.stage(&source).unwrap();
        let (job, found) = queue
            .find(
                &source,
                item.plain_size_bytes,
                Some(item.source_modified_unix_seconds),
            )
            .unwrap()
            .unwrap();
        assert_eq!(found.content_hash, item.content_hash);
        assert!(!String::from_utf8_lossy(&fs::read(&job).unwrap()).contains("plan.txt"));
        fs::remove_file(&source).unwrap();
        let restored = directory.path().join("restored.txt");
        backup_staging::restore_file(&found.container_path, &restored).unwrap();
        assert_eq!(fs::read(restored).unwrap(), b"version captured by service");
        queue.complete(&job, &found.container_path).unwrap();
        assert!(queue.pending().unwrap().is_empty());
    }

    #[test]
    fn queue_rejects_completion_outside_its_directories() {
        let directory = tempfile::tempdir().unwrap();
        let queue = ServiceBackupQueue::new(directory.path().join("queue")).unwrap();
        assert!(queue.complete(directory.path(), directory.path()).is_err());
    }

    #[test]
    fn concurrent_identical_staging_creates_only_one_job() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("same.txt");
        fs::write(&source, b"same stable version").unwrap();
        let queue = ServiceBackupQueue::new(directory.path().join("queue")).unwrap();
        let first_queue = queue.clone();
        let first_source = source.clone();
        let first = std::thread::spawn(move || first_queue.stage(&first_source).unwrap());
        let second_queue = queue.clone();
        let second_source = source.clone();
        let second = std::thread::spawn(move || second_queue.stage(&second_source).unwrap());
        assert_eq!(
            first.join().unwrap().content_hash,
            second.join().unwrap().content_hash
        );
        assert_eq!(queue.pending().unwrap().len(), 1);
    }

    #[test]
    fn pending_count_reports_jobs_without_decrypting_every_container() {
        let directory = tempfile::tempdir().unwrap();
        let queue = ServiceBackupQueue::new(directory.path().join("queue")).unwrap();
        let source = directory.path().join("approved.txt");
        fs::write(&source, b"approved backup").unwrap();

        assert_eq!(queue.pending_count().unwrap(), 0);
        queue.stage(&source).unwrap();
        assert_eq!(queue.pending_count().unwrap(), 1);
    }
}
