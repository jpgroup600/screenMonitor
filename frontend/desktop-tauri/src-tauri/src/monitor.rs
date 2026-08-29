use crate::{
    api::ApiClient,
    core::{scaled_dimensions, screenshot_file_name, ActivityTracker},
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
        while task_running.load(Ordering::SeqCst) {
            tokio::select! {
                _ = activity_tick.tick() => {
                    let app = if platform::idle_seconds() >= 15 { "idle".into() } else { platform::active_application() };
                    let transition = tracker.lock().await.transition(app);
                    if let Some(name) = transition.ended {
                        if name == "idle" { let _ = api.attendance_idle_event("end").await; }
                        let _ = api.app_event("end", &name).await;
                    }
                    if let Some(name) = transition.started {
                        if name == "idle" { let _ = api.attendance_idle_event("start").await; }
                        let _ = api.app_event("start", &name).await;
                    }
                }
                _ = screenshot_tick.tick() => {
                    if screenshot_interval.is_some() { let _ = capture_and_upload(&api).await; }
                }
            }
        }
        let final_app = tracker.lock().await.finish();
        if let Some(name) = final_app {
            let _ = api.app_event("end", &name).await;
        }
    });
    MonitorSession { running }
}

pub async fn capture_and_upload(api: &ApiClient) -> Result<(), String> {
    let screens = Screen::all().map_err(|e| e.to_string())?;
    if screens.is_empty() {
        return Err("No monitor found".into());
    }

    let mut errors = Vec::new();
    for (monitor_index, screen) in screens.into_iter().enumerate() {
        let result = capture_monitor_and_upload(api, screen, monitor_index).await;
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
    let _ = tokio::fs::remove_file(path).await;
    result
}
