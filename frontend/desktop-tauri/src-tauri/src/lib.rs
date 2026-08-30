mod api;
mod backup_inventory;
mod backup_manifest;
mod backup_policy;
mod backup_retry;
mod backup_staging;
mod core;
mod data_protection;
mod monitor;
mod network_audit;
mod offline_queue;
mod platform;

use monitor::MonitorSession;
use offline_queue::OfflineQueue;
use serde::Serialize;
use std::path::PathBuf;
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

const BACKEND_URL: &str = "https://api-production-18d6.up.railway.app/api";
const ATTENDANCE_REMINDER_INTERVAL: Duration = Duration::from_secs(10 * 60);

struct AppState {
    session: Mutex<Option<MonitorSession>>,
    reminder: Mutex<Option<ReminderSession>>,
    token: Mutex<Option<String>>,
    queue: Arc<OfflineQueue>,
    backup_staging_directory: PathBuf,
    backup_manifest_path: PathBuf,
    backup_retry_directory: PathBuf,
    restore_directory: PathBuf,
}

impl AppState {
    fn new(queue_directory: PathBuf) -> Result<Self, String> {
        let backup_staging_directory = queue_directory
            .parent()
            .ok_or("Invalid application data directory")?
            .join("backup-staging");
        let backup_manifest_path = queue_directory
            .parent()
            .ok_or("Invalid application data directory")?
            .join("backup-manifest.dat");
        let backup_retry_directory = queue_directory
            .parent()
            .ok_or("Invalid application data directory")?
            .join("backup-retry");
        let restore_directory = queue_directory
            .parent()
            .ok_or("Invalid application data directory")?
            .join("restores");
        Ok(Self {
            session: Mutex::new(None),
            reminder: Mutex::new(None),
            token: Mutex::new(None),
            queue: Arc::new(OfflineQueue::new(queue_directory)?),
            backup_staging_directory,
            backup_manifest_path,
            backup_retry_directory,
            restore_directory,
        })
    }
}

struct ReminderSession {
    running: Arc<AtomicBool>,
}

