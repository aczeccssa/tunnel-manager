mod menu_bar;
mod onboarding;
mod system_commands;
mod tunnel;
mod updater;
mod windowing;

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use menu_bar::{
    build_menu_bar, handle_menu_event, handle_window_event, set_close_action, set_menu_bar_mode,
    set_menu_bar_visible, sync_menu_bar_profiles, sync_menu_bar_status, MenuBarState,
};
use onboarding::{
    complete_onboarding, get_dev_show_guide_on_launch, handle_onboarding_window_close,
    onboarding_state_path, reopen_onboarding, set_dev_show_guide_on_launch, setup_initial_windows,
    OnboardingStateStore,
};
use system_commands::{
    delete_keychain, get_system_theme, open_url, retrieve_keychain, store_keychain,
};
use tauri::Manager;
use tauri::WindowEvent;
use tunnel::{
    check_port_available, get_ssh_binary_path, get_ssh_version, get_tunnel_status, start_tunnel,
    stop_all_tunnels, stop_tunnel, AppState,
};
use updater::{check_for_app_update, download_and_install_app_update, get_app_version};
use windowing::{take_pending_main_window_action, PendingNavigationState, ONBOARDING_WINDOW_LABEL};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_data = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("tunnel-manager");

    fs::create_dir_all(&app_data).ok();

    let file_appender = tracing_appender::rolling::daily(&app_data, "tunnel-manager.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::fmt()
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(false)
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let app_state = Arc::new(AppState::default());
    let menu_bar_state = Arc::new(MenuBarState::default());
    let onboarding_state = Arc::new(OnboardingStateStore::new(onboarding_state_path(&app_data)));
    let pending_navigation = Arc::new(PendingNavigationState::default());
    let app_state_for_run = Arc::clone(&app_state);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(app_state)
        .manage(Arc::clone(&menu_bar_state))
        .manage(Arc::clone(&onboarding_state))
        .manage(Arc::clone(&pending_navigation))
        .setup(|app| {
            {
                let menu_bar_state = app.state::<Arc<MenuBarState>>();
                let mut status = menu_bar_state.status.lock();
                *status = "Idle".to_string();
            }

            build_menu_bar(app.handle())?;
            set_menu_bar_visible(app.handle(), true)?;
            setup_initial_windows(app.handle())?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            handle_menu_event(app, &event);
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. })
                && window.label() == ONBOARDING_WINDOW_LABEL
            {
                if let Err(err) = handle_onboarding_window_close(window.app_handle()) {
                    tracing::warn!("Failed to finish onboarding close flow: {err}");
                }
                return;
            }

            handle_window_event(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            get_ssh_binary_path,
            get_ssh_version,
            start_tunnel,
            stop_tunnel,
            get_tunnel_status,
            check_port_available,
            set_menu_bar_mode,
            set_close_action,
            sync_menu_bar_status,
            sync_menu_bar_profiles,
            store_keychain,
            retrieve_keychain,
            delete_keychain,
            get_system_theme,
            open_url,
            complete_onboarding,
            reopen_onboarding,
            take_pending_main_window_action,
            get_dev_show_guide_on_launch,
            set_dev_show_guide_on_launch,
            get_app_version,
            check_for_app_update,
            download_and_install_app_update,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            stop_all_tunnels(&app_state_for_run);
        }
    });
}
