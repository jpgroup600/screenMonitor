mod api;
mod auth_token;
mod backup_inventory;
mod backup_manifest;
mod backup_policy;
mod backup_retry;
mod backup_staging;
mod core;
mod data_protection;
mod file_change_audit;
mod monitor;
mod network_audit;
mod offline_queue;
mod platform;
#[cfg(windows)]
pub mod service_agent;
mod service_backup_queue;
mod service_config;
mod service_spool;
mod upload_budget;
mod usb_evidence;
mod usb_risk;

use monitor::MonitorSession;
use offline_queue::OfflineQueue;
use serde::Serialize;
use service_backup_queue::ServiceBackupQueue;
use service_config::ServiceConfig;
use service_spool::ServiceSpool;
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
const BACKUP_STABILITY_WINDOW: Duration = Duration::from_secs(10);

struct AppState {
    session: Mutex<Option<MonitorSession>>,
    reminder: Mutex<Option<ReminderSession>>,
    token: Mutex<Option<String>>,
    queue: Arc<OfflineQueue>,
    backup_staging_directory: PathBuf,
    backup_manifest_path: PathBuf,
    backup_retry_directory: PathBuf,
    restore_directory: PathBuf,
    service_config_path: PathBuf,
    service_spool: Arc<ServiceSpool>,
    upload_budget: upload_budget::UploadBudget,
    service_backups: Arc<ServiceBackupQueue>,
    auth_token_store: auth_token::AuthTokenStore,
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
        let shared_directory = service_config::program_data_directory();
        let upload_budget_path = queue_directory
            .parent()
            .ok_or("Invalid application data directory")?
            .join("daily-upload-usage.dat");
        let auth_token_path = queue_directory
            .parent()
            .ok_or("Invalid application data directory")?
            .join("auth-token.dat");
        Ok(Self {
            session: Mutex::new(None),
            reminder: Mutex::new(None),
            token: Mutex::new(None),
            queue: Arc::new(OfflineQueue::new(queue_directory)?),
            backup_staging_directory,
            backup_manifest_path,
            backup_retry_directory,
            restore_directory,
            service_config_path: shared_directory.join("agent-policy.dat"),
            service_spool: Arc::new(ServiceSpool::new(shared_directory.join("service-spool"))?),
            upload_budget: upload_budget::UploadBudget::new(upload_budget_path),
            service_backups: Arc::new(ServiceBackupQueue::new(
                shared_directory.join("service-backups"),
            )?),
            auth_token_store: auth_token::AuthTokenStore::new(auth_token_path),
        })
    }

    fn save_service_policy(&self, policy: &monitor::MonitoringPolicy) -> Result<(), String> {
        ServiceConfig {
            backup_enabled: policy.backup_enabled,
            file_change_audit_enabled: policy.file_change_audit_enabled,
            network_audit_enabled: policy.network_audit_enabled,
            usb_audit_enabled: policy.usb_audit_enabled,
            usb_file_copy_audit_enabled: policy.usb_file_copy_audit_enabled,
            usb_risk_detection_enabled: policy.usb_risk_detection_enabled,
            roots: platform::fixed_drives(),
        }
        .save(&self.service_config_path)
    }
}

#[tauri::command]
fn store_auth_token(token: String, state: State<'_, AppState>) -> Result<(), String> {
    state.auth_token_store.save(&token)?;
    *state.token.lock().map_err(|error| error.to_string())? = Some(token);
    Ok(())
}

#[tauri::command]
fn load_auth_token(state: State<'_, AppState>) -> Result<Option<String>, String> {
    if let Some(token) = state
        .token
        .lock()
        .map_err(|error| error.to_string())?
        .clone()
    {
        return Ok(Some(token));
    }
    let token = state.auth_token_store.load()?;
    *state.token.lock().map_err(|error| error.to_string())? = token.clone();
    Ok(token)
}

#[tauri::command]
fn clear_auth_token(state: State<'_, AppState>) -> Result<(), String> {
    state.auth_token_store.clear()?;
    *state.token.lock().map_err(|error| error.to_string())? = None;
    Ok(())
}

