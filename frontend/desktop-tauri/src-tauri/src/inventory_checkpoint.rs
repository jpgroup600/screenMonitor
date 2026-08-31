use crate::{backup_inventory::InventoryResult, data_protection::{protect, unprotect}};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InventoryCheckpoint {
    pub roots: Vec<String>,
    pub inventory: InventoryResult,
}

impl InventoryCheckpoint {
    pub fn load(path: &Path) -> Result<Option<Self>, String> {
        if !path.exists() { return Ok(None); }
        let bytes = fs::read(path).map_err(|error| error.to_string())?;
        let plain = unprotect(&bytes)?;
        serde_json::from_slice(&plain).map(Some).map_err(|error| error.to_string())
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() { fs::create_dir_all(parent).map_err(|error| error.to_string())?; }
        let pending = path.with_extension("pending");
        let plain = serde_json::to_vec(self).map_err(|error| error.to_string())?;
        fs::write(&pending, protect(&plain)?).map_err(|error| error.to_string())?;
        fs::rename(pending, path).map_err(|error| error.to_string())
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::backup_inventory::InventoryFile;
    use std::path::PathBuf;

    #[test]
    fn encrypted_checkpoint_survives_process_restart() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("inventory.dat");
        let checkpoint = InventoryCheckpoint { roots: vec![r"C:\".into()], inventory: InventoryResult {
            files: vec![InventoryFile { path: PathBuf::from(r"C:\Work\a.txt"), size_bytes: 10, modified_unix_seconds: Some(1) }],
            skipped_entries: 2, inaccessible_entries: 1,
        }};
        checkpoint.save(&path).unwrap();
        assert_ne!(fs::read(&path).unwrap(), serde_json::to_vec(&checkpoint).unwrap());
        assert_eq!(InventoryCheckpoint::load(&path).unwrap(), Some(checkpoint));
    }

}
