use crate::data_protection::{protect_machine, unprotect_machine};
use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ServiceConfig {
    pub file_change_audit_enabled: bool,
    pub network_audit_enabled: bool,
    pub usb_audit_enabled: bool,
    pub usb_file_copy_audit_enabled: bool,
    pub roots: Vec<String>,
}

impl ServiceConfig {
    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let serialized = serde_json::to_vec(self).map_err(|error| error.to_string())?;
        let protected = protect_machine(&serialized)?;
        let pending = path.with_extension("pending");
        fs::write(&pending, protected).map_err(|error| error.to_string())?;
        if path.exists() {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
        fs::rename(pending, path).map_err(|error| error.to_string())
    }

    pub fn load(path: &Path) -> Result<Self, String> {
        if !path.exists() { return Ok(Self::default()); }
        let protected = fs::read(path).map_err(|error| error.to_string())?;
        let serialized = unprotect_machine(&protected)?;
        serde_json::from_slice(&serialized).map_err(|error| error.to_string())
    }
}

pub fn program_data_directory() -> PathBuf {
    std::env::var_os("PROGRAMDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"))
        .join("ScreenMonitor")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_config_is_safe_and_disables_collection() {
        let directory = tempfile::tempdir().unwrap();
        assert_eq!(ServiceConfig::load(&directory.path().join("missing.dat")).unwrap(), ServiceConfig::default());
    }

    #[test]
    fn config_is_machine_encrypted_and_round_trips() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("agent-policy.dat");
        let config = ServiceConfig {
            file_change_audit_enabled: true,
            network_audit_enabled: true,
            usb_audit_enabled: true,
            usb_file_copy_audit_enabled: false,
            roots: vec![r"C:\".into()],
        };
        config.save(&path).unwrap();
        assert_ne!(fs::read(&path).unwrap(), serde_json::to_vec(&config).unwrap());
        assert_eq!(ServiceConfig::load(&path).unwrap(), config);
        assert!(!path.with_extension("pending").exists());
    }
}
