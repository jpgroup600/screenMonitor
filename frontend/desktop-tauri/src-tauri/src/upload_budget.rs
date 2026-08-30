use crate::data_protection::{protect, unprotect};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
struct DailyUsage {
    day: u64,
    uploaded_bytes: u64,
}

#[derive(Debug, Clone)]
pub struct UploadBudget { path: PathBuf }

impl UploadBudget {
    pub fn new(path: PathBuf) -> Self { Self { path } }

    pub fn allows(&self, bytes: u64, limit: u64, now: SystemTime) -> Result<bool, String> {
        let usage = self.load_for(day(now))?;
        Ok(usage.uploaded_bytes.saturating_add(bytes) <= limit)
    }

    pub fn record(&self, bytes: u64, now: SystemTime) -> Result<(), String> {
        let current_day = day(now);
        let mut usage = self.load_for(current_day)?;
        usage.uploaded_bytes = usage.uploaded_bytes.saturating_add(bytes);
        self.save(&usage)
    }

    fn load_for(&self, current_day: u64) -> Result<DailyUsage, String> {
        if !self.path.exists() { return Ok(DailyUsage { day: current_day, uploaded_bytes: 0 }); }
        let protected = fs::read(&self.path).map_err(|error| error.to_string())?;
        let serialized = unprotect(&protected)?;
        let usage: DailyUsage = serde_json::from_slice(&serialized).map_err(|error| error.to_string())?;
        Ok(if usage.day == current_day { usage } else { DailyUsage { day: current_day, uploaded_bytes: 0 } })
    }

    fn save(&self, usage: &DailyUsage) -> Result<(), String> {
        if let Some(parent) = self.path.parent() { fs::create_dir_all(parent).map_err(|error| error.to_string())?; }
        let protected = protect(&serde_json::to_vec(usage).map_err(|error| error.to_string())?)?;
        let pending = self.path.with_extension("pending");
        fs::write(&pending, protected).map_err(|error| error.to_string())?;
        if self.path.exists() { fs::remove_file(&self.path).map_err(|error| error.to_string())?; }
        fs::rename(pending, &self.path).map_err(|error| error.to_string())
    }
}

fn day(now: SystemTime) -> u64 {
    now.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() / 86_400
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn encrypted_daily_budget_blocks_over_limit_and_resets_next_day() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("usage.dat");
        let budget = UploadBudget::new(path.clone());
        let now = UNIX_EPOCH + Duration::from_secs(100 * 86_400);
        assert!(budget.allows(60, 100, now).unwrap());
        budget.record(60, now).unwrap();
        assert!(!budget.allows(41, 100, now).unwrap());
        assert!(budget.allows(100, 100, now + Duration::from_secs(86_400)).unwrap());
        assert!(!String::from_utf8_lossy(&fs::read(path).unwrap()).contains("uploaded_bytes"));
    }
}
