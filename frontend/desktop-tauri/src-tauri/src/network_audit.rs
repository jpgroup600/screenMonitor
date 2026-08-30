use serde::Serialize;
use std::{collections::HashSet, net::IpAddr, process::Command};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalConnection {
    pub remote_address: String,
    pub remote_port: u16,
    pub process_id: u32,
}

pub fn detect_new(
    previous: &HashSet<ExternalConnection>,
    current: &HashSet<ExternalConnection>,
) -> Vec<ExternalConnection> {
    current.difference(previous).cloned().collect()
}

pub fn classify_channel(process_name: Option<&str>, remote_port: u16) -> &'static str {
    let process = process_name.unwrap_or_default().to_ascii_lowercase();
    if remote_port == 445 {
        return "NetworkShare";
    }
    if matches!(remote_port, 21 | 22 | 990)
        || matches!(
            process.as_str(),
            "filezilla.exe" | "winscp.exe" | "ftp.exe" | "sftp.exe"
        )
    {
        return "FileTransfer";
    }
    if remote_port == 3389 || process == "mstsc.exe" {
        return "RemoteDesktop";
    }
    if matches!(
        process.as_str(),
        "onedrive.exe" | "dropbox.exe" | "googledrivefs.exe" | "icloud.exe"
    ) {
        return "CloudSync";
    }
    if matches!(process.as_str(), "outlook.exe" | "thunderbird.exe") {
        return "EmailClient";
    }
    if matches!(
        process.as_str(),
        "teams.exe"
            | "ms-teams.exe"
            | "slack.exe"
            | "kakaotalk.exe"
            | "discord.exe"
            | "telegram.exe"
    ) {
        return "Messaging";
    }
    if matches!(
        process.as_str(),
        "chrome.exe" | "msedge.exe" | "firefox.exe" | "brave.exe" | "opera.exe"
    ) {
        return "Browser";
    }
    "OtherExternalConnection"
}

pub fn established_external_connections() -> Result<HashSet<ExternalConnection>, String> {
    #[cfg(windows)]
    let output = {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("netstat")
            .args(["-ano", "-p", "tcp"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
    };
    #[cfg(not(windows))]
    let output = Command::new("netstat").args(["-antp"]).output();
    let output = output.map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err("netstat failed".into());
    }
    Ok(parse_netstat(&String::from_utf8_lossy(&output.stdout)))
}

pub fn parse_netstat(value: &str) -> HashSet<ExternalConnection> {
    value
        .lines()
        .filter_map(|line| {
            let fields = line.split_whitespace().collect::<Vec<_>>();
            if fields.len() < 5
                || !fields[0].eq_ignore_ascii_case("TCP")
                || !fields[3].eq_ignore_ascii_case("ESTABLISHED")
            {
                return None;
            }
            let (address, port) = split_endpoint(fields[2])?;
            let ip = address.parse::<IpAddr>().ok()?;
            if !is_external(ip) {
                return None;
            }
            Some(ExternalConnection {
                remote_address: address.to_owned(),
                remote_port: port,
                process_id: fields[4].parse().ok()?,
            })
        })
        .collect()
}

fn split_endpoint(value: &str) -> Option<(&str, u16)> {
    if let Some(rest) = value.strip_prefix('[') {
        let (address, port) = rest.rsplit_once("]:")?;
        return Some((address, port.parse().ok()?));
    }
    let (address, port) = value.rsplit_once(':')?;
    Some((address, port.parse().ok()?))
}

fn is_external(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(value) => {
            !(value.is_private()
                || value.is_loopback()
                || value.is_link_local()
                || value.is_broadcast()
                || value.is_unspecified())
        }
        IpAddr::V6(value) => {
            !(value.is_loopback()
                || value.is_unspecified()
                || (value.segments()[0] & 0xfe00) == 0xfc00
                || (value.segments()[0] & 0xffc0) == 0xfe80)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_only_established_external_connections() {
        let result = parse_netstat("  TCP  10.0.0.5:50000  8.8.8.8:443  ESTABLISHED  1200\n  TCP  10.0.0.5:50001  192.168.0.2:445  ESTABLISHED  1201\n  TCP  10.0.0.5:50002  1.1.1.1:443  TIME_WAIT  0");
        assert_eq!(result.len(), 1);
        assert!(result.contains(&ExternalConnection {
            remote_address: "8.8.8.8".into(),
            remote_port: 443,
            process_id: 1200
        }));
    }

    #[test]
    fn detects_only_connections_added_after_baseline() {
        let old = ExternalConnection {
            remote_address: "8.8.8.8".into(),
            remote_port: 443,
            process_id: 1,
        };
        let new = ExternalConnection {
            remote_address: "1.1.1.1".into(),
            remote_port: 443,
            process_id: 2,
        };
        let previous = HashSet::from([old.clone()]);
        let current = HashSet::from([old, new.clone()]);
        assert_eq!(detect_new(&previous, &current), vec![new]);
    }

    #[test]
    fn parses_bracketed_ipv6_destination() {
        let result = parse_netstat("TCP [fe80::1]:5000 [2606:4700:4700::1111]:443 ESTABLISHED 42");
        assert!(result.contains(&ExternalConnection {
            remote_address: "2606:4700:4700::1111".into(),
            remote_port: 443,
            process_id: 42
        }));
    }

    #[test]
    fn classifies_network_channels_without_claiming_a_file_transfer() {
        assert_eq!(classify_channel(Some("chrome.exe"), 443), "Browser");
        assert_eq!(classify_channel(Some("OneDrive.exe"), 443), "CloudSync");
        assert_eq!(classify_channel(Some("unknown.exe"), 445), "NetworkShare");
        assert_eq!(classify_channel(Some("WinSCP.exe"), 443), "FileTransfer");
        assert_eq!(classify_channel(None, 443), "OtherExternalConnection");
    }
}
