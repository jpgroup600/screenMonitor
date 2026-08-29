mod api;
mod core;
mod monitor;
mod platform;

use monitor::MonitorSession;
use std::{sync::Mutex, time::Duration};
use tauri::{Manager, State};
use tauri_plugin_notification::NotificationExt;

const BACKEND_URL: &str = "https://api-production-18d6.up.railway.app/api";

#[derive(Default)]
struct AppState {
    session: Mutex<Option<MonitorSession>>,
    token: Mutex<Option<String>>,
}

#[tauri::command]
fn start_monitoring(
    token: String,
    interval_ms: u64,
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
    ));
    Ok(())
}

#[tauri::command]
fn start_attendance_monitoring(token: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut session = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(existing) = session.take() {
        existing.stop();
    }
    *state.token.lock().map_err(|e| e.to_string())? = Some(token.clone());
    *session = Some(monitor::spawn(
        BACKEND_URL.into(),
        token,
        Some(Duration::from_secs(10 * 60)),
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
async fn capture_screenshot(state: State<'_, AppState>) -> Result<(), String> {
    let token = state
        .token
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("No active session")?;
    monitor::capture_and_upload(&api::ApiClient::new(BACKEND_URL.into(), token)).await
}

#[tauri::command]
fn show_attendance_reminder(app: tauri::AppHandle) -> Result<(), String> {
    app.notification()
        .builder()
        .title("출퇴근 관리 프로그램")
        .body("출근 기록이 없습니다. 출근 버튼을 눌러주세요.")
        .show()
        .map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            start_monitoring,
            start_attendance_monitoring,
            stop_monitoring,
            capture_screenshot,
            show_attendance_reminder
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
