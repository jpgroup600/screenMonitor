use serde::Serialize;
use std::{collections::VecDeque, path::Path, time::Duration};

const WINDOW: Duration = Duration::from_secs(5 * 60);
const BULK_FILE_COUNT: usize = 50;
const BULK_BYTES: u64 = 1024 * 1024 * 1024;
const LARGE_FILE_BYTES: u64 = 100 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbRiskAssessment {
    pub level: &'static str,
    pub reasons: Vec<&'static str>,
    pub window_file_count: usize,
    pub window_bytes: u64,
}

#[derive(Debug, Clone)]
struct Transfer {
    occurred_at: Duration,
    size_bytes: u64,
}

#[derive(Debug, Default)]
pub struct UsbRiskTracker {
    transfers: VecDeque<Transfer>,
}

impl UsbRiskTracker {
    pub fn assess(&mut self, path: &Path, size_bytes: u64, now: Duration) -> UsbRiskAssessment {
        while self
            .transfers
            .front()
            .is_some_and(|item| now.saturating_sub(item.occurred_at) > WINDOW)
        {
            self.transfers.pop_front();
        }
        self.transfers.push_back(Transfer {
            occurred_at: now,
            size_bytes,
        });
        let window_bytes = self.transfers.iter().map(|item| item.size_bytes).sum();
        let mut reasons = Vec::new();
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        if matches!(extension.as_str(), "zip" | "7z" | "rar" | "tar" | "gz") {
            reasons.push("archive_file");
        }
        if matches!(
            extension.as_str(),
            "pem" | "key" | "pfx" | "p12" | "kdbx" | "sql" | "bak" | "accdb" | "mdb"
        ) {
            reasons.push("sensitive_file_type");
        }
        if size_bytes >= LARGE_FILE_BYTES {
            reasons.push("large_file");
        }
        if self.transfers.len() >= BULK_FILE_COUNT || window_bytes >= BULK_BYTES {
            reasons.push("bulk_write_window");
        }
        UsbRiskAssessment {
            level: if reasons.is_empty() { "Normal" } else { "High" },
            reasons,
            window_file_count: self.transfers.len(),
            window_bytes,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_archives_sensitive_types_and_large_files() {
        let mut tracker = UsbRiskTracker::default();
        let archive = tracker.assess(Path::new(r"E:\export.zip"), 5, Duration::from_secs(1));
        assert_eq!(archive.level, "High");
        assert!(archive.reasons.contains(&"archive_file"));
        let secret = tracker.assess(Path::new(r"E:\certificate.pfx"), 5, Duration::from_secs(2));
        assert!(secret.reasons.contains(&"sensitive_file_type"));
        let large = tracker.assess(
            Path::new(r"E:\video.mp4"),
            LARGE_FILE_BYTES,
            Duration::from_secs(3),
        );
        assert!(large.reasons.contains(&"large_file"));
    }

    #[test]
    fn detects_a_bulk_window_and_expires_old_entries() {
        let mut tracker = UsbRiskTracker::default();
        for index in 0..BULK_FILE_COUNT {
            let risk = tracker.assess(
                Path::new(r"E:\report.txt"),
                1,
                Duration::from_secs(index as u64),
            );
            if index + 1 == BULK_FILE_COUNT {
                assert!(risk.reasons.contains(&"bulk_write_window"));
            }
        }
        let after_window = tracker.assess(
            Path::new(r"E:\new.txt"),
            1,
            WINDOW + Duration::from_secs(100),
        );
        assert_eq!(after_window.window_file_count, 1);
        assert_eq!(after_window.level, "Normal");
    }
}
