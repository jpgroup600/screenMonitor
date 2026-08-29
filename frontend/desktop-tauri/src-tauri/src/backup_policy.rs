use std::path::Path;

pub const DEFAULT_MAX_FILE_BYTES: u64 = 1024 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExclusionReason {
    SystemDirectory,
    ApplicationDirectory,
    BrowserCredentialStore,
    TemporaryDirectory,
    SystemFile,
    FileTooLarge,
}

#[derive(Debug, Clone)]
pub struct BackupPolicy {
    max_file_bytes: u64,
}

impl Default for BackupPolicy {
    fn default() -> Self {
        Self {
            max_file_bytes: DEFAULT_MAX_FILE_BYTES,
        }
    }
}

impl BackupPolicy {
    #[cfg(test)]
    fn with_max_file_bytes(max_file_bytes: u64) -> Self {
        Self { max_file_bytes }
    }

    pub fn exclusion_reason(&self, path: &Path, file_size: Option<u64>) -> Option<ExclusionReason> {
        if file_size.is_some_and(|size| size > self.max_file_bytes) {
            return Some(ExclusionReason::FileTooLarge);
        }

        let normalized = normalize(path);
        let components = normalized.split('/').collect::<Vec<_>>();

        if components.iter().any(|part| {
            matches!(
                *part,
                "windows" | "$recycle.bin" | "system volume information"
            )
        }) {
            return Some(ExclusionReason::SystemDirectory);
        }

        if components.iter().any(|part| {
            matches!(
                *part,
                "program files" | "program files (x86)" | "programdata"
            )
        }) {
            return Some(ExclusionReason::ApplicationDirectory);
        }

        if is_browser_credential_store(&components) {
            return Some(ExclusionReason::BrowserCredentialStore);
        }

        if contains_sequence(&components, &["appdata", "local", "temp"]) {
            return Some(ExclusionReason::TemporaryDirectory);
        }

        if matches!(
            components.last().copied().unwrap_or_default(),
            "pagefile.sys" | "hiberfil.sys" | "swapfile.sys"
        ) {
            return Some(ExclusionReason::SystemFile);
        }

        None
    }

    pub fn should_include(&self, path: &Path, file_size: Option<u64>) -> bool {
        self.exclusion_reason(path, file_size).is_none()
    }
}

fn normalize(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/").to_lowercase()
}

fn contains_sequence(components: &[&str], sequence: &[&str]) -> bool {
    components
        .windows(sequence.len())
        .any(|window| window == sequence)
}

fn is_browser_credential_store(components: &[&str]) -> bool {
    let is_chromium_profile = contains_sequence(components, &["google", "chrome", "user data"])
        || contains_sequence(components, &["microsoft", "edge", "user data"]);
    let is_firefox_profile = contains_sequence(components, &["mozilla", "firefox", "profiles"]);
    let file_name = components.last().copied().unwrap_or_default();

    (is_chromium_profile
        && matches!(
            file_name,
            "cookies" | "login data" | "web data" | "local state"
        ))
        || (is_firefox_profile && matches!(file_name, "cookies.sqlite" | "logins.json" | "key4.db"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn includes_company_documents_and_source_files() {
        let policy = BackupPolicy::default();

        assert!(policy.should_include(
            Path::new(r"C:\Users\employee\Documents\proposal.docx"),
            Some(20)
        ));
        assert!(policy.should_include(Path::new(r"D:\company\product\src\main.rs"), Some(20)));
    }

    #[test]
    fn excludes_windows_and_application_directories() {
        let policy = BackupPolicy::default();

        assert_eq!(
            policy.exclusion_reason(Path::new(r"C:\Windows\System32\kernel32.dll"), Some(20)),
            Some(ExclusionReason::SystemDirectory)
        );
        assert_eq!(
            policy.exclusion_reason(Path::new(r"C:\Program Files\Vendor\app.exe"), Some(20)),
            Some(ExclusionReason::ApplicationDirectory)
        );
    }

    #[test]
    fn excludes_browser_password_and_cookie_stores_but_not_downloads() {
        let policy = BackupPolicy::default();

        assert_eq!(
            policy.exclusion_reason(
                Path::new(
                    r"C:\Users\employee\AppData\Local\Google\Chrome\User Data\Default\Login Data"
                ),
                Some(20)
            ),
            Some(ExclusionReason::BrowserCredentialStore)
        );
        assert_eq!(
            policy.exclusion_reason(
                Path::new(
                    r"C:\Users\employee\AppData\Roaming\Mozilla\Firefox\Profiles\abc\key4.db"
                ),
                Some(20)
            ),
            Some(ExclusionReason::BrowserCredentialStore)
        );
        assert!(policy.should_include(
            Path::new(r"C:\Users\employee\Downloads\contract.pdf"),
            Some(20)
        ));
    }

    #[test]
    fn excludes_temporary_system_and_oversized_files() {
        let policy = BackupPolicy::with_max_file_bytes(100);

        assert_eq!(
            policy.exclusion_reason(
                Path::new(r"C:\Users\employee\AppData\Local\Temp\draft.tmp"),
                Some(20)
            ),
            Some(ExclusionReason::TemporaryDirectory)
        );
        assert_eq!(
            policy.exclusion_reason(Path::new(r"C:\hiberfil.sys"), Some(20)),
            Some(ExclusionReason::SystemFile)
        );
        assert_eq!(
            policy.exclusion_reason(Path::new(r"D:\company\archive.zip"), Some(101)),
            Some(ExclusionReason::FileTooLarge)
        );
    }
}
