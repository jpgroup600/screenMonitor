use crate::data_protection::{protect, unprotect};
use std::{fs, path::PathBuf};

#[cfg(test)]
use std::path::Path;

#[derive(Debug, Clone)]
pub struct AuthTokenStore {
    path: PathBuf,
}

impl AuthTokenStore {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn save(&self, token: &str) -> Result<(), String> {
        if token.is_empty() || token.len() > 16 * 1024 {
            return Err("Invalid authentication token".into());
        }
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let pending = self.path.with_extension("pending");
        fs::write(&pending, protect(token.as_bytes())?).map_err(|error| error.to_string())?;
        if self.path.exists() {
            fs::remove_file(&self.path).map_err(|error| error.to_string())?;
        }
        fs::rename(pending, &self.path).map_err(|error| error.to_string())
    }

    pub fn load(&self) -> Result<Option<String>, String> {
        if !self.path.exists() {
            return Ok(None);
        }
        let bytes = unprotect(&fs::read(&self.path).map_err(|error| error.to_string())?)?;
        String::from_utf8(bytes)
            .map(Some)
            .map_err(|error| error.to_string())
    }

    pub fn clear(&self) -> Result<(), String> {
        if self.path.exists() {
            fs::remove_file(&self.path).map_err(|error| error.to_string())?;
        }
        let pending = self.path.with_extension("pending");
        if pending.exists() {
            fs::remove_file(pending).map_err(|error| error.to_string())?;
        }
        Ok(())
    }

    #[cfg(test)]
    fn path(&self) -> &Path {
        &self.path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_encrypted_at_rest_and_can_be_cleared() {
        let directory = tempfile::tempdir().unwrap();
        let store = AuthTokenStore::new(directory.path().join("auth.dat"));
        let token = "header.payload.signature";
        store.save(token).unwrap();
        assert!(!String::from_utf8_lossy(&fs::read(store.path()).unwrap()).contains(token));
        assert_eq!(store.load().unwrap().as_deref(), Some(token));
        store.clear().unwrap();
        assert_eq!(store.load().unwrap(), None);
    }

    #[test]
    fn empty_or_oversized_tokens_are_rejected() {
        let store = AuthTokenStore::new(tempfile::tempdir().unwrap().path().join("auth.dat"));
        assert!(store.save("").is_err());
        assert!(store.save(&"x".repeat(16 * 1024 + 1)).is_err());
    }
}
