use crate::{
    api::ApiClient,
    core::{scaled_dimensions, screenshot_file_name, ActivityTracker},
    offline_queue::{OfflineQueue, QueuedRequest},
    platform,
};
use screenshots::Screen;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::sync::Mutex;

pub struct MonitorSession {
    running: Arc<AtomicBool>,
}

impl MonitorSession {
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

pub fn spawn(
    base_url: String,
    token: String,
    screenshot_interval: Option<Duration>,
    queue: Arc<OfflineQueue>,
    device_id: String,
    restore_directory: PathBuf,
) -> MonitorSession {
    let running = Arc::new(AtomicBool::new(true));
    let task_running = running.clone();
    tauri::async_runtime::spawn(async move {
        let api = ApiClient::new(base_url, token);
        let tracker = Arc::new(Mutex::new(ActivityTracker::default()));
        let mut activity_tick = tokio::time::interval(Duration::from_secs(1));
        let mut screenshot_tick = tokio::time::interval(
            screenshot_interval
                .unwrap_or(Duration::from_secs(24 * 60 * 60))
                .max(Duration::from_secs(5)),
        );
        let mut retry_tick = tokio::time::interval(Duration::from_secs(30));
        let mut restore_tick = tokio::time::interval(Duration::from_secs(30));
        let mut network_tick = tokio::time::interval(Duration::from_secs(15));
        let mut network_baseline: Option<
            std::collections::HashSet<crate::network_audit::ExternalConnection>,
        > = None;
        while task_running.load(Ordering::SeqCst) {
            tokio::select! {
                _ = activity_tick.tick() => {
                    let app = if platform::idle_seconds() >= 15 { "idle".into() } else { platform::active_application() };
                    let transition = tracker.lock().await.transition(app);
                    if let Some(name) = transition.ended {
                        if name == "idle" { let _ = api.attendance_idle_event("end").await; }
                        send_or_queue(&api, &queue, QueuedRequest::AppEvent { kind: "end".into(), app_name: name }).await;
                    }
                    if let Some(name) = transition.started {
                        if name == "idle" { let _ = api.attendance_idle_event("start").await; }
                        send_or_queue(&api, &queue, QueuedRequest::AppEvent { kind: "start".into(), app_name: name }).await;
                    }
                }
                _ = screenshot_tick.tick() => {
                    if screenshot_interval.is_some() { let _ = capture_and_upload(&api, &queue).await; }
                }
                _ = retry_tick.tick() => {
                    let _ = retry_pending(&api, &queue).await;
                }
                _ = restore_tick.tick() => {
                    let _ = process_restore_requests(&api, &device_id, &restore_directory).await;
                }
                _ = network_tick.tick() => {
                    if let Ok(current) = tauri::async_runtime::spawn_blocking(crate::network_audit::established_external_connections).await.unwrap_or_else(|error| Err(error.to_string())) {
                        if let Some(previous) = &network_baseline {
                            for connection in crate::network_audit::detect_new(previous, &current).into_iter().take(100) {
                                let source = format!("{}:{}", connection.remote_address, connection.remote_port);
                                let details = serde_json::json!({"processId":connection.process_id,"evidence":"new_external_tcp_connection","confirmedFileTransfer":false}).to_string();
                                let _ = api.security_event(&device_id, "NETWORK_TRANSFER", &source, &details).await;
                            }
                        }
                        network_baseline = Some(current);
                    }
                }
            }
        }
        let final_app = tracker.lock().await.finish();
        if let Some(name) = final_app {
            send_or_queue(
                &api,
                &queue,
                QueuedRequest::AppEvent {
                    kind: "end".into(),
                    app_name: name,
                },
            )
            .await;
        }
    });
    MonitorSession { running }
}

async fn process_restore_requests(
    api: &ApiClient,
    device_id: &str,
    restore_directory: &std::path::Path,
) -> Result<(), String> {
    std::fs::create_dir_all(restore_directory).map_err(|e| e.to_string())?;
    for request in api.pending_restores(device_id).await? {
        let container = restore_directory.join(format!("{}.smbackup", request.id));
        let destination = crate::backup_staging::safe_restore_path(
            std::path::Path::new(&request.original_path),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        );
        let result = async {
            api.download_restore(&request.id, device_id, &container)
                .await?;
            let source = container.clone();
            let output = destination.clone();
            tauri::async_runtime::spawn_blocking(move || {
                crate::backup_staging::restore_file(&source, &output)
            })
            .await
            .map_err(|e| e.to_string())??;
            Ok::<_, String>(destination.to_string_lossy().into_owned())
        }
        .await;
        let _ = std::fs::remove_file(&container);
        match result {
            Ok(path) => {
                api.complete_restore(&request.id, device_id, Ok(&path))
                    .await?
            }
            Err(error) => {
                api.complete_restore(&request.id, device_id, Err(&error))
                    .await?
            }
        }
    }
    Ok(())
}

pub async fn capture_and_upload(api: &ApiClient, queue: &OfflineQueue) -> Result<(), String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;
    if screens.is_empty() {
        return Err("No monitor found".into());
    }

