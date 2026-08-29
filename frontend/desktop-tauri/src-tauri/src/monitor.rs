use crate::{
    api::ApiClient,
    core::{scaled_dimensions, ActivityTracker},
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

pub fn spawn(base_url: String, token: String, screenshot_interval: Duration) -> MonitorSession {
    let running = Arc::new(AtomicBool::new(true));
    let task_running = running.clone();
    tauri::async_runtime::spawn(async move {
        let api = ApiClient::new(base_url, token);
        let tracker = Arc::new(Mutex::new(ActivityTracker::default()));
        let mut activity_tick = tokio::time::interval(Duration::from_secs(1));
        let mut screenshot_tick =
            tokio::time::interval(screenshot_interval.max(Duration::from_secs(5)));
        while task_running.load(Ordering::SeqCst) {
            tokio::select! {
                _ = activity_tick.tick() => {
                    let app = if platform::idle_seconds() >= 15 { "idle".into() } else { platform::active_application() };
                    let transition = tracker.lock().await.transition(app);
                    if let Some(name) = transition.ended { let _ = api.app_event("end", &name).await; }
                    if let Some(name) = transition.started { let _ = api.app_event("start", &name).await; }
                }
                _ = screenshot_tick.tick() => { let _ = capture_and_upload(&api).await; }
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
    let screen = Screen::all()
        .map_err(|e| e.to_string())?
        .into_iter()
        .next()
        .ok_or("No monitor found")?;
    let image = screen.capture().map_err(|e| e.to_string())?;
    let (width, height) = scaled_dimensions(image.width(), image.height(), 1280, 720);
    let resized =
        image::imageops::resize(&image, width, height, image::imageops::FilterType::Triangle);
    let path: PathBuf =
        std::env::temp_dir().join(format!("screen-monitor-{}.png", std::process::id()));
    resized.save(&path).map_err(|e| e.to_string())?;
    let result = api.upload(&path).await;
    let _ = tokio::fs::remove_file(path).await;
    result
}
