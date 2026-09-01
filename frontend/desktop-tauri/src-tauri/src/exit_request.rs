use crate::data_protection::{protect_machine, unprotect_machine};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExitRequest { pub device_id: String, pub token: String }

impl ExitRequest {
    pub fn save(&self, path: &Path) -> Result<(), String> {
        let parent = path.parent().ok_or("Invalid exit request path")?;
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        let value = protect_machine(&serde_json::to_vec(self).map_err(|error| error.to_string())?)?;
        fs::write(path, value).map_err(|error| error.to_string())
    }
    pub fn load(path: &Path) -> Result<Option<Self>, String> {
        if !path.exists() { return Ok(None); }
        let value = unprotect_machine(&fs::read(path).map_err(|error| error.to_string())?)?;
        serde_json::from_slice(&value).map(Some).map_err(|error| error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn request_is_machine_protected_and_round_trips() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("exit-request.dat");
        let request = ExitRequest { device_id: "device-1".into(), token: "secret".into() };
        request.save(&path).unwrap();
        assert_ne!(fs::read(&path).unwrap(), serde_json::to_vec(&request).unwrap());
        assert_eq!(ExitRequest::load(&path).unwrap(), Some(request));
    }
}