    let mut errors = Vec::new();
    for (monitor_index, screen) in screens.into_iter().enumerate() {
        let result = capture_monitor_and_upload(api, queue, screen, monitor_index).await;
        if let Err(error) = result {
            errors.push(format!("monitor {monitor_index}: {error}"));
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

async fn capture_monitor_and_upload(
    api: &ApiClient,
    queue: &OfflineQueue,
    screen: Screen,
    monitor_index: usize,
) -> Result<(), String> {
    let image = screen.capture().map_err(|e| e.to_string())?;
    let (width, height) = scaled_dimensions(image.width(), image.height(), 1280, 720);
    let resized =
        image::imageops::resize(&image, width, height, image::imageops::FilterType::Triangle);
    let path: PathBuf =
        std::env::temp_dir().join(screenshot_file_name(std::process::id(), monitor_index));
    resized.save(&path).map_err(|e| e.to_string())?;
    let result = api.upload(&path).await;
    if result.is_err() {
        if let Ok(bytes) = tokio::fs::read(&path).await {
            let _ = queue.enqueue(&QueuedRequest::Screenshot { bytes });
        }
    }
    let _ = tokio::fs::remove_file(path).await;
    result
}

async fn dispatch(api: &ApiClient, request: &QueuedRequest) -> Result<(), String> {
    match request {
        QueuedRequest::AppEvent { kind, app_name } => api.app_event(kind, app_name).await,
        QueuedRequest::AttendanceIdle { event } => api.attendance_idle_event(event).await,
        QueuedRequest::Screenshot { bytes } => api.upload_bytes(bytes.clone()).await,
    }
}

async fn send_or_queue(api: &ApiClient, queue: &OfflineQueue, request: QueuedRequest) {
    if dispatch(api, &request).await.is_err() {
        let _ = queue.enqueue(&request);
    }
}

async fn retry_pending(api: &ApiClient, queue: &OfflineQueue) -> Result<(), String> {
    for path in queue.pending()? {
        let request = queue.read(&path)?;
        if dispatch(api, &request).await.is_err() {
            break;
        }
        queue.remove(&path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;

    #[tokio::test]
    async fn retry_removes_only_successfully_delivered_items() {
        let server = MockServer::start();
        let success = server.mock(|when, then| {
            when.method(POST).path("/api/sessionForegroundApp/start");
            then.status(200);
        });
        let directory = tempfile::tempdir().unwrap();
        let queue = OfflineQueue::new(directory.path().to_path_buf()).unwrap();
        queue
            .enqueue(&QueuedRequest::AppEvent {
                kind: "start".into(),
                app_name: "Code.exe".into(),
            })
            .unwrap();

        retry_pending(
            &ApiClient::new(format!("{}/api", server.base_url()), "token".into()),
            &queue,
        )
        .await
        .unwrap();

        success.assert();
        assert!(queue.pending().unwrap().is_empty());
    }

    #[tokio::test]
    async fn retry_keeps_items_when_delivery_still_fails() {
        let server = MockServer::start();
        server.mock(|when, then| {
            when.method(POST).path("/api/sessionForegroundApp/start");
            then.status(503);
        });
        let directory = tempfile::tempdir().unwrap();
        let queue = OfflineQueue::new(directory.path().to_path_buf()).unwrap();
        queue
            .enqueue(&QueuedRequest::AppEvent {
                kind: "start".into(),
                app_name: "Code.exe".into(),
            })
            .unwrap();

        retry_pending(
            &ApiClient::new(format!("{}/api", server.base_url()), "token".into()),
            &queue,
        )
        .await
        .unwrap();

        assert_eq!(queue.pending().unwrap().len(), 1);
    }
}
