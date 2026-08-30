#![cfg(windows)]

use crate::{file_change_audit, service_config::{program_data_directory, ServiceConfig}, service_spool::{ServiceEvent, ServiceSpool}};
use std::{collections::HashSet, sync::{Arc, atomic::{AtomicBool, Ordering}}, time::Duration};

pub fn run_collector(running: Arc<AtomicBool>) -> Result<(), String> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(|error| error.to_string())?;
    runtime.block_on(collect(running))
}

async fn collect(running: Arc<AtomicBool>) -> Result<(), String> {
    let data_directory = program_data_directory();
    let config_path = data_directory.join("agent-policy.dat");
    let spool = ServiceSpool::new(data_directory.join("service-spool"))?;
    let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();
    let (usb_sender, mut usb_receiver) = tokio::sync::mpsc::unbounded_channel();
    let mut active_config = ServiceConfig::default();
    let mut watcher = None;
    let mut usb_watcher = None;
    let mut removable_baseline = HashSet::new();
    let mut network_baseline = None;
    let mut config_tick = tokio::time::interval(Duration::from_secs(5));
    let mut removable_tick = tokio::time::interval(Duration::from_secs(2));
    let mut network_tick = tokio::time::interval(Duration::from_secs(15));

    while running.load(Ordering::SeqCst) {
        tokio::select! {
            _ = config_tick.tick() => {
                let next = ServiceConfig::load(&config_path).unwrap_or_default();
                if next != active_config {
                    watcher = if next.file_change_audit_enabled {
                        file_change_audit::start(&next.roots, sender.clone()).ok()
                    } else { None };
                    let removable = crate::platform::removable_drives();
                    usb_watcher = if next.usb_file_copy_audit_enabled {
                        file_change_audit::start(&removable, usb_sender.clone()).ok()
                    } else { None };
                    removable_baseline = removable.into_iter().collect();
                    if !next.network_audit_enabled { network_baseline = None; }
                    active_config = next;
                }
            }
            event = receiver.recv(), if active_config.file_change_audit_enabled => {
                if let Some(event) = event {
                    let details = serde_json::json!({
                        "destination": event.destination.map(|path| path.to_string_lossy().into_owned()),
                        "evidence": "windows_service_filesystem_notification"
                    }).to_string();
                    let item = ServiceEvent::new(event.event_type, event.source.to_string_lossy(), details);
                    let _ = spool.enqueue(&item);
                }
            }
            event = usb_receiver.recv(), if active_config.usb_file_copy_audit_enabled => {
                if let Some(event) = event {
                    if matches!(event.event_type, "FILE_CREATED" | "FILE_MODIFIED" | "FILE_MOVED") {
                        let details = serde_json::json!({
                            "destination": event.destination.map(|path| path.to_string_lossy().into_owned()),
                            "evidence": "windows_service_removable_filesystem_notification",
                            "confirmedCopy": false
                        }).to_string();
                        let item = ServiceEvent::new("USB_FILE_WRITTEN", event.source.to_string_lossy(), details);
                        let _ = spool.enqueue(&item);
                    }
                }
            }
            _ = removable_tick.tick(), if active_config.usb_audit_enabled => {
                let current = crate::platform::removable_drives().into_iter().collect::<HashSet<_>>();
                for (event_type, drive) in drive_changes(&removable_baseline, &current) {
                    let item = ServiceEvent::new(event_type, drive, serde_json::json!({"evidence":"windows_service_drive_poll"}).to_string());
                    let _ = spool.enqueue(&item);
                }
                removable_baseline = current;
            }
            _ = network_tick.tick(), if active_config.network_audit_enabled => {
                if let Ok(current) = crate::network_audit::established_external_connections() {
                    if let Some(previous) = &network_baseline {
                        for connection in crate::network_audit::detect_new(previous, &current).into_iter().take(100) {
                            let source = format!("{}:{}", connection.remote_address, connection.remote_port);
                            let details = serde_json::json!({"processId":connection.process_id,"evidence":"windows_service_new_external_tcp_connection","confirmedFileTransfer":false}).to_string();
                            let _ = spool.enqueue(&ServiceEvent::new("NETWORK_CONNECTION", source, details));
                        }
                    }
                    network_baseline = Some(current);
                }
            }
            _ = tokio::time::sleep(Duration::from_millis(250)) => {}
        }
    }
    drop(watcher);
    drop(usb_watcher);
    Ok(())
}

fn drive_changes(previous: &HashSet<String>, current: &HashSet<String>) -> Vec<(&'static str, String)> {
    let mut changes = current.difference(previous)
        .map(|drive| ("USB_CONNECTED", drive.clone()))
        .chain(previous.difference(current).map(|drive| ("USB_DISCONNECTED", drive.clone())))
        .collect::<Vec<_>>();
    changes.sort_by(|left, right| left.1.cmp(&right.1));
    changes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stopped_collector_exits_without_collecting() {
        let running = Arc::new(AtomicBool::new(false));
        assert!(run_collector(running).is_ok());
    }


    #[test]
    fn removable_drive_changes_are_labeled_without_claiming_file_transfer() {
        let previous = HashSet::from(["E:\\".to_owned()]);
        let current = HashSet::from(["F:\\".to_owned()]);
        assert_eq!(drive_changes(&previous, &current), vec![
            ("USB_DISCONNECTED", "E:\\".to_owned()),
            ("USB_CONNECTED", "F:\\".to_owned()),
        ]);
    }
}
