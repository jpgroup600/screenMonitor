use crate::data_protection::{protect_machine, unprotect_machine};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

const DEFAULT_MAX_BYTES: u64 = 256 * 1024 * 1024;
static NEXT_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceEvent {
    pub id: String,
    pub event_type: String,
    pub source: String,
    pub details: String,
    pub occurred_at_unix_ms: u64,
}

impl ServiceEvent {
    pub fn new(event_type: impl Into<String>, source: impl Into<String>, details: String) -> Self {
        let occurred_at_unix_ms = now_millis();
        Self {
            id: format!(
                "{occurred_at_unix_ms:020}-{:06}",
                NEXT_ID.fetch_add(1, Ordering::Relaxed)
            ),
            event_type: event_type.into(),
            source: source.into(),
            details,
            occurred_at_unix_ms,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ServiceSpool {
    directory: PathBuf,
    max_bytes: u64,
}

impl ServiceSpool {
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

    pub fn enqueue(&self, event: &ServiceEvent) -> Result<PathBuf, String> {
        let serialized = serde_json::to_vec(event).map_err(|error| error.to_string())?;
        let protected = protect_machine(&serialized)?;
        let pending = self.directory.join(format!("{}.pending", event.id));
        let completed = self.directory.join(format!("{}.event", event.id));
        fs::write(&pending, protected).map_err(|error| error.to_string())?;
        fs::rename(&pending, &completed).map_err(|error| error.to_string())?;
        self.trim()?;
        Ok(completed)
    }

    pub fn pending(&self) -> Result<Vec<PathBuf>, String> {
        let mut files = fs::read_dir(&self.directory)
            .map_err(|error| error.to_string())?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("event"))
            .collect::<Vec<_>>();
        files.sort();
        Ok(files)
    }

    pub fn read(&self, path: &Path) -> Result<ServiceEvent, String> {
        self.validate_member(path)?;
        let protected = fs::read(path).map_err(|error| error.to_string())?;
        let serialized = unprotect_machine(&protected)?;
        serde_json::from_slice(&serialized).map_err(|error| error.to_string())
    }

    pub fn complete(&self, path: &Path) -> Result<(), String> {
        self.validate_member(path)?;
        fs::remove_file(path).map_err(|error| error.to_string())
    }

    fn validate_member(&self, path: &Path) -> Result<(), String> {
        if path.parent() != Some(self.directory.as_path())
            || path.extension().and_then(|value| value.to_str()) != Some("event")
        {
            return Err("Invalid service spool path".to_owned());
        }
        Ok(())
    }

    fn trim(&self) -> Result<(), String> {
        let files = self.pending()?;
        let mut total = files.iter().try_fold(0_u64, |sum, path| {
            fs::metadata(path)
                .map(|metadata| sum.saturating_add(metadata.len()))
                .map_err(|error| error.to_string())
        })?;
        for path in files {
            if total <= self.max_bytes {
                break;
            }
            let size = fs::metadata(&path).map(|value| value.len()).unwrap_or(0);
            fs::remove_file(path).map_err(|error| error.to_string())?;
            total = total.saturating_sub(size);
        }
        Ok(())
    }
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn machine_encrypted_event_survives_until_explicit_completion() {
        let directory = tempfile::tempdir().unwrap();
        let spool = ServiceSpool::new(directory.path().to_path_buf()).unwrap();
        let event = ServiceEvent::new("FILE_MODIFIED", r"C:\Work\plan.txt", "{}".into());
        let path = spool.enqueue(&event).unwrap();

        assert_ne!(
            fs::read(&path).unwrap(),
            serde_json::to_vec(&event).unwrap()
        );
        assert_eq!(spool.read(&path).unwrap(), event);
        assert_eq!(spool.pending().unwrap(), vec![path.clone()]);
        spool.complete(&path).unwrap();
        assert!(spool.pending().unwrap().is_empty());
    }

    #[test]
    fn rejects_paths_outside_the_spool() {
        let directory = tempfile::tempdir().unwrap();
        let outside = tempfile::NamedTempFile::new().unwrap();
        let spool = ServiceSpool::new(directory.path().to_path_buf()).unwrap();
        assert!(spool.read(outside.path()).is_err());
        assert!(spool.complete(outside.path()).is_err());
    }

    #[test]
    fn bounded_spool_removes_oldest_events() {
        let directory = tempfile::tempdir().unwrap();
        let spool = ServiceSpool::with_limit(directory.path().to_path_buf(), 1).unwrap();
        spool
            .enqueue(&ServiceEvent::new("FILE_CREATED", "a.txt", "{}".into()))
            .unwrap();
        assert!(spool.pending().unwrap().is_empty());
    }
}
