mod tunnel;
mod updater;

use keyring::Entry;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tracing::warn;

#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
#[cfg(all(desktop, target_os = "macos"))]
use tauri::tray::TrayIconBuilder;

use tunnel::{
    check_port_available, get_ssh_binary_path, get_ssh_version, get_tunnel_status, start_tunnel,
    stop_all_tunnels, stop_tunnel, AppState,
};
use updater::{check_for_app_update, download_and_install_app_update, get_app_version};
const MAIN_WINDOW_LABEL: &str = "main";

#[cfg(target_os = "macos")]
const TRAY_ID: &str = "menu-bar";
#[cfg(target_os = "macos")]
const TRAY_STATUS_ITEM_ID: &str = "tray-status";
#[cfg(target_os = "macos")]
const TRAY_SHOW_WINDOW_ITEM_ID: &str = "tray-show-window";
#[cfg(target_os = "macos")]
const TRAY_QUIT_ITEM_ID: &str = "tray-quit";
#[cfg(target_os = "macos")]
const TRAY_PROFILE_MENU_PREFIX: &str = "tray-profile";
#[cfg(target_os = "macos")]
const TRAY_PROFILE_START_PREFIX: &str = "tray-profile-start";
#[cfg(target_os = "macos")]
const TRAY_PROFILE_STOP_PREFIX: &str = "tray-profile-stop";
#[cfg(target_os = "macos")]
const MENU_BAR_PROFILE_ACTION_EVENT: &str = "menu-bar-profile-action";

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum CloseAction {
    HideToMenuBar,
    Quit,
}

#[derive(Default)]
struct MenuBarState {
    enabled: Mutex<bool>,
    close_action: Mutex<CloseAction>,
    status: Mutex<String>,
    profiles: Mutex<Vec<MenuBarProfile>>,
    quitting: AtomicBool,
}

