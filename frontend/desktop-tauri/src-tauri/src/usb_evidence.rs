use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::{BufReader, Read},
    path::Path,
};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbDeviceEvidence {
    pub drive_root: String,
    pub volume_label: Option<String>,
    pub file_system: Option<String>,
    pub volume_serial_number: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub device_serial_number: Option<String>,
    pub bit_locker_protection_status: String,
}

impl UsbDeviceEvidence {
    fn unavailable(drive_root: &str) -> Self {
        Self {
            drive_root: drive_root.to_owned(),
            bit_locker_protection_status: "Unknown".to_owned(),
            ..Self::default()
        }
    }
}

pub fn drive_root_from_path(path: &Path) -> Option<String> {
    let value = path.to_string_lossy();
    let bytes = value.as_bytes();
    (bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'\\')
        .then(|| format!("{}:\\", (bytes[0] as char).to_ascii_uppercase()))
}

pub fn sha256_file(path: &Path) -> Result<String, String> {
    let file = File::open(path).map_err(|error| error.to_string())?;
    let mut reader = BufReader::new(file);
    let mut hash = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        hash.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hash.finalize()))
}

pub fn file_write_details(
    path: &Path,
    destination: Option<&Path>,
    risk: Option<&crate::usb_risk::UsbRiskAssessment>,
) -> String {
    let metadata = path.metadata().ok();
    let drive_root = drive_root_from_path(path);
    serde_json::json!({
        "destination": destination.map(|value| value.to_string_lossy().into_owned()),
        "destinationDrive": drive_root,
        "sizeBytes": metadata.as_ref().map(|value| value.len()),
        "sha256": sha256_file(path).ok(),
        "risk": risk,
        "evidence": "windows_service_removable_filesystem_notification",
        "confirmedCopy": false
    })
    .to_string()
}

#[cfg(windows)]
pub fn removable_drive_evidence(drive_root: &str) -> UsbDeviceEvidence {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    const SCRIPT: &str = r#"
$drive = $env:SCREENMONITOR_DRIVE.TrimEnd('\')
$logical = Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='" + $drive + "'") -ErrorAction Stop
$partition = $logical | Get-CimAssociatedInstance -Association Win32_LogicalDiskToPartition -ErrorAction Stop | Select-Object -First 1
$disk = $partition | Get-CimAssociatedInstance -Association Win32_DiskDriveToDiskPartition -ErrorAction Stop | Select-Object -First 1
$protection = 'Unknown'
try {
  $encrypted = Get-CimInstance -Namespace 'root/CIMV2/Security/MicrosoftVolumeEncryption' -ClassName Win32_EncryptableVolume -Filter ("DriveLetter='" + $drive + "'") -ErrorAction Stop
  if ($null -ne $encrypted) {
    $result = Invoke-CimMethod -InputObject $encrypted -MethodName GetProtectionStatus -ErrorAction Stop
    if ($result.ProtectionStatus -eq 1) { $protection = 'On' } elseif ($result.ProtectionStatus -eq 0) { $protection = 'Off' }
  }
} catch {}
[pscustomobject]@{
  driveRoot = $env:SCREENMONITOR_DRIVE
  volumeLabel = $logical.VolumeName
  fileSystem = $logical.FileSystem
  volumeSerialNumber = $logical.VolumeSerialNumber
  manufacturer = $disk.Manufacturer
  model = $disk.Model
  deviceSerialNumber = $disk.SerialNumber
  bitLockerProtectionStatus = $protection
} | ConvertTo-Json -Compress
"#;

    let result = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            SCRIPT,
        ])
        .env("SCREENMONITOR_DRIVE", drive_root)
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    let Ok(output) = result else {
        return UsbDeviceEvidence::unavailable(drive_root);
    };
    if !output.status.success() {
        return UsbDeviceEvidence::unavailable(drive_root);
    }
    serde_json::from_slice(&output.stdout)
        .unwrap_or_else(|_| UsbDeviceEvidence::unavailable(drive_root))
}

#[cfg(not(windows))]
pub fn removable_drive_evidence(drive_root: &str) -> UsbDeviceEvidence {
    UsbDeviceEvidence::unavailable(drive_root)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_a_normalized_drive_root() {
        assert_eq!(
            drive_root_from_path(Path::new(r"e:\reports\secret.pdf")).as_deref(),
            Some(r"E:\")
        );
        assert_eq!(
            drive_root_from_path(Path::new(r"\\server\share\file")),
            None
        );
    }

    #[test]
    fn hashes_the_exact_file_content() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("evidence.txt");
        std::fs::write(&source, b"screen monitor").unwrap();
        assert_eq!(
            sha256_file(&source).unwrap(),
            "27ea16d4c37ed27f445dc6192c1a6d1b65368b7b1b9365fd98a1bdce3825a6fd"
        );
    }

    #[test]
    fn file_evidence_contains_size_hash_and_cautious_classification() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("report.pdf");
        std::fs::write(&source, b"classified").unwrap();
        let value: serde_json::Value =
            serde_json::from_str(&file_write_details(&source, None, None)).unwrap();
        assert_eq!(value["sizeBytes"], 10);
        assert_eq!(value["sha256"].as_str().unwrap().len(), 64);
        assert_eq!(value["confirmedCopy"], false);
    }

    #[test]
    fn parses_stable_device_evidence_fields() {
        let value: UsbDeviceEvidence = serde_json::from_str(
            r#"{"driveRoot":"E:\\","volumeLabel":"WORK","fileSystem":"NTFS","volumeSerialNumber":"A1B2","manufacturer":"Vendor","model":"Secure USB","deviceSerialNumber":"SERIAL-1","bitLockerProtectionStatus":"On"}"#,
        )
        .unwrap();
        assert_eq!(value.drive_root, r"E:\");
        assert_eq!(value.model.as_deref(), Some("Secure USB"));
        assert_eq!(value.bit_locker_protection_status, "On");
    }
}