struct ReminderSession {
    running: Arc<AtomicBool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentStatus {
    agent_version: &'static str,
    agent_mode: String,
    monitoring_state: String,
    pending_queue_items: usize,
}

#[tauri::command]
fn agent_status(state: State<'_, AppState>) -> Result<AgentStatus, String> {
    let user_session_running = state
        .session
        .lock()
        .map_err(|error| error.to_string())?
        .is_some();
    let (agent_mode, monitoring_state) =
        resolve_agent_runtime(user_session_running, windows_service_state());
    Ok(AgentStatus {
        agent_version: env!("CARGO_PKG_VERSION"),
        agent_mode,
        monitoring_state,
        pending_queue_items: total_pending_items(
            state.queue.pending()?.len(),
            state.service_spool.pending()?.len(),
            state.service_backups.pending_count()?,
        ),
    })
}

fn total_pending_items(offline: usize, events: usize, backups: usize) -> usize {
    offline.saturating_add(events).saturating_add(backups)
}

fn resolve_agent_runtime(
    user_session_running: bool,
    service_running: Option<bool>,
) -> (String, String) {
    let mode = if service_running.is_some() {
        "WindowsService+UserSession"
    } else {
        "UserSession"
    };
    let state = if user_session_running || service_running == Some(true) {
        "Running"
    } else {
        "Stopped"
    };
    (mode.to_owned(), state.to_owned())
}

#[cfg(windows)]
fn windows_service_state() -> Option<bool> {
    use windows_service::{
        service::{ServiceAccess, ServiceState},
        service_manager::{ServiceManager, ServiceManagerAccess},
    };
    let manager =
        ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT).ok()?;
    let service = manager
        .open_service("ScreenMonitorAgent", ServiceAccess::QUERY_STATUS)
        .ok()?;
    let status = service.query_status().ok()?;
    Some(matches!(
        status.current_state,
        ServiceState::Running | ServiceState::StartPending
    ))
}

#[cfg(not(windows))]
fn windows_service_state() -> Option<bool> {
    None
}

#[cfg(test)]
mod agent_runtime_tests {
    use super::{resolve_agent_runtime, total_pending_items};

    #[test]
    fn reports_hybrid_mode_when_service_is_installed() {
        assert_eq!(
            resolve_agent_runtime(false, Some(true)),
            ("WindowsService+UserSession".into(), "Running".into())
        );
        assert_eq!(
            resolve_agent_runtime(true, Some(false)),
            ("WindowsService+UserSession".into(), "Running".into())
        );
        assert_eq!(
            resolve_agent_runtime(false, None),
            ("UserSession".into(), "Stopped".into())
        );
    }