impl Default for CloseAction {
    fn default() -> Self {
        Self::HideToMenuBar
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct MenuBarProfile {
    id: String,
    name: String,
    status: String,
    can_start: bool,
    can_stop: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct MenuBarProfileActionPayload {
    profile_id: String,
    action: String,
}

#[cfg(target_os = "macos")]
fn main_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "Main window is not available".to_string())
}

#[cfg(not(target_os = "macos"))]
fn main_window(_app: &AppHandle) -> Result<(), String> {
    Err("Menu bar mode is only available on macOS".to_string())
}

#[cfg(target_os = "macos")]
fn update_tray_title(app: &AppHandle, title: &str) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "Menu bar icon is not available".to_string())?;
    tray.set_title(Some(title)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(format!("SSH Tunnel Manager: {title}")))
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
fn update_tray_title(_app: &AppHandle, _title: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn build_menu_bar_menu(app: &AppHandle, status: &str) -> Result<Menu<tauri::Wry>, String> {
    let menu = Menu::new(app).map_err(|e| e.to_string())?;
    let status_item = MenuItem::with_id(
        app,
        TRAY_STATUS_ITEM_ID,
        format!("Status: {status}"),
        false,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;

    menu.append(&status_item).map_err(|e| e.to_string())?;
    menu.append(&separator).map_err(|e| e.to_string())?;

    let profiles = app.state::<Arc<MenuBarState>>().profiles.lock().clone();
    for profile in profiles {
        let submenu = build_menu_bar_profile_submenu(app, &profile)?;
        menu.append(&submenu).map_err(|e| e.to_string())?;
    }

    if !app.state::<Arc<MenuBarState>>().profiles.lock().is_empty() {
        let profile_separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
        menu.append(&profile_separator).map_err(|e| e.to_string())?;
    }

    let show_window_item = MenuItem::with_id(
        app,
        TRAY_SHOW_WINDOW_ITEM_ID,
        "Show Window",
        true,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let quit_item = MenuItem::with_id(app, TRAY_QUIT_ITEM_ID, "Quit", true, None::<&str>)
        .map_err(|e| e.to_string())?;

    menu.append(&show_window_item).map_err(|e| e.to_string())?;
    menu.append(&quit_item).map_err(|e| e.to_string())?;

    Ok(menu)
}

#[cfg(target_os = "macos")]
fn build_menu_bar_profile_submenu(
    app: &AppHandle,
    profile: &MenuBarProfile,
) -> Result<Submenu<tauri::Wry>, String> {
    let start_item = MenuItem::with_id(
        app,
        format!("{TRAY_PROFILE_START_PREFIX}:{}", profile.id),
        "Start Tunnel",
        profile.can_start,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;
    let stop_item = MenuItem::with_id(
        app,
        format!("{TRAY_PROFILE_STOP_PREFIX}:{}", profile.id),
        "Stop Tunnel",
        profile.can_stop,
        None::<&str>,
    )
    .map_err(|e| e.to_string())?;

    Submenu::with_id_and_items(
        app,
        format!("{TRAY_PROFILE_MENU_PREFIX}:{}", profile.id),
        format!("{} · {}", profile.name, profile.status),
        true,
        &[&start_item, &stop_item],
    )
    .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn update_status_menu_item(app: &AppHandle, status: &str) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "Menu bar icon is not available".to_string())?;
    let menu = build_menu_bar_menu(app, status)?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
fn update_status_menu_item(_app: &AppHandle, _status: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn set_menu_bar_visible(app: &AppHandle, visible: bool) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "Menu bar icon is not available".to_string())?;
    tray.set_visible(visible).map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
fn set_menu_bar_visible(_app: &AppHandle, _visible: bool) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn sync_dock_visibility(app: &AppHandle, state: &MenuBarState) -> Result<(), String> {
    let enabled = *state.enabled.lock();
    let window = main_window(app)?;
    let is_visible = window.is_visible().map_err(|e| e.to_string())?;
    app.set_dock_visibility(!enabled || is_visible)
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
fn sync_dock_visibility(_app: &AppHandle, _state: &MenuBarState) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn show_main_window(app: &AppHandle, state: &MenuBarState) -> Result<(), String> {
    let window = main_window(app)?;
    app.set_dock_visibility(true).map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    sync_dock_visibility(app, state)
}

#[cfg(not(target_os = "macos"))]
fn show_main_window(_app: &AppHandle, _state: &MenuBarState) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn hide_main_window_to_menu_bar(app: &AppHandle, state: &MenuBarState) -> Result<(), String> {
    let window = main_window(app)?;
    window.hide().map_err(|e| e.to_string())?;
    sync_dock_visibility(app, state)
}

#[cfg(not(target_os = "macos"))]
fn hide_main_window_to_menu_bar(_app: &AppHandle, _state: &MenuBarState) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn should_hide_to_menu_bar(state: &MenuBarState) -> bool {
    *state.enabled.lock() && *state.close_action.lock() == CloseAction::HideToMenuBar
}

#[cfg(not(target_os = "macos"))]
fn should_hide_to_menu_bar(_state: &MenuBarState) -> bool {
    false
}

#[cfg(target_os = "macos")]
fn emit_menu_bar_profile_action(
    app: &AppHandle,
    profile_id: String,
    action: &str,
) -> Result<(), String> {
    let window = main_window(app)?;
    window
        .emit(
            MENU_BAR_PROFILE_ACTION_EVENT,
            MenuBarProfileActionPayload {
                profile_id,
                action: action.to_string(),
            },
        )
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
fn emit_menu_bar_profile_action(
    _app: &AppHandle,
    _profile_id: String,
    _action: &str,
) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn build_menu_bar(app: &AppHandle) -> Result<(), String> {
    let menu = build_menu_bar_menu(app, "Idle")?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .title("Idle")
        .tooltip("SSH Tunnel Manager: Idle")
        .icon_as_template(true);

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder.build(app).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn build_menu_bar(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn set_menu_bar_mode(
    enabled: bool,
    app: AppHandle,
    menu_bar_state: State<'_, Arc<MenuBarState>>,
) -> Result<(), String> {
    {
        let mut current = menu_bar_state.enabled.lock();
        *current = enabled;
    }

    set_menu_bar_visible(&app, enabled)?;
    sync_dock_visibility(&app, &menu_bar_state)
}

#[tauri::command]
fn set_close_action(
    action: CloseAction,
    menu_bar_state: State<'_, Arc<MenuBarState>>,
) -> Result<(), String> {
    let mut current = menu_bar_state.close_action.lock();
    *current = action;
    Ok(())
}

#[tauri::command]
fn sync_menu_bar_status(status: String, app: AppHandle) -> Result<(), String> {
    {
        let menu_bar_state = app.state::<Arc<MenuBarState>>();
        let mut current = menu_bar_state.status.lock();
        *current = status.clone();
    }

    update_status_menu_item(&app, &status)?;
    update_tray_title(&app, &status)
}

#[tauri::command]
fn sync_menu_bar_profiles(
    profiles: Vec<MenuBarProfile>,
    app: AppHandle,
    menu_bar_state: State<'_, Arc<MenuBarState>>,
) -> Result<(), String> {
    {
        let mut current = menu_bar_state.profiles.lock();
        *current = profiles;
    }
    let current_status = menu_bar_state.status.lock().clone();
    update_status_menu_item(&app, &current_status)
}

#[tauri::command]
fn store_keychain(service: String, account: String, password: String) -> Result<(), String> {
    let entry = Entry::new(&service, &account).map_err(|e| e.to_string())?;
    entry.set_password(&password).map_err(|e| e.to_string())
}

#[tauri::command]
fn retrieve_keychain(service: String, account: String) -> Result<Option<String>, String> {
    let entry = Entry::new(&service, &account).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_keychain(service: String, account: String) -> Result<(), String> {
    let entry = Entry::new(&service, &account).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn get_system_theme() -> String {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("defaults")
            .args(["read", "-g", "AppleInterfaceStyle"])
            .output();

        if let Ok(out) = output {
            let value = String::from_utf8_lossy(&out.stdout).trim().to_lowercase();
            if value.contains("dark") {
                return "dark".to_string();
            }
        }
        "light".to_string()
    }
    #[cfg(not(target_os = "macos"))]
    {
        "light".to_string()
    }
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

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
        .setup(|app| {
            {
                let menu_bar_state = app.state::<Arc<MenuBarState>>();
                let mut status = menu_bar_state.status.lock();
                *status = "Idle".to_string();
            }
            build_menu_bar(app.handle())?;
            set_menu_bar_visible(app.handle(), true)?;
            update_tray_title(app.handle(), "Idle")?;
            sync_dock_visibility(app.handle(), app.state::<Arc<MenuBarState>>().inner())?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            #[cfg(target_os = "macos")]
            {
                let menu_bar_state = app.state::<Arc<MenuBarState>>();
                match event.id().as_ref() {
                    TRAY_SHOW_WINDOW_ITEM_ID => {
                        if let Err(err) = show_main_window(app, menu_bar_state.inner()) {
                            warn!("Failed to show window from menu bar: {err}");
                        }
                    }
                    TRAY_QUIT_ITEM_ID => {
                        menu_bar_state.quitting.store(true, Ordering::SeqCst);
                        app.exit(0);
                    }
                    id if id.starts_with(TRAY_PROFILE_START_PREFIX) => {
                        if let Some(profile_id) =
                            id.split_once(':').map(|(_, value)| value.to_string())
                        {
                            if let Err(err) = emit_menu_bar_profile_action(app, profile_id, "start")
                            {
                                warn!("Failed to emit menu bar start action: {err}");
                            }
                        }
                    }
                    id if id.starts_with(TRAY_PROFILE_STOP_PREFIX) => {
                        if let Some(profile_id) =
                            id.split_once(':').map(|(_, value)| value.to_string())
                        {
                            if let Err(err) = emit_menu_bar_profile_action(app, profile_id, "stop")
                            {
                                warn!("Failed to emit menu bar stop action: {err}");
                            }
                        }
                    }
                    _ => {}
                }
            }
        })
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            {
                let app = window.app_handle();
                let menu_bar_state = app.state::<Arc<MenuBarState>>();
                match event {
                    WindowEvent::CloseRequested { api, .. }
                        if window.label() == MAIN_WINDOW_LABEL =>
                    {
                        if !menu_bar_state.quitting.load(Ordering::SeqCst)
                            && should_hide_to_menu_bar(menu_bar_state.inner())
                        {
                            api.prevent_close();
                            if let Err(err) =
                                hide_main_window_to_menu_bar(app, menu_bar_state.inner())
                            {
                                warn!("Failed to hide window to menu bar: {err}");
                            }
                        }
                    }
                    WindowEvent::Focused(true) if window.label() == MAIN_WINDOW_LABEL => {
                        if let Err(err) = sync_dock_visibility(app, menu_bar_state.inner()) {
                            warn!("Failed to sync Dock visibility on focus: {err}");
                        }
                    }
                    _ => {}
                }
            }
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
