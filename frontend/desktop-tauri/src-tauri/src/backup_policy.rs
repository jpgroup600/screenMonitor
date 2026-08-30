use std::path::Path;

pub const DEFAULT_MAX_FILE_BYTES: u64 = 1024 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExclusionReason {
    SystemDirectory,
    ApplicationDirectory,
    BrowserCredentialStore,
    MessengerData,
    EmailStore,
    PersonalCredential,
    TemporaryDirectory,
    CacheFile,
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

        if is_browser_profile(&components) {
            return Some(ExclusionReason::BrowserCredentialStore);
        }

        if is_messenger_store(&components) {
            return Some(ExclusionReason::MessengerData);
        }

        if is_email_store(&components) {
            return Some(ExclusionReason::EmailStore);
        }

        if is_personal_credential(&components) {
            return Some(ExclusionReason::PersonalCredential);
        }

        if contains_sequence(&components, &["appdata", "local", "temp"]) {
            return Some(ExclusionReason::TemporaryDirectory);
        }

        if matches!(
            path.extension()
                .and_then(|value| value.to_str())
                .map(str::to_lowercase)
                .as_deref(),
            Some("tmp" | "cache")
        ) {
            return Some(ExclusionReason::CacheFile);
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

fn is_browser_profile(components: &[&str]) -> bool {
    contains_sequence(components, &["google", "chrome", "user data"])
        || contains_sequence(components, &["microsoft", "edge", "user data"])
        || contains_sequence(components, &["mozilla", "firefox", "profiles"])
}

fn is_messenger_store(components: &[&str]) -> bool {
    contains_sequence(components, &["appdata", "roaming", "kakaotalk"])
        || contains_sequence(components, &["appdata", "roaming", "slack"])
        || contains_sequence(components, &["appdata", "roaming", "discord"])
        || contains_sequence(components, &["microsoft", "teams"])
        || components
            .iter()
            .any(|part| part.starts_with("msteams_8wekyb3d8bbwe"))
}

fn is_email_store(components: &[&str]) -> bool {
    contains_sequence(components, &["thunderbird", "profiles"])
        || matches!(components.last().copied().unwrap_or_default(), value if value.ends_with(".pst") || value.ends_with(".ost"))
}

fn is_personal_credential(components: &[&str]) -> bool {
    contains_sequence(components, &["appdata", "roaming", "microsoft", "crypto"])
        || contains_sequence(components, &["appdata", "roaming", "microsoft", "protect"])
        || components.iter().any(|part| *part == ".ssh")
        || matches!(components.last().copied().unwrap_or_default(), value if value.ends_with(".pfx") || value.ends_with(".p12") || value.ends_with(".key"))
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
    fn excludes_entire_browser_profiles_but_not_downloads() {
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
                    r"C:\Users\employee\AppData\Local\Google\Chrome\User Data\Default\History"
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
    fn forced_private_data_exclusions_cannot_be_included() {
        let policy = BackupPolicy::default();
        let cases = [
            (
                r"C:\Users\employee\AppData\Roaming\KakaoTalk\users\chat.db",
                ExclusionReason::MessengerData,
            ),
            (
                r"C:\Users\employee\AppData\Roaming\Slack\storage\messages.db",
                ExclusionReason::MessengerData,
            ),
            (
                r"C:\Users\employee\AppData\Roaming\Thunderbird\Profiles\mail\Inbox",
                ExclusionReason::EmailStore,
            ),
            (
                r"C:\Users\employee\Documents\personal.pfx",
                ExclusionReason::PersonalCredential,
            ),
            (
                r"C:\Users\employee\.ssh\id_ed25519",
                ExclusionReason::PersonalCredential,
            ),
            (r"D:\work\build.cache", ExclusionReason::CacheFile),
            (r"D:\work\scratch.tmp", ExclusionReason::CacheFile),
        ];
        for (path, reason) in cases {
            assert_eq!(
                policy.exclusion_reason(Path::new(path), Some(20)),
                Some(reason),
                "{path}"
            );
            assert!(!policy.should_include(Path::new(path), Some(20)), "{path}");
        }
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
