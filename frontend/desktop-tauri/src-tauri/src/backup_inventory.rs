use crate::backup_policy::BackupPolicy;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, UNIX_EPOCH},
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryFile {
    pub path: PathBuf,
    pub size_bytes: u64,
    pub modified_unix_seconds: Option<u64>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryResult {
    pub files: Vec<InventoryFile>,
    pub skipped_entries: u64,
    pub inaccessible_entries: u64,
}

pub fn scan(root: &Path, policy: &BackupPolicy) -> InventoryResult {
    scan_throttled(root, policy, Duration::ZERO)
}

pub fn scan_throttled(
    root: &Path,
    policy: &BackupPolicy,
    delay_per_entry: Duration,
) -> InventoryResult {
    let mut result = InventoryResult::default();
    scan_directory(root, policy, delay_per_entry, &mut result);
    result
        .files
        .sort_by(|left, right| left.path.cmp(&right.path));
    result
}

fn scan_directory(
    directory: &Path,
    policy: &BackupPolicy,
    delay_per_entry: Duration,
    result: &mut InventoryResult,
) {
    if !policy.should_include(directory, None) {
        result.skipped_entries += 1;
        return;
    }

    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) => {
            result.inaccessible_entries += 1;
            return;
        }
    };

    for entry in entries {
        if !delay_per_entry.is_zero() {
            std::thread::sleep(delay_per_entry);
        }
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                result.inaccessible_entries += 1;
                continue;
            }
        };
        let path = entry.path();
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => {
                result.inaccessible_entries += 1;
                continue;
            }
        };

        if metadata.file_type().is_symlink() {
            result.skipped_entries += 1;
            continue;
        }

        if metadata.is_dir() {
            scan_directory(&path, policy, delay_per_entry, result);
            continue;
        }

        if !metadata.is_file() || !policy.should_include(&path, Some(metadata.len())) {
            result.skipped_entries += 1;
            continue;
        }

        result.files.push(InventoryFile {
            path,
            size_bytes: metadata.len(),
            modified_unix_seconds: metadata
                .modified()
                .ok()
                .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                .map(|value| value.as_secs()),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inventory_collects_business_files_and_skips_excluded_directories() {
        let directory = tempfile::Builder::new()
            .prefix("inventory-test-")
            .tempdir_in(".")
            .unwrap();
        fs::create_dir_all(directory.path().join("Documents")).unwrap();
        fs::create_dir_all(directory.path().join("Windows/System32")).unwrap();
        fs::write(directory.path().join("Documents/report.txt"), b"report").unwrap();
        fs::write(
            directory.path().join("Windows/System32/system.dll"),
            b"system",
        )
        .unwrap();

        let result = scan(directory.path(), &BackupPolicy::default());

        assert_eq!(result.files.len(), 1);
        assert!(result.files[0].path.ends_with("report.txt"));
        assert_eq!(result.files[0].size_bytes, 6);
        assert_eq!(result.skipped_entries, 1);
    }

    #[cfg(windows)]
    #[test]
    fn inventory_does_not_follow_directory_links() {
        use std::os::windows::fs::symlink_dir;

        let directory = tempfile::Builder::new()
            .prefix("inventory-link-test-")
            .tempdir_in(".")
            .unwrap();
        let outside = tempfile::Builder::new()
            .prefix("inventory-outside-test-")
            .tempdir_in(".")
            .unwrap();
        fs::write(outside.path().join("secret.txt"), b"secret").unwrap();
        symlink_dir(outside.path(), directory.path().join("linked")).unwrap();

        let result = scan(directory.path(), &BackupPolicy::default());

        assert!(result.files.is_empty());
        assert_eq!(result.skipped_entries, 1);
    }
}