impl ReminderSession {
    fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
fn start_monitoring(
    token: String,
    interval_ms: u64,
    device_id: String,
    policy: monitor::MonitoringPolicy,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(existing) = session.take() {
        existing.stop();
    }
    *state.token.lock().map_err(|e| e.to_string())? = Some(token.clone());
    *session = Some(monitor::spawn(
        BACKEND_URL.into(),
        token,
        Some(Duration::from_millis(interval_ms)),
        state.queue.clone(),
        device_id,
        state.restore_directory.clone(),
        policy,
    ));
    Ok(())
}

#[tauri::command]
fn start_attendance_monitoring(
    token: String,
    device_id: String,
    policy: monitor::MonitoringPolicy,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(existing) = session.take() {
        existing.stop();
    }
    *state.token.lock().map_err(|e| e.to_string())? = Some(token.clone());
    *session = Some(monitor::spawn(
        BACKEND_URL.into(),
        token,
        Some(Duration::from_secs(10 * 60)),
        state.queue.clone(),
        device_id,
        state.restore_directory.clone(),
        policy,
    ));
    Ok(())
}

#[tauri::command]
fn stop_monitoring(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(session) = state.session.lock().map_err(|e| e.to_string())?.take() {
        session.stop();
    }
    Ok(())
}

#[tauri::command]
fn list_removable_drives() -> Vec<String> {
    platform::removable_drives()
}

#[tauri::command]
fn list_fixed_drives() -> Vec<String> {
    platform::fixed_drives()
}

#[tauri::command]
async fn preview_backup_inventory(
    root: String,
) -> Result<backup_inventory::InventoryResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        backup_inventory::scan(
            std::path::Path::new(&root),
            &backup_policy::BackupPolicy::default(),
        )
    })
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
async fn stage_backup_file(source: String, state: State<'_, AppState>) -> Result<String, String> {
    let source = PathBuf::from(source);
    let metadata = std::fs::metadata(&source).map_err(|error| error.to_string())?;
    let policy = backup_policy::BackupPolicy::default();
    if let Some(reason) = policy.exclusion_reason(&source, Some(metadata.len())) {
        return Err(format!("File excluded by backup policy: {reason:?}"));
    }
    let staging_directory = state.backup_staging_directory.clone();
    tauri::async_runtime::spawn_blocking(move || {
        backup_staging::stage_file(&source, &staging_directory)
            .map(|backup| backup.container_path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn upload_backup_file(
    token: String,
    device_id: String,
    source: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let source_path = PathBuf::from(&source);
    let metadata = std::fs::metadata(&source_path).map_err(|error| error.to_string())?;
    if let Some(reason) =
        backup_policy::BackupPolicy::default().exclusion_reason(&source_path, Some(metadata.len()))
    {
        return Err(format!("File excluded by backup policy: {reason:?}"));
    }
    let staged = backup_staging::stage_file(&source_path, &state.backup_staging_directory)?;
    let result = api::ApiClient::new(BACKEND_URL.into(), token)
        .upload_backup(
            &device_id,
            &source,
            &staged.content_hash,
            staged.plain_size_bytes,
            staged.source_modified_unix_seconds,
            &staged.container_path,
        )
        .await;
    if result.is_ok() {
        std::fs::remove_file(&staged.container_path).map_err(|error| error.to_string())?;
    }
    result
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct IncrementalBackupResult {
    scanned_files: usize,
    changed_files: usize,
    uploaded_files: usize,
    failed_files: usize,
    skipped_entries: u64,
    inaccessible_entries: u64,
}

#[tauri::command]
async fn run_incremental_backup(
    token: String,
    device_id: String,
    roots: Vec<String>,
    state: State<'_, AppState>,
) -> Result<IncrementalBackupResult, String> {
    let client = api::ApiClient::new(BACKEND_URL.into(), token.clone());
    if client.active_inventory(&device_id).await?.is_some() {
        return Ok(IncrementalBackupResult {
            scanned_files: 0,
            changed_files: 0,
            uploaded_files: 0,
            failed_files: 0,
            skipped_entries: 0,
            inaccessible_entries: 0,
        });
    }
    let inventory = tauri::async_runtime::spawn_blocking(move || {
        let policy = backup_policy::BackupPolicy::default();
        let mut inventory = backup_inventory::InventoryResult::default();
        for root in roots {
            let partial = backup_inventory::scan(std::path::Path::new(&root), &policy);
            inventory.files.extend(partial.files);
            inventory.skipped_entries += partial.skipped_entries;
            inventory.inaccessible_entries += partial.inaccessible_entries;
        }
        inventory
    })
    .await
    .map_err(|error| error.to_string())?;
    let inventory_run = client.start_inventory(&device_id).await?;
    for batch in inventory.files.chunks(500) {
        let files = batch
            .iter()
            .map(|file| api::InventoryFile {
                path: file.path.to_str().unwrap_or_default(),
                size_bytes: file.size_bytes,
                modified_unix_seconds: file.modified_unix_seconds,
            })
            .collect::<Vec<_>>();
        client
            .add_inventory_batch(&inventory_run.id, &files)
            .await?;
    }
    client.complete_inventory(&inventory_run.id).await?;
    return Ok(IncrementalBackupResult {
        scanned_files: inventory.files.len(),
        changed_files: 0,
        uploaded_files: 0,
        failed_files: 0,
        skipped_entries: inventory.skipped_entries,
        inaccessible_entries: inventory.inaccessible_entries,
    });

    #[allow(unreachable_code)]
    let mut manifest = backup_manifest::BackupManifest::load(&state.backup_manifest_path)?;
    let retry_queue = backup_retry::BackupRetryQueue::new(state.backup_retry_directory.clone())?;
    let client = api::ApiClient::new(BACKEND_URL.into(), token);
    let mut uploaded_files = 0;
    let mut failed_files = 0;

    for (job_path, pending) in retry_queue.pending()? {
        if client
            .upload_backup(
                &pending.device_id,
                &pending.source_path.to_string_lossy(),
                &pending.content_hash,
                pending.plain_size_bytes,
                pending.source_modified_unix_seconds,
                &pending.container_path,
            )
            .await
            .is_err()
        {
            failed_files += 1;
            break;
        }
        let inventory_file = backup_inventory::InventoryFile {
            path: pending.source_path.clone(),
            size_bytes: pending.plain_size_bytes,
            modified_unix_seconds: Some(pending.source_modified_unix_seconds),
        };
        retry_queue.complete(&job_path, &pending.container_path)?;
        manifest.mark_uploaded(&inventory_file, Some(pending.content_hash.clone()));
        manifest.save(&state.backup_manifest_path)?;
        uploaded_files += 1;
    }
    if failed_files > 0 {
        return Ok(IncrementalBackupResult {
            scanned_files: inventory.files.len(),
            changed_files: 0,
            uploaded_files,
            failed_files,
            skipped_entries: inventory.skipped_entries,
            inaccessible_entries: inventory.inaccessible_entries,
        });
    }
    let changed_paths = manifest.changed_files(&inventory.files);
    let changed = changed_paths
        .iter()
        .collect::<std::collections::HashSet<_>>();

    for file in inventory
        .files
        .iter()
        .filter(|file| changed.contains(&file.path))
    {
        let staged = match backup_staging::stage_file(&file.path, &state.backup_staging_directory) {
            Ok(value) => value,
            Err(_) => {
                failed_files += 1;
                break;
            }
        };
        if client
            .upload_backup(
                &device_id,
                &file.path.to_string_lossy(),
                &staged.content_hash,
                staged.plain_size_bytes,
                staged.source_modified_unix_seconds,
                &staged.container_path,
            )
            .await
            .is_err()
        {
            retry_queue.enqueue(&backup_retry::PendingBackup {
                device_id: device_id.clone(),
                source_path: file.path.clone(),
                container_path: staged.container_path.clone(),
                content_hash: staged.content_hash.clone(),
                plain_size_bytes: staged.plain_size_bytes,
                source_modified_unix_seconds: staged.source_modified_unix_seconds,
            })?;
            failed_files += 1;
            break;
        }
        std::fs::remove_file(&staged.container_path).map_err(|error| error.to_string())?;
        manifest.mark_uploaded(file, Some(staged.content_hash.clone()));
        manifest.save(&state.backup_manifest_path)?;
        uploaded_files += 1;
    }

    for missing in manifest.missing_files(&inventory.files) {
        let destination = manifest.relocated_to(&missing, &inventory.files);
        let (event_type, details) = match destination.as_ref() {
            Some(path) => (
                "FILE_MOVED",
                serde_json::json!({ "destination": path }).to_string(),
            ),
            None => ("FILE_DELETED", "{}".to_owned()),
        };
        if client
            .security_event(
                &device_id,
                event_type,
                &missing.path.to_string_lossy(),
                &details,
            )
            .await
            .is_err()
        {
            failed_files += 1;
            break;
        }
        manifest.remove(&missing.path);
        manifest.save(&state.backup_manifest_path)?;
    }

    Ok(IncrementalBackupResult {
        scanned_files: inventory.files.len(),
        changed_files: changed_paths.len(),
        uploaded_files,
        failed_files,
        skipped_entries: inventory.skipped_entries,
        inaccessible_entries: inventory.inaccessible_entries,
    })
}

#[tauri::command]
async fn process_inventory_backup(
    token: String,
    device_id: String,
    state: State<'_, AppState>,
) -> Result<IncrementalBackupResult, String> {
    let client = api::ApiClient::new(BACKEND_URL.into(), token);
    let Some(run) = client.active_inventory(&device_id).await? else {
        return Ok(IncrementalBackupResult {
            scanned_files: 0,
            changed_files: 0,
            uploaded_files: 0,
            failed_files: 0,
            skipped_entries: 0,
            inaccessible_entries: 0,
        });
    };
    if run.status != "BackingUp" {
        return Ok(IncrementalBackupResult {
            scanned_files: 0,
            changed_files: 0,
            uploaded_files: 0,
            failed_files: 0,
            skipped_entries: 0,
            inaccessible_entries: 0,
        });
    }
    let items = client.pending_inventory(&run.id, &device_id, 3).await?;
    let mut uploaded = 0;
    let mut failed = 0;
    for item in items {
        let source = PathBuf::from(&item.path);
        let result = async {
            let staged = backup_staging::stage_file(&source, &state.backup_staging_directory)?;
            let upload = client
                .upload_backup(
                    &device_id,
                    &item.path,
                    &staged.content_hash,
                    staged.plain_size_bytes,
                    staged.source_modified_unix_seconds,
                    &staged.container_path,
                )
                .await;
            if upload.is_ok() {
                let _ = std::fs::remove_file(&staged.container_path);
            }
            upload
        }
        .await;
        match result {
            Ok(()) => {
                uploaded += 1;
                client
                    .inventory_result(&item.id, &device_id, true, None)
                    .await?;
            }
            Err(error) => {
                failed += 1;
                client
                    .inventory_result(&item.id, &device_id, false, Some(&error))
                    .await?;
            }
        }
    }
    Ok(IncrementalBackupResult {
        scanned_files: 0,
        changed_files: 0,
        uploaded_files: uploaded,
        failed_files: failed,
        skipped_entries: 0,
        inaccessible_entries: 0,
    })
}

#[tauri::command]
async fn capture_screenshot(state: State<'_, AppState>) -> Result<(), String> {
    let token = state
        .token
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("No active session")?;
    monitor::capture_and_upload(
        &api::ApiClient::new(BACKEND_URL.into(), token),
        &state.queue,
    )
    .await
}

#[tauri::command]
fn start_attendance_reminders(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut reminder = state.reminder.lock().map_err(|error| error.to_string())?;
    if let Some(existing) = reminder.take() {
        existing.stop();
    }

    let running = Arc::new(AtomicBool::new(true));
    let task_running = running.clone();
    tauri::async_runtime::spawn(async move {
        while task_running.load(Ordering::SeqCst) {
            tokio::time::sleep(ATTENDANCE_REMINDER_INTERVAL).await;
            if !task_running.load(Ordering::SeqCst) {
                break;
            }
            let _ = app
                .notification()
                .builder()
                .title("출퇴근 관리 프로그램")
                .body("출근 기록이 없습니다. 출근 버튼을 눌러주세요.")
                .show();
        }
    });
    *reminder = Some(ReminderSession { running });
    Ok(())
}

#[cfg(test)]
mod reminder_tests {
    use super::*;

    #[test]
    fn attendance_reminder_interval_is_ten_minutes() {
        assert_eq!(ATTENDANCE_REMINDER_INTERVAL, Duration::from_secs(600));
    }
}

#[tauri::command]
fn stop_attendance_reminders(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(reminder) = state
        .reminder
        .lock()
        .map_err(|error| error.to_string())?
        .take()
    {
        reminder.stop();
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--autostart"])
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            start_monitoring,
            start_attendance_monitoring,
            stop_monitoring,
            list_removable_drives,
            list_fixed_drives,
            preview_backup_inventory,
            stage_backup_file,
            upload_backup_file,
            run_incremental_backup,
            process_inventory_backup,
            capture_screenshot,
            start_attendance_reminders,
            stop_attendance_reminders
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            use tauri::{
                menu::{Menu, MenuItem},
                tray::TrayIconBuilder,
            };
            let queue_directory = app.path().app_data_dir()?.join("offline-queue");
            app.manage(AppState::new(queue_directory).map_err(std::io::Error::other)?);
            app.autolaunch().enable()?;
            if core::is_autostart_launch(std::env::args()) {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide()?;
                }
            }
            let show = MenuItem::with_id(app, "show", "Restore", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show])?;
            TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Tauri application");
}
