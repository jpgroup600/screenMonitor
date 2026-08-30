#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
mod windows_agent {
    use std::{
        ffi::OsString,
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
        time::Duration,
    };
    use windows_service::{
        define_windows_service,
        service::{
            ServiceAccess, ServiceAction, ServiceActionType, ServiceErrorControl,
            ServiceFailureActions, ServiceFailureResetPeriod, ServiceInfo, ServiceStartType,
        },
        service::{
            ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
            ServiceType,
        },
        service_control_handler::{self, ServiceControlHandlerResult},
        service_dispatcher,
        service_manager::{ServiceManager, ServiceManagerAccess},
    };

    const SERVICE_NAME: &str = "ScreenMonitorAgent";
    define_windows_service!(ffi_service_main, service_main);

    pub fn run() -> Result<(), String> {
        let command = std::env::args().nth(1);
        if command.as_deref() == Some("install") {
            return install();
        }
        if command.as_deref() == Some("uninstall") {
            return uninstall();
        }
        if command.as_deref() == Some("--console") {
            return screen_monitor_desktop_lib::service_agent::run_collector(Arc::new(
                AtomicBool::new(true),
            ));
        }
        service_dispatcher::start(SERVICE_NAME, ffi_service_main).map_err(|error| error.to_string())
    }

    fn install() -> Result<(), String> {
        let manager = ServiceManager::local_computer(
            None::<&str>,
            ServiceManagerAccess::CONNECT | ServiceManagerAccess::CREATE_SERVICE,
        )
        .map_err(|error| error.to_string())?;
        let executable_path = std::env::current_exe().map_err(|error| error.to_string())?;
        let info = ServiceInfo {
            name: OsString::from(SERVICE_NAME),
            display_name: OsString::from("Screen Monitor Background Agent"),
            service_type: ServiceType::OWN_PROCESS,
            start_type: ServiceStartType::AutoStart,
            error_control: ServiceErrorControl::Normal,
            executable_path,
            launch_arguments: Vec::new(),
            dependencies: Vec::new(),
            account_name: None,
            account_password: None,
        };
        let service = manager
            .create_service(
                &info,
                ServiceAccess::CHANGE_CONFIG
                    | ServiceAccess::QUERY_STATUS
                    | ServiceAccess::START
                    | ServiceAccess::STOP,
            )
            .map_err(|error| error.to_string())?;
        service
            .set_description(
                "Captures policy-approved endpoint file events into an encrypted local spool.",
            )
            .map_err(|error| error.to_string())?;
        service
            .update_failure_actions(recovery_actions())
            .map_err(|error| error.to_string())?;
        service
            .set_failure_actions_on_non_crash_failures(true)
            .map_err(|error| error.to_string())?;
        service
            .start::<&str>(&[])
            .map_err(|error| error.to_string())
    }

    fn recovery_actions() -> ServiceFailureActions {
        ServiceFailureActions {
            reset_period: ServiceFailureResetPeriod::After(Duration::from_secs(24 * 60 * 60)),
            reboot_msg: None,
            command: None,
            actions: Some(
                (0..3)
                    .map(|_| ServiceAction {
                        action_type: ServiceActionType::Restart,
                        delay: Duration::from_secs(60),
                    })
                    .collect(),
            ),
        }
    }

    fn uninstall() -> Result<(), String> {
        let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)
            .map_err(|error| error.to_string())?;
        let service = manager
            .open_service(
                SERVICE_NAME,
                ServiceAccess::QUERY_STATUS | ServiceAccess::STOP | ServiceAccess::DELETE,
            )
            .map_err(|error| error.to_string())?;
        let _ = service.stop();
        service.delete().map_err(|error| error.to_string())
    }

    fn service_main(_arguments: Vec<OsString>) {
        let running = Arc::new(AtomicBool::new(true));
        let signal = running.clone();
        let status_handle =
            match service_control_handler::register(SERVICE_NAME, move |control| match control {
                ServiceControl::Stop => {
                    signal.store(false, Ordering::SeqCst);
                    ServiceControlHandlerResult::NoError
                }
                ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
                _ => ServiceControlHandlerResult::NotImplemented,
            }) {
                Ok(value) => value,
                Err(_) => return,
            };
        let _ = status_handle
            .set_service_status(status(ServiceState::Running, ServiceControlAccept::STOP));
        let _ = screen_monitor_desktop_lib::service_agent::run_collector(running);
        let _ = status_handle
            .set_service_status(status(ServiceState::Stopped, ServiceControlAccept::empty()));
    }

    fn status(
        current_state: ServiceState,
        controls_accepted: ServiceControlAccept,
    ) -> ServiceStatus {
        ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state,
            controls_accepted,
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: Duration::default(),
            process_id: None,
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn service_restarts_three_times_and_resets_failures_daily() {
            let policy = recovery_actions();
            assert_eq!(
                policy.reset_period,
                ServiceFailureResetPeriod::After(Duration::from_secs(24 * 60 * 60))
            );
            let actions = policy.actions.unwrap();
            assert_eq!(actions.len(), 3);
            assert!(actions.iter().all(|action| {
                action.action_type == ServiceActionType::Restart
                    && action.delay == Duration::from_secs(60)
            }));
        }
    }
}

fn main() {
    #[cfg(windows)]
    if let Err(error) = windows_agent::run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
