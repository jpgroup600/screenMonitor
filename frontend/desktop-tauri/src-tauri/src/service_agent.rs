#![cfg(windows)]

use crate::{
    file_change_audit,
    service_backup_queue::ServiceBackupQueue,
    service_config::{program_data_directory, ServiceConfig},
    service_spool::{ServiceEvent, ServiceSpool},
};
use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

pub fn run_collector(running: Arc<AtomicBool>) -> Result<(), String> {
    run_collector_in(program_data_directory(), running)
}

fn run_collector_in(
    data_directory: std::path::PathBuf,
    running: Arc<AtomicBool>,
) -> Result<(), String> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .map_err(|error| error.to_string())?;
    runtime.block_on(collect(data_directory, running))
}

async fn collect(
    data_directory: std::path::PathBuf,
    running: Arc<AtomicBool>,
) -> Result<(), String> {
    if !running.load(Ordering::SeqCst) {
        return Ok(());
    }
    let config_path = data_directory.join("agent-policy.dat");
    let spool = ServiceSpool::new(data_directory.join("service-spool"))?;
    let backups = ServiceBackupQueue::new(data_directory.join("service-backups"))?;
    let (sender, mut receiver) = tokio::sync::mpsc::unbounded_channel();
    let (usb_sender, mut usb_receiver) = tokio::sync::mpsc::unbounded_channel();
    let mut active_config = ServiceConfig::default();
    let mut watcher = None;
    let mut usb_watcher = None;
    let mut removable_baseline = HashSet::new();
    let mut network_baseline = None;
    let usb_evidence_pending = Arc::new(Mutex::new(HashSet::new()));
    let mut config_tick = tokio::time::interval(Duration::from_secs(5));
    let mut removable_tick = tokio::time::interval(Duration::from_secs(2));
    let mut network_tick = tokio::time::interval(Duration::from_secs(15));

    while running.load(Ordering::SeqCst) {
        tokio::select! {
            _ = config_tick.tick() => {
                let next = ServiceConfig::load(&config_path).unwrap_or_default();
                if next != active_config {
                    watcher = if next.file_change_audit_enabled || next.backup_enabled {
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
            event = receiver.recv(), if active_config.file_change_audit_enabled || active_config.backup_enabled => {
                if let Some(event) = event {
                    if active_config.file_change_audit_enabled {
                        let details = serde_json::json!({
                            "destination": event.destination.as_ref().map(|path| path.to_string_lossy().into_owned()),
                            "evidence": "windows_service_filesystem_notification"
                        }).to_string();
                        let item = ServiceEvent::new(event.event_type, event.source.to_string_lossy(), details);
                        let _ = spool.enqueue(&item);
                    }
                    if active_config.backup_enabled && matches!(event.event_type, "FILE_CREATED" | "FILE_MODIFIED" | "FILE_MOVED") {
                        let source = event.destination.unwrap_or(event.source);
                        let queue = backups.clone();
                        tokio::spawn(async move {
                            for _ in 0..6 {
                                tokio::time::sleep(Duration::from_secs(10)).await;
                                if file_has_stabilized(&source, std::time::SystemTime::now(), Duration::from_secs(10)) {
                                    let _ = tokio::task::spawn_blocking(move || queue.stage(&source)).await;
                                    break;
                                }
                            }
                        });
                    }
                }
            }
            event = usb_receiver.recv(), if active_config.usb_file_copy_audit_enabled => {
                if let Some(event) = event {
                    if matches!(event.event_type, "FILE_CREATED" | "FILE_MODIFIED" | "FILE_MOVED") {
                        let source = event.destination.clone().unwrap_or(event.source);
                        let destination = event.destination;
                        let accepted = reserve_usb_evidence(&usb_evidence_pending, &source);
                        if !accepted { continue; }
                        let event_spool = spool.clone();
                        let pending = usb_evidence_pending.clone();
                        tokio::spawn(async move {
                            for _ in 0..6 {
                                tokio::time::sleep(Duration::from_secs(10)).await;
                                if file_has_stabilized(&source, std::time::SystemTime::now(), Duration::from_secs(10)) {
                                    let evidence_source = source.clone();
                                    let evidence_destination = destination.clone();
                                    let details = tokio::task::spawn_blocking(move || {
                                        crate::usb_evidence::file_write_details(&evidence_source, evidence_destination.as_deref())
                                    }).await.unwrap_or_else(|_| serde_json::json!({
                                        "evidence": "windows_service_removable_filesystem_notification",
                                        "confirmedCopy": false,
                                        "evidenceError": "metadata_worker_failed"
                                    }).to_string());
                                    let item = ServiceEvent::new("USB_FILE_WRITTEN", source.to_string_lossy(), details);
                                    let _ = event_spool.enqueue(&item);
                                    if let Ok(mut paths) = pending.lock() { paths.remove(&source); }
                                    return;
                                }
                            }
                            let item = ServiceEvent::new("USB_FILE_WRITTEN", source.to_string_lossy(), serde_json::json!({
                                "destination": destination.map(|path| path.to_string_lossy().into_owned()),
                                "evidence": "windows_service_removable_filesystem_notification",
                                "confirmedCopy": false,
                                "evidenceError": "file_unavailable_or_unstable"
                            }).to_string());
                            let _ = event_spool.enqueue(&item);
                            if let Ok(mut paths) = pending.lock() { paths.remove(&source); }
                        });
                    }
                }
            }
            _ = removable_tick.tick(), if active_config.usb_audit_enabled => {
                let current = crate::platform::removable_drives().into_iter().collect::<HashSet<_>>();
                for (event_type, drive) in drive_changes(&removable_baseline, &current) {
                    let event_spool = spool.clone();
                    tokio::spawn(async move {
                        let query_drive = drive.clone();
                        let device = if event_type == "USB_CONNECTED" {
                            tokio::task::spawn_blocking(move || crate::usb_evidence::removable_drive_evidence(&query_drive))
                                .await
                                .ok()
                        } else { None };
                        let details = serde_json::json!({
                            "evidence": "windows_service_drive_poll",
                            "usbDevice": device
                        }).to_string();
                        let _ = event_spool.enqueue(&ServiceEvent::new(event_type, drive, details));
                    });
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

fn drive_changes(
    previous: &HashSet<String>,
    current: &HashSet<String>,
) -> Vec<(&'static str, String)> {
    let mut changes = current
        .difference(previous)
        .map(|drive| ("USB_CONNECTED", drive.clone()))
        .chain(
            previous
                .difference(current)
                .map(|drive| ("USB_DISCONNECTED", drive.clone())),
        )
        .collect::<Vec<_>>();
    changes.sort_by(|left, right| left.1.cmp(&right.1));
    changes
}

fn file_has_stabilized(
    path: &std::path::Path,
    now: std::time::SystemTime,
    window: Duration,
) -> bool {
    std::fs::metadata(path)
        .ok()
        .filter(|metadata| metadata.is_file())
        .and_then(|metadata| metadata.modified().ok())
        .is_some_and(|modified| now.duration_since(modified).is_ok_and(|age| age >= window))
}

fn reserve_usb_evidence(
    pending: &Mutex<HashSet<std::path::PathBuf>>,
    path: &std::path::Path,
) -> bool {
    pending
        .lock()
        .map(|mut paths| paths.insert(path.to_path_buf()))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stopped_collector_exits_without_collecting() {
        let running = Arc::new(AtomicBool::new(false));
        let result = run_collector(running);
        assert!(result.is_ok(), "{result:?}");
    }

    #[test]
    fn removable_drive_changes_are_labeled_without_claiming_file_transfer() {
        let previous = HashSet::from(["E:\\".to_owned()]);
        let current = HashSet::from(["F:\\".to_owned()]);
        assert_eq!(
            drive_changes(&previous, &current),
            vec![
                ("USB_DISCONNECTED", "E:\\".to_owned()),
                ("USB_CONNECTED", "F:\\".to_owned()),
            ]
        );
    }

    #[test]
    fn collector_stages_a_stable_file_without_a_user_session() {
        let directory = tempfile::Builder::new()
            .prefix("service-agent-integration-")
            .tempdir_in(".")
            .unwrap();
        let watched = directory.path().join("work");
        std::fs::create_dir_all(&watched).unwrap();
        let data = directory.path().join("program-data");
        ServiceConfig {
            backup_enabled: true,
            file_change_audit_enabled: false,
            network_audit_enabled: false,
            usb_audit_enabled: false,
            usb_file_copy_audit_enabled: false,
            roots: vec![watched.to_string_lossy().into_owned()],
        }
        .save(&data.join("agent-policy.dat"))
        .unwrap();
        let running = Arc::new(AtomicBool::new(true));
        let worker_running = running.clone();
        let worker_data = data.clone();
        let worker = std::thread::spawn(move || run_collector_in(worker_data, worker_running));
        std::thread::sleep(Duration::from_secs(1));
        let source = watched.join("offline-plan.txt");
        std::fs::write(&source, b"captured by windows service").unwrap();
        std::thread::sleep(Duration::from_secs(12));
        running.store(false, Ordering::SeqCst);
        worker.join().unwrap().unwrap();

        let queue = ServiceBackupQueue::new(data.join("service-backups")).unwrap();
        let pending = queue.pending().unwrap();
        assert!(!pending.is_empty());
        let captured = pending
            .into_iter()
            .find(|(_, item)| item.source_path == source)
            .unwrap()
            .1;
        std::fs::remove_file(&source).unwrap();
        let restored = watched.join("restored.txt");
        crate::backup_staging::restore_file(&captured.container_path, &restored).unwrap();
        assert_eq!(
            std::fs::read(restored).unwrap(),
            b"captured by windows service"
        );
    }

    #[test]
    fn service_does_not_stage_a_file_until_its_last_write_is_stable() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("editing.txt");
        std::fs::write(&source, b"editing").unwrap();
        let modified = std::fs::metadata(&source).unwrap().modified().unwrap();
        assert!(!file_has_stabilized(
            &source,
            modified + Duration::from_secs(9),
            Duration::from_secs(10)
        ));
        assert!(file_has_stabilized(
            &source,
            modified + Duration::from_secs(11),
            Duration::from_secs(10)
        ));
    }

    #[test]
    fn usb_hash_work_is_reserved_once_per_path() {
        let pending = Mutex::new(HashSet::new());
        let path = std::path::Path::new(r"E:\large-archive.zip");
        assert!(reserve_usb_evidence(&pending, path));
        assert!(!reserve_usb_evidence(&pending, path));
        pending.lock().unwrap().remove(path);
        assert!(reserve_usb_evidence(&pending, path));
    }
}
