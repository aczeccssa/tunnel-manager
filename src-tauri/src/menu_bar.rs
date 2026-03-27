use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::WindowEvent;
use tauri::{AppHandle, Emitter, Manager, State, Window};
use tracing::warn;

use crate::windowing::{main_window, MAIN_WINDOW_LABEL};

const TRAY_ID: &str = "menu-bar";
const TRAY_STATUS_ITEM_ID: &str = "tray-status";
const TRAY_SHOW_WINDOW_ITEM_ID: &str = "tray-show-window";
const TRAY_QUIT_ITEM_ID: &str = "tray-quit";
const TRAY_PROFILE_MENU_PREFIX: &str = "tray-profile";
const TRAY_PROFILE_START_PREFIX: &str = "tray-profile-start";
const TRAY_PROFILE_STOP_PREFIX: &str = "tray-profile-stop";
const MENU_BAR_PROFILE_ACTION_EVENT: &str = "menu-bar-profile-action";
const TRAY_UNAVAILABLE_MESSAGE: &str =
    "System tray is not available on this device or desktop environment";

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum CloseAction {
    #[default]
    HideToMenuBar,
    Quit,
}

#[derive(Default)]
pub struct MenuBarState {
    pub enabled: Mutex<bool>,
    pub close_action: Mutex<CloseAction>,
    pub status: Mutex<String>,
    pub profiles: Mutex<Vec<MenuBarProfile>>,
    pub quitting: AtomicBool,
    pub available: Mutex<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MenuBarProfile {
    pub id: String,
    pub name: String,
    pub status: String,
    pub can_start: bool,
    pub can_stop: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct MenuBarProfileActionPayload {
    profile_id: String,
    action: String,
}

pub fn show_main_window(app: &AppHandle, state: &MenuBarState) -> Result<(), String> {
    let window = main_window(app)?;
    #[cfg(target_os = "macos")]
    app.set_dock_visibility(true).map_err(|e| e.to_string())?;
    let _ = window.unminimize();
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    sync_dock_visibility(app, state)
}

fn tray_available(app: &AppHandle) -> bool {
    *app.state::<Arc<MenuBarState>>().available.lock()
}

fn set_tray_available(app: &AppHandle, available: bool) {
    *app.state::<Arc<MenuBarState>>().available.lock() = available;
}

fn get_tray(app: &AppHandle) -> Result<tauri::tray::TrayIcon<tauri::Wry>, String> {
    if !tray_available(app) {
        return Err(TRAY_UNAVAILABLE_MESSAGE.to_string());
    }

    app.tray_by_id(TRAY_ID)
        .ok_or_else(|| TRAY_UNAVAILABLE_MESSAGE.to_string())
}

#[cfg(target_os = "macos")]
fn update_tray_title(app: &AppHandle, title: &str) -> Result<(), String> {
    let tray = get_tray(app)?;
    tray.set_title(Some(title)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(format!("SSH Tunnel Manager: {title}")))
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
fn update_tray_title(_app: &AppHandle, _title: &str) -> Result<(), String> {
    Ok(())
}

fn build_menu_bar_menu(app: &AppHandle, status: &str) -> Result<Menu<tauri::Wry>, String> {
    let menu = Menu::new(app).map_err(|e| e.to_string())?;
    append_status_items(app, &menu, status)?;
    let profiles = app.state::<Arc<MenuBarState>>().profiles.lock().clone();
    append_profile_items(app, &menu, &profiles)?;
    append_global_items(app, &menu)?;

    Ok(menu)
}

fn append_status_items(
    app: &AppHandle,
    menu: &Menu<tauri::Wry>,
    status: &str,
) -> Result<(), String> {
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
    menu.append(&separator).map_err(|e| e.to_string())
}

fn append_profile_items(
    app: &AppHandle,
    menu: &Menu<tauri::Wry>,
    profiles: &[MenuBarProfile],
) -> Result<(), String> {
    for profile in profiles {
        let submenu = build_menu_bar_profile_submenu(app, profile)?;
        menu.append(&submenu).map_err(|e| e.to_string())?;
    }

    if profiles.is_empty() {
        return Ok(());
    }

    let profile_separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    menu.append(&profile_separator).map_err(|e| e.to_string())
}

fn append_global_items(app: &AppHandle, menu: &Menu<tauri::Wry>) -> Result<(), String> {
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
    menu.append(&quit_item).map_err(|e| e.to_string())
}

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

fn update_status_menu_item(app: &AppHandle, status: &str) -> Result<(), String> {
    let tray = get_tray(app)?;
    let menu = build_menu_bar_menu(app, status)?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

pub fn set_menu_bar_visible(app: &AppHandle, visible: bool) -> Result<(), String> {
    let Ok(tray) = get_tray(app) else {
        return Ok(());
    };

    tray.set_visible(visible).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
pub fn sync_dock_visibility(app: &AppHandle, state: &MenuBarState) -> Result<(), String> {
    let enabled = *state.enabled.lock();
    let window = main_window(app)?;
    let is_visible = window.is_visible().map_err(|e| e.to_string())?;
    app.set_dock_visibility(!enabled || is_visible)
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn sync_dock_visibility(_app: &AppHandle, _state: &MenuBarState) -> Result<(), String> {
    Ok(())
}

fn hide_main_window_to_menu_bar(app: &AppHandle, state: &MenuBarState) -> Result<(), String> {
    let window = main_window(app)?;
    window.hide().map_err(|e| e.to_string())?;
    sync_dock_visibility(app, state)
}

fn should_hide_to_menu_bar(state: &MenuBarState) -> bool {
    *state.enabled.lock() && *state.close_action.lock() == CloseAction::HideToMenuBar
}

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

pub fn build_menu_bar(app: &AppHandle) -> Result<(), String> {
    let menu = build_menu_bar_menu(app, "Idle")?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("SSH Tunnel Manager: Idle");

    #[cfg(target_os = "macos")]
    {
        builder = builder.title("Idle").icon_as_template(true);
    }

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    match builder.build(app) {
        Ok(_) => {
            set_tray_available(app, true);
            Ok(())
        }
        Err(err) => {
            set_tray_available(app, false);
            warn!("Failed to initialize system tray: {err}");
            Ok(())
        }
    }
}

#[tauri::command]
pub fn set_menu_bar_mode(
    enabled: bool,
    app: AppHandle,
    menu_bar_state: State<'_, Arc<MenuBarState>>,
) -> Result<(), String> {
    if enabled && !tray_available(&app) {
        return Err(TRAY_UNAVAILABLE_MESSAGE.to_string());
    }

    {
        let mut current = menu_bar_state.enabled.lock();
        *current = enabled;
    }

    set_menu_bar_visible(&app, enabled)?;
    sync_dock_visibility(&app, menu_bar_state.inner().as_ref())
}

#[tauri::command]
pub fn set_close_action(
    action: CloseAction,
    menu_bar_state: State<'_, Arc<MenuBarState>>,
) -> Result<(), String> {
    let mut current = menu_bar_state.close_action.lock();
    *current = action;
    Ok(())
}

#[tauri::command]
pub fn sync_menu_bar_status(status: String, app: AppHandle) -> Result<(), String> {
    {
        let menu_bar_state = app.state::<Arc<MenuBarState>>();
        let mut current = menu_bar_state.status.lock();
        *current = status.clone();
    }

    if tray_available(&app) {
        update_status_menu_item(&app, &status)?;
        update_tray_title(&app, &status)?;
    }

    Ok(())
}

#[tauri::command]
pub fn sync_menu_bar_profiles(
    profiles: Vec<MenuBarProfile>,
    app: AppHandle,
    menu_bar_state: State<'_, Arc<MenuBarState>>,
) -> Result<(), String> {
    {
        let mut current = menu_bar_state.profiles.lock();
        *current = profiles;
    }

    if tray_available(&app) {
        let current_status = menu_bar_state.status.lock().clone();
        update_status_menu_item(&app, &current_status)?;
    }

    Ok(())
}

pub fn handle_menu_event(app: &AppHandle, event: &MenuEvent) {
    let event_id = event.id();
    if event_id.as_ref() == TRAY_SHOW_WINDOW_ITEM_ID {
        handle_show_window_event(app);
        return;
    }

    if event_id.as_ref() == TRAY_QUIT_ITEM_ID {
        handle_quit_event(app);
        return;
    }

    if let Some(profile_id) = profile_action_id(event_id.as_ref(), TRAY_PROFILE_START_PREFIX) {
        emit_profile_action_with_warning(app, profile_id, "start");
        return;
    }

    if let Some(profile_id) = profile_action_id(event_id.as_ref(), TRAY_PROFILE_STOP_PREFIX) {
        emit_profile_action_with_warning(app, profile_id, "stop");
    }
}

fn handle_show_window_event(app: &AppHandle) {
    let menu_bar_state = app.state::<Arc<MenuBarState>>();
    if let Err(err) = show_main_window(app, menu_bar_state.inner().as_ref()) {
        warn!("Failed to show window from tray: {err}");
    }
}

fn handle_quit_event(app: &AppHandle) {
    let menu_bar_state = app.state::<Arc<MenuBarState>>();
    menu_bar_state.quitting.store(true, Ordering::SeqCst);
    app.exit(0);
}

fn profile_action_id(id: &str, prefix: &str) -> Option<String> {
    id.starts_with(prefix)
        .then(|| id.split_once(':').map(|(_, value)| value.to_string()))
        .flatten()
}

fn emit_profile_action_with_warning(app: &AppHandle, profile_id: String, action: &str) {
    if let Err(err) = emit_menu_bar_profile_action(app, profile_id, action) {
        warn!("Failed to emit tray {action} action: {err}");
    }
}

fn handle_main_window_close_event(
    app: &AppHandle,
    state: &Arc<MenuBarState>,
    api: &tauri::CloseRequestApi,
) {
    if state.quitting.load(Ordering::SeqCst) || !should_hide_to_menu_bar(state.as_ref()) {
        return;
    }

    api.prevent_close();
    if let Err(err) = hide_main_window_to_menu_bar(app, state.as_ref()) {
        warn!("Failed to hide window to tray: {err}");
    }
}

fn handle_main_window_focus_event(app: &AppHandle, state: &Arc<MenuBarState>) {
    if let Err(err) = sync_dock_visibility(app, state.as_ref()) {
        warn!("Failed to sync Dock visibility on focus: {err}");
    }
}

pub fn handle_window_event(window: &Window, event: &WindowEvent) {
    let app = window.app_handle();
    let menu_bar_state = app.state::<Arc<MenuBarState>>();

    match event {
        WindowEvent::CloseRequested { api, .. } if window.label() == MAIN_WINDOW_LABEL => {
            handle_main_window_close_event(app, &menu_bar_state, api);
        }
        WindowEvent::Focused(true) if window.label() == MAIN_WINDOW_LABEL => {
            handle_main_window_focus_event(app, &menu_bar_state);
        }
        _ => {}
    }
}
