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

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ScanProgress {
    pub discovered_files: u64,
    pub discovered_bytes: u64,
    pub skipped_entries: u64,
    pub inaccessible_entries: u64,
    pub current_path: PathBuf,
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

pub fn scan_streaming<F>(
    roots: &[String],
    policy: &BackupPolicy,
    delay_per_entry: Duration,
    batch_size: usize,
    mut on_batch: F,
) -> Result<InventoryResult, String>
where
    F: FnMut(Vec<InventoryFile>, ScanProgress) -> Result<(), String>,
{
    let mut result = InventoryResult::default();
    let mut pending = Vec::new();
    let mut progress = ScanProgress::default();
    for root in roots {
        scan_directory_streaming(
            Path::new(root),
            policy,
            delay_per_entry,
            batch_size.max(1),
            &mut result,
            &mut pending,
            &mut progress,
            &mut on_batch,
        )?;
    }
    on_batch(std::mem::take(&mut pending), progress.clone())?;
    result
        .files
        .sort_by(|left, right| left.path.cmp(&right.path));
    Ok(result)
}

pub fn scan_folders_streaming<F>(roots: &[String], policy: &BackupPolicy, batch_size: usize, mut on_batch: F) -> Result<u64, String>
where F: FnMut(Vec<String>, PathBuf) -> Result<(), String>,
{
    let mut pending = roots.iter().map(PathBuf::from).collect::<Vec<_>>();
    let mut batch = Vec::new();
    let mut discovered = 0;
    while let Some(directory) = pending.pop() {
        if !policy.should_include(&directory, None) { continue; }
        discovered += 1;
        batch.push(directory.to_string_lossy().to_string());
        if batch.len() >= batch_size.max(1) { on_batch(std::mem::take(&mut batch), directory.clone())?; }
        let Ok(entries) = fs::read_dir(&directory) else { continue; };
        for entry in entries.flatten() {
            let path = entry.path();
            if entry.file_type().is_ok_and(|kind| kind.is_dir() && !kind.is_symlink()) { pending.push(path); }
        }
    }
    if !batch.is_empty() { on_batch(batch, PathBuf::new())?; }
    Ok(discovered)
}

fn scan_directory_streaming<F>(
    directory: &Path,
    policy: &BackupPolicy,
    delay_per_entry: Duration,
    batch_size: usize,
    result: &mut InventoryResult,
    pending: &mut Vec<InventoryFile>,
    progress: &mut ScanProgress,
    on_batch: &mut F,
) -> Result<(), String>
where
    F: FnMut(Vec<InventoryFile>, ScanProgress) -> Result<(), String>,
{
    progress.current_path = directory.to_path_buf();
    if !policy.should_include(directory, None) {
        result.skipped_entries += 1;
        progress.skipped_entries += 1;
        return Ok(());
    }
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(_) => {
            result.inaccessible_entries += 1;
            progress.inaccessible_entries += 1;
            return Ok(());
        }
    };
    for entry in entries {
        if !delay_per_entry.is_zero() {
            std::thread::sleep(delay_per_entry);
        }
        let entry = match entry {
            Ok(value) => value,
            Err(_) => {
                result.inaccessible_entries += 1;
                progress.inaccessible_entries += 1;
                continue;
            }
        };
        let path = entry.path();
        progress.current_path = path.clone();
        let metadata = match fs::symlink_metadata(&path) {
            Ok(value) => value,
            Err(_) => {
                result.inaccessible_entries += 1;
                progress.inaccessible_entries += 1;
                continue;
            }
        };
        if metadata.file_type().is_symlink() {
            result.skipped_entries += 1;
            progress.skipped_entries += 1;
            continue;
        }
        if metadata.is_dir() {
            scan_directory_streaming(
                &path,
                policy,
                delay_per_entry,
                batch_size,
                result,
                pending,
                progress,
                on_batch,
            )?;
            continue;
        }
        if !metadata.is_file() || !policy.should_include(&path, Some(metadata.len())) {
            result.skipped_entries += 1;
            progress.skipped_entries += 1;
            continue;
        }
        let file = InventoryFile {
            path,
            size_bytes: metadata.len(),
            modified_unix_seconds: metadata
                .modified()
                .ok()
                .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                .map(|value| value.as_secs()),
        };
        progress.discovered_files += 1;
        progress.discovered_bytes += file.size_bytes;
        result.files.push(file.clone());
        pending.push(file);
        if pending.len() >= batch_size {
            on_batch(std::mem::take(pending), progress.clone())?;
        }
    }
    Ok(())
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

    #[test]
    fn streaming_scan_emits_bounded_batches_and_cumulative_progress() {
        let directory = tempfile::Builder::new()
            .prefix("inventory-stream-")
            .tempdir_in(".")
            .unwrap();
        fs::write(directory.path().join("one.txt"), b"1").unwrap();
        fs::write(directory.path().join("two.txt"), b"22").unwrap();
        fs::write(directory.path().join("three.txt"), b"333").unwrap();
        let roots = vec![directory.path().to_string_lossy().to_string()];
        let mut updates = Vec::new();

        let result = scan_streaming(
            &roots,
            &BackupPolicy::default(),
            Duration::ZERO,
            2,
            |batch, progress| {
                updates.push((batch.len(), progress));
                Ok(())
            },
        )
        .unwrap();

        assert_eq!(result.files.len(), 3);
        assert_eq!(updates.iter().map(|update| update.0).sum::<usize>(), 3);
        assert!(updates.iter().all(|update| update.0 <= 2));
        assert_eq!(updates.last().unwrap().1.discovered_files, 3);
        assert_eq!(updates.last().unwrap().1.discovered_bytes, 6);
    }

    #[test]
    fn folder_scan_emits_tree_before_reading_file_metadata() {
        let directory = tempfile::Builder::new().prefix("folder-tree-").tempdir_in(".").unwrap();
        fs::create_dir_all(directory.path().join("Users/Employee/Documents")).unwrap();
        fs::write(directory.path().join("Users/Employee/Documents/report.txt"), b"data").unwrap();
        let mut folders = Vec::new();
        let count = scan_folders_streaming(&[directory.path().to_string_lossy().into()], &BackupPolicy::default(), 2, |batch, _| {
            folders.extend(batch); Ok(())
        }).unwrap();
        assert_eq!(count, 4);
        assert!(folders.iter().any(|path| path.ends_with("Documents")));
        assert!(!folders.iter().any(|path| path.ends_with("report.txt")));
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
