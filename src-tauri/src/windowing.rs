use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::Emitter;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const ONBOARDING_WINDOW_LABEL: &str = "onboarding";
const MAIN_WINDOW_NAVIGATION_EVENT: &str = "main-window-navigation";

#[derive(Default)]
pub struct PendingNavigationState {
    pub action: Mutex<Option<MainWindowNavigationAction>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct MainWindowNavigationPayload {
    pub action: MainWindowNavigationAction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum MainWindowNavigationAction {
    CreateProfile,
    OpenSettings,
}

pub fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "Main window is not available".to_string())
}

pub fn onboarding_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(ONBOARDING_WINDOW_LABEL)
}

pub fn emit_main_window_navigation(
    app: &AppHandle,
    action: MainWindowNavigationAction,
) -> Result<(), String> {
    let window = main_window(app)?;
    window
        .emit(
            MAIN_WINDOW_NAVIGATION_EVENT,
            MainWindowNavigationPayload { action },
        )
        .map_err(|e| e.to_string())
}

pub fn queue_main_window_navigation(
    app: &AppHandle,
    pending_navigation: &PendingNavigationState,
    action: MainWindowNavigationAction,
) -> Result<(), String> {
    *pending_navigation.action.lock() = Some(action.clone());
    emit_main_window_navigation(app, action)
}

pub fn create_or_focus_onboarding_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = onboarding_window(app) {
        let _ = window.unminimize();
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(
        app,
        ONBOARDING_WINDOW_LABEL,
        WebviewUrl::App("index.html?window=onboarding".into()),
    )
    .title("Welcome to TunnelArch")
    .inner_size(760.0, 500.0)
    .min_inner_size(720.0, 460.0)
    .transparent(true)
    .resizable(false)
    .maximizable(false)
    .center();

    #[cfg(target_os = "macos")]
    let builder = builder
        .hidden_title(true)
        .title_bar_style(tauri::TitleBarStyle::Overlay);

    let window = builder.build().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn take_pending_main_window_action(
    pending_navigation: State<'_, Arc<PendingNavigationState>>,
) -> Option<MainWindowNavigationPayload> {
    pending_navigation
        .action
        .lock()
        .take()
        .map(|action| MainWindowNavigationPayload { action })
}
