use crate::{
    backup_inventory::InventoryFile,
    data_protection::{protect, unprotect},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct FileSignature {
    size_bytes: u64,
    modified_unix_seconds: Option<u64>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct BackupManifest {
    files: BTreeMap<String, FileSignature>,
}

impl BackupManifest {
    pub fn load(path: &Path) -> Result<Self, String> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let protected = fs::read(path).map_err(|error| error.to_string())?;
        serde_json::from_slice(&unprotect(&protected)?).map_err(|error| error.to_string())
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let serialized = serde_json::to_vec(self).map_err(|error| error.to_string())?;
        let pending = path.with_extension("pending");
        fs::write(&pending, protect(&serialized)?).map_err(|error| error.to_string())?;
        fs::rename(pending, path).map_err(|error| error.to_string())
    }

    pub fn changed_files(&self, inventory: &[InventoryFile]) -> Vec<PathBuf> {
        inventory
            .iter()
            .filter(|file| {
                self.files.get(&key(&file.path)).is_none_or(|previous| {
                    previous.size_bytes != file.size_bytes
                        || previous.modified_unix_seconds != file.modified_unix_seconds
                })
            })
            .map(|file| file.path.clone())
            .collect()
    }

    pub fn mark_uploaded(&mut self, file: &InventoryFile) {
        self.files.insert(
            key(&file.path),
            FileSignature {
                size_bytes: file.size_bytes,
                modified_unix_seconds: file.modified_unix_seconds,
            },
        );
    }
}

fn key(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/").to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(path: &str, size: u64, modified: u64) -> InventoryFile {
        InventoryFile {
            path: PathBuf::from(path),
            size_bytes: size,
            modified_unix_seconds: Some(modified),
        }
    }

    #[test]
    fn selects_only_new_or_changed_files() {
        let unchanged = file(r"C:\Work\same.txt", 10, 1);
        let changed = file(r"C:\Work\changed.txt", 10, 1);
        let new_file = file(r"C:\Work\new.txt", 5, 1);
        let mut manifest = BackupManifest::default();
        manifest.mark_uploaded(&unchanged);
        manifest.mark_uploaded(&changed);
        let changed_later = file(r"C:\Work\changed.txt", 11, 2);

        assert_eq!(
            manifest.changed_files(&[unchanged, changed_later.clone(), new_file.clone()]),
            vec![changed_later.path, new_file.path]
        );
    }

    #[test]
    fn encrypted_manifest_round_trips() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("manifest.dat");
        let mut manifest = BackupManifest::default();
        manifest.mark_uploaded(&file(r"C:\Work\same.txt", 10, 1));

        manifest.save(&path).unwrap();

        assert_ne!(
            fs::read(&path).unwrap(),
            serde_json::to_vec(&manifest).unwrap()
        );
        assert_eq!(BackupManifest::load(&path).unwrap(), manifest);
    }
}