    #[test]
    fn queue_health_includes_encrypted_service_backups() {
        assert_eq!(total_pending_items(2, 3, 5), 10);
        assert_eq!(total_pending_items(usize::MAX, 1, 1), usize::MAX);
    }
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
    state.save_service_policy(&policy)?;
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
        Some(state.service_spool.clone()),
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
    state.save_service_policy(&policy)?;
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
        Some(state.service_spool.clone()),
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
    file_change_audit_enabled: bool,
    scan_throttle_milliseconds: u64,
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
    let service_backups = state.service_backups.clone();
    let inventory = tauri::async_runtime::spawn_blocking(move || {
        let policy = backup_policy::BackupPolicy::default();
        let mut inventory = backup_inventory::InventoryResult::default();
        for root in roots {
            let partial = backup_inventory::scan_throttled(
                std::path::Path::new(&root),
                &policy,
                Duration::from_millis(scan_throttle_milliseconds.min(1000)),
            );
            inventory.files.extend(partial.files);
            inventory.skipped_entries += partial.skipped_entries;
            inventory.inaccessible_entries += partial.inaccessible_entries;
        }
        if let Ok(service_files) = service_backups.inventory_files() {
            let existing = inventory
                .files
                .iter()
                .map(|file| file.path.clone())
                .collect::<std::collections::HashSet<_>>();
            inventory.files.extend(
                service_files
                    .into_iter()
                    .filter(|file| !existing.contains(&file.path)),
            );
        }
        inventory
            .files
            .sort_by(|left, right| left.path.cmp(&right.path));
        inventory
    })
    .await
    .map_err(|error| error.to_string())?;
    let manifest = backup_manifest::BackupManifest::load(&state.backup_manifest_path)?;
    let changed = manifest
        .changed_files(&inventory.files)
        .into_iter()
        .collect::<std::collections::HashSet<_>>();
    if file_change_audit_enabled {
        let mut next_manifest = manifest.clone();
        for missing in manifest.missing_files(&inventory.files) {
            let destination = find_relocation(&missing, &inventory.files, &changed);
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
                .is_ok()
            {
                next_manifest.remove(&missing.path);
            }
        }
        next_manifest.save(&state.backup_manifest_path)?;
    }
    let inventory_run = client.start_inventory(&device_id).await?;
    for batch in inventory.files.chunks(500) {
        let files = batch
            .iter()
            .map(|file| api::InventoryFile {
                path: file.path.to_str().unwrap_or_default(),
                size_bytes: file.size_bytes,
                modified_unix_seconds: file.modified_unix_seconds,
                requires_backup: changed.contains(&file.path),
            })
            .collect::<Vec<_>>();
        client
            .add_inventory_batch(&inventory_run.id, &files)
            .await?;
    }
    client.complete_inventory(&inventory_run.id).await?;
    return Ok(IncrementalBackupResult {
        scanned_files: inventory.files.len(),
        changed_files: changed.len(),
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

fn find_relocation(
    missing: &backup_manifest::MissingFile,
    inventory: &[backup_inventory::InventoryFile],
    changed: &std::collections::HashSet<PathBuf>,
) -> Option<PathBuf> {
    let expected_hash = missing.content_hash.as_ref()?;
    inventory
        .iter()
        .filter(|file| changed.contains(&file.path) && file.size_bytes == missing.size_bytes)
        .find(|file| backup_staging::sha256_file(&file.path).ok().as_ref() == Some(expected_hash))
        .map(|file| file.path.clone())
}

#[cfg(test)]
mod relocation_tests {
    use super::*;

    #[test]
    fn moved_file_is_identified_by_size_and_content_hash() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("renamed.txt");
        std::fs::write(&destination, b"company-data").unwrap();
        let hash = backup_staging::sha256_file(&destination).unwrap();
        let inventory = vec![backup_inventory::InventoryFile {
            path: destination.clone(),
            size_bytes: 12,
            modified_unix_seconds: Some(2),
        }];
        let missing = backup_manifest::MissingFile {
            path: PathBuf::from(r"C:\Work\original.txt"),
            size_bytes: 12,
            content_hash: Some(hash),
        };
        assert_eq!(
            find_relocation(
                &missing,
                &inventory,
                &std::collections::HashSet::from([destination.clone()])
            ),
            Some(destination)
        );
    }
}

#[tauri::command]
async fn process_inventory_backup(
    token: String,
    device_id: String,
    resource_throttling_enabled: bool,
    pause_backup_on_battery: bool,
    pause_backup_on_metered_network: bool,
    daily_upload_limit_bytes: u64,
    state: State<'_, AppState>,
) -> Result<IncrementalBackupResult, String> {
    let on_battery =
        resource_throttling_enabled && pause_backup_on_battery && platform::on_battery();
    let on_metered_network = resource_throttling_enabled
        && pause_backup_on_metered_network
        && platform::metered_network();
    if resource_policy_pauses_backup(
        resource_throttling_enabled,
        pause_backup_on_battery,
        on_battery,
        pause_backup_on_metered_network,
        on_metered_network,
    ) {
        return Ok(IncrementalBackupResult {
            scanned_files: 0,
            changed_files: 0,
            uploaded_files: 0,
            failed_files: 0,
            skipped_entries: 0,
            inaccessible_entries: 0,
        });
    }
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
        if resource_throttling_enabled
            && !state.upload_budget.allows(
                item.size_bytes,
                daily_upload_limit_bytes.max(1024 * 1024),
                std::time::SystemTime::now(),
            )?
        {
            continue;
        }
        let staged_by_service =
            state
                .service_backups
                .find(&source, item.size_bytes, item.modified_unix_seconds)?;
        if staged_by_service.is_none()
            && !backup_file_is_stable(
                &source,
                item.size_bytes,
                item.modified_unix_seconds,
                std::time::SystemTime::now(),
                BACKUP_STABILITY_WINDOW,
            )
        {
            continue;
        }
        let result = async {
            if let Some((job_path, pending)) = staged_by_service {
                let upload = client
                    .upload_backup(
                        &device_id,
                        &item.path,
                        &pending.content_hash,
                        pending.plain_size_bytes,
                        pending.source_modified_unix_seconds,
                        &pending.container_path,
                    )
                    .await;
                if upload.is_ok() {
                    state
                        .service_backups
                        .complete(&job_path, &pending.container_path)?;
                }
                return upload.map(|_| pending.content_hash);
            }
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
            upload.map(|_| staged.content_hash)
        }
        .await;
        match result {
            Ok(content_hash) => {
                uploaded += 1;
                if resource_throttling_enabled {
                    state
                        .upload_budget
                        .record(item.size_bytes, std::time::SystemTime::now())?;
                }
                let mut manifest =
                    backup_manifest::BackupManifest::load(&state.backup_manifest_path)?;
                manifest.mark_uploaded(
                    &backup_inventory::InventoryFile {
                        path: source.clone(),
                        size_bytes: item.size_bytes,
                        modified_unix_seconds: item.modified_unix_seconds,
                    },
                    Some(content_hash),
                );
                manifest.save(&state.backup_manifest_path)?;
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

fn resource_policy_pauses_backup(
    enabled: bool,
    pause_on_battery: bool,
    on_battery: bool,
    pause_on_metered_network: bool,
    on_metered_network: bool,
) -> bool {
    enabled
        && ((pause_on_battery && on_battery) || (pause_on_metered_network && on_metered_network))
}

#[cfg(test)]
mod resource_policy_tests {
    use super::resource_policy_pauses_backup;

    #[test]
    fn battery_and_metered_network_pause_independently() {
        assert!(resource_policy_pauses_backup(
            true, true, true, false, false
        ));
        assert!(resource_policy_pauses_backup(
            true, false, false, true, true
        ));
        assert!(!resource_policy_pauses_backup(
            true, false, true, false, true
        ));
        assert!(!resource_policy_pauses_backup(
            false, true, true, true, true
        ));
    }
}

fn backup_file_is_stable(
    source: &std::path::Path,
    expected_size: u64,
    expected_modified_unix_seconds: Option<u64>,
    now: std::time::SystemTime,
    stability_window: Duration,
) -> bool {
    let Ok(metadata) = std::fs::metadata(source) else {
        return false;
    };
    if !metadata.is_file() || metadata.len() != expected_size {
        return false;
    }
    let Ok(modified) = metadata.modified() else {
        return false;
    };
    let current_modified = modified
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|value| value.as_secs());
    if expected_modified_unix_seconds.is_some()
        && current_modified != expected_modified_unix_seconds
    {
        return false;
    }
    now.duration_since(modified)
        .is_ok_and(|age| age >= stability_window)
}

#[cfg(test)]
mod backup_stability_tests {
    use super::*;

    #[test]
    fn changed_or_recent_files_remain_pending_until_stable() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("plan.txt");
        std::fs::write(&source, b"company-plan").unwrap();
        let metadata = std::fs::metadata(&source).unwrap();
        let modified = metadata.modified().unwrap();
        let modified_seconds = modified
            .duration_since(std::time::UNIX_EPOCH)
            .ok()
            .map(|value| value.as_secs());

        assert!(!backup_file_is_stable(
            &source,
            metadata.len() + 1,
            modified_seconds,
            modified + Duration::from_secs(20),
            BACKUP_STABILITY_WINDOW
        ));
        assert!(!backup_file_is_stable(
            &source,
            metadata.len(),
            modified_seconds,
            modified + Duration::from_secs(5),
            BACKUP_STABILITY_WINDOW
        ));
        assert!(backup_file_is_stable(
            &source,
            metadata.len(),
            modified_seconds,
            modified + Duration::from_secs(11),
            BACKUP_STABILITY_WINDOW
        ));
    }
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
            stop_attendance_reminders,
            agent_status,
            store_auth_token,
            load_auth_token,
            clear_auth_token
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
            let status = MenuItem::with_id(app, "status", "에이전트 실행 중", false, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "출퇴근 관리 열기", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "프로그램 종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&status, &show, &quit])?;
            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("출퇴근 관리 프로그램 · 에이전트 실행 중")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Tauri application");
}
