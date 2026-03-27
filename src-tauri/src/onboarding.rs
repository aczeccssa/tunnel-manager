use crate::menu_bar::{show_main_window, MenuBarState};
use crate::windowing::{
    create_or_focus_onboarding_window, main_window, onboarding_window,
    queue_main_window_navigation, MainWindowNavigationAction, PendingNavigationState,
};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

const ONBOARDING_STATE_FILE: &str = "onboarding-state.json";

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingState {
    onboarding_seen: bool,
    onboarding_completed_at: Option<String>,
    dev_show_on_every_launch: bool,
}

pub struct OnboardingStateStore {
    path: PathBuf,
    state: Mutex<OnboardingState>,
}

impl OnboardingStateStore {
    pub fn new(path: PathBuf) -> Self {
        let state = fs::read_to_string(&path)
            .ok()
            .and_then(|raw| serde_json::from_str::<OnboardingState>(&raw).ok())
            .unwrap_or_default();

        Self {
            path,
            state: Mutex::new(state),
        }
    }

    pub fn has_seen(&self) -> bool {
        self.state.lock().onboarding_seen
    }

    pub fn should_force_show_in_dev(&self) -> bool {
        #[cfg(debug_assertions)]
        {
            return self.state.lock().dev_show_on_every_launch;
        }

        #[cfg(not(debug_assertions))]
        {
            false
        }
    }

    pub fn mark_seen(&self) -> Result<(), String> {
        let mut state = self.state.lock();
        if !state.onboarding_seen {
            state.onboarding_seen = true;
            state.onboarding_completed_at = Some(chrono::Utc::now().to_rfc3339());
            self.save_locked(&state)?;
        }
        Ok(())
    }

    fn save_locked(&self, state: &OnboardingState) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let raw = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
        fs::write(&self.path, raw).map_err(|e| e.to_string())
    }

    pub fn set_dev_show_on_every_launch(&self, enabled: bool) -> Result<(), String> {
        let mut state = self.state.lock();
        state.dev_show_on_every_launch = enabled;
        self.save_locked(&state)
    }

    pub fn get_dev_show_on_every_launch(&self) -> bool {
        self.state.lock().dev_show_on_every_launch
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OnboardingAction {
    Continue,
    CreateProfile,
    OpenSettings,
}

pub fn onboarding_state_path(app_data: &std::path::Path) -> PathBuf {
    app_data.join(ONBOARDING_STATE_FILE)
}

fn open_main_window_with_action(
    app: &AppHandle,
    menu_bar_state: &MenuBarState,
    action: Option<MainWindowNavigationAction>,
) -> Result<(), String> {
    show_main_window(app, menu_bar_state)?;
    if let Some(action) = action {
        let pending_navigation = app.state::<Arc<PendingNavigationState>>();
        queue_main_window_navigation(app, pending_navigation.inner().as_ref(), action)?;
    }
    Ok(())
}

pub fn setup_initial_windows(app: &AppHandle) -> Result<(), String> {
    let menu_bar_state = app.state::<Arc<MenuBarState>>();
    let onboarding_state = app.state::<Arc<OnboardingStateStore>>();

    if onboarding_state.has_seen() && !onboarding_state.should_force_show_in_dev() {
        show_main_window(app, menu_bar_state.inner().as_ref())?;
    } else {
        if let Ok(window) = main_window(app) {
            window.hide().map_err(|e| e.to_string())?;
        }
        create_or_focus_onboarding_window(app)?;
        #[cfg(target_os = "macos")]
        app.set_dock_visibility(true).map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn handle_onboarding_window_close(app: &AppHandle) -> Result<(), String> {
    app.state::<Arc<OnboardingStateStore>>().mark_seen()?;
    let menu_bar_state = app.state::<Arc<MenuBarState>>();
    open_main_window_with_action(app, menu_bar_state.inner().as_ref(), None)
}

#[tauri::command]
pub fn complete_onboarding(
    action: OnboardingAction,
    app: AppHandle,
    menu_bar_state: State<'_, Arc<MenuBarState>>,
    onboarding_state: State<'_, Arc<OnboardingStateStore>>,
) -> Result<(), String> {
    onboarding_state.mark_seen()?;

    let navigation = match action {
        OnboardingAction::Continue => None,
        OnboardingAction::CreateProfile => Some(MainWindowNavigationAction::CreateProfile),
        OnboardingAction::OpenSettings => Some(MainWindowNavigationAction::OpenSettings),
    };

    open_main_window_with_action(&app, menu_bar_state.inner().as_ref(), navigation)?;

    if let Some(window) = onboarding_window(&app) {
        window.close().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn reopen_onboarding(app: AppHandle) -> Result<(), String> {
    create_or_focus_onboarding_window(&app)
}

#[tauri::command]
pub fn get_dev_show_guide_on_launch(
    onboarding_state: State<'_, Arc<OnboardingStateStore>>,
) -> bool {
    #[cfg(debug_assertions)]
    {
        onboarding_state.get_dev_show_on_every_launch()
    }

    #[cfg(not(debug_assertions))]
    {
        let _ = onboarding_state;
        false
    }
}

#[tauri::command]
pub fn set_dev_show_guide_on_launch(
    enabled: bool,
    onboarding_state: State<'_, Arc<OnboardingStateStore>>,
) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        onboarding_state.set_dev_show_on_every_launch(enabled)
    }

    #[cfg(not(debug_assertions))]
    {
        let _ = (enabled, onboarding_state);
        Ok(())
    }
}
