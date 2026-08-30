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
    #[serde(default)]
    content_hash: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MissingFile {
    pub path: PathBuf,
    pub size_bytes: u64,
    pub content_hash: Option<String>,
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

    pub fn mark_uploaded(&mut self, file: &InventoryFile, content_hash: Option<String>) {
        self.files.insert(
            key(&file.path),
            FileSignature {
                size_bytes: file.size_bytes,
                modified_unix_seconds: file.modified_unix_seconds,
                content_hash,
            },
        );
    }

    pub fn missing_files(&self, inventory: &[InventoryFile]) -> Vec<MissingFile> {
        let current = inventory
            .iter()
            .map(|file| key(&file.path))
            .collect::<std::collections::HashSet<_>>();
        self.files
            .iter()
            .filter(|(path, _)| !current.contains(*path))
            .map(|(path, signature)| MissingFile {
                path: PathBuf::from(path.replace('/', "\\")),
                size_bytes: signature.size_bytes,
                content_hash: signature.content_hash.clone(),
            })
            .collect()
    }

    pub fn remove(&mut self, path: &Path) {
        self.files.remove(&key(path));
    }

    pub fn relocated_to(
        &self,
        missing: &MissingFile,
        inventory: &[InventoryFile],
    ) -> Option<PathBuf> {
        let hash = missing.content_hash.as_ref()?;
        inventory
            .iter()
            .find(|file| {
                let path_key = key(&file.path);
                path_key != key(&missing.path)
                    && self
                        .files
                        .get(&path_key)
                        .and_then(|signature| signature.content_hash.as_ref())
                        == Some(hash)
            })
            .map(|file| file.path.clone())
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
        manifest.mark_uploaded(&unchanged, Some("a".repeat(64)));
        manifest.mark_uploaded(&changed, Some("b".repeat(64)));
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
        manifest.mark_uploaded(&file(r"C:\Work\same.txt", 10, 1), Some("a".repeat(64)));

        manifest.save(&path).unwrap();

        assert_ne!(
            fs::read(&path).unwrap(),
            serde_json::to_vec(&manifest).unwrap()
        );
        assert_eq!(BackupManifest::load(&path).unwrap(), manifest);
    }

    #[test]
    fn reports_paths_missing_from_the_current_inventory_with_their_hash() {
        let kept = file(r"C:\Work\kept.txt", 10, 1);
        let removed = file(r"C:\Work\removed.txt", 20, 1);
        let mut manifest = BackupManifest::default();
        manifest.mark_uploaded(&kept, Some("a".repeat(64)));
        manifest.mark_uploaded(&removed, Some("b".repeat(64)));

        assert_eq!(
            manifest.missing_files(&[kept]),
            vec![MissingFile {
                path: PathBuf::from(r"c:\work\removed.txt"),
                size_bytes: 20,
                content_hash: Some("b".repeat(64)),
            }]
        );
    }

    #[test]
    fn matches_a_missing_file_to_a_new_path_with_the_same_hash() {
        let old = file(r"C:\Work\old.txt", 10, 1);
        let new = file(r"D:\Archive\new.txt", 10, 2);
        let mut manifest = BackupManifest::default();
        manifest.mark_uploaded(&old, Some("a".repeat(64)));
        manifest.mark_uploaded(&new, Some("a".repeat(64)));
        let missing = manifest.missing_files(std::slice::from_ref(&new));

        assert_eq!(
            manifest.relocated_to(&missing[0], &[new]),
            Some(PathBuf::from(r"D:\Archive\new.txt"))
        );
    }
}
