import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import type { TunnelProfile } from "./types";
import type { CloseAction, MenuBarStatus, UpdateChannel, UpdateInfo } from "./types";

// Re-export TunnelProfile from Rust side
export interface RustTunnelProfile {
  id: string;
  name: string;
  ssh_host: string;
  ssh_port: number;
  username: string;
  auth_type: "PASSWORD" | "SSH_KEY";
  mode: "LOCAL" | "REMOTE" | "DYNAMIC";
  local_bind_host?: string;
  local_port?: number;
  remote_host?: string;
  remote_port?: number;
  remote_bind_host?: string;
  local_target_host?: string;
  local_target_port?: number;
  private_key_path?: string;
}

export interface TunnelStartResult {
  pid: number;
  status: "CONNECTING";
}

export interface TunnelStatusResult {
  running: boolean;
  pid: number | null;
  exit_code: number | null;
  ready: boolean;
  last_error: string | null;
  stderr_tail: string | null;
}

export interface UpdateCheckResult {
  configured: boolean;
  currentVersion: string;
  update: UpdateInfo | null;
  message?: string;
}

export interface MenuBarTunnelProfile {
  id: string;
  name: string;
  status: string;
  canStart: boolean;
  canStop: boolean;
}

export type OnboardingAction = "continue" | "create_profile" | "open_settings";
export interface MainWindowNavigationPayload {
  action: "open_settings" | "create_profile";
}

function normalizeOptional(value?: string): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Convert frontend profile to Rust profile
export function toRustProfile(profile: TunnelProfile): RustTunnelProfile {
  return {
    id: profile.id,
    name: profile.name,
    ssh_host: profile.sshHost.trim(),
    ssh_port: profile.sshPort,
    username: profile.username.trim(),
    auth_type: profile.authType,
    mode: profile.mode,
    local_bind_host: normalizeOptional(profile.localBindHost),
    local_port: profile.localPort,
    remote_host: normalizeOptional(profile.remoteHost),
    remote_port: profile.remotePort,
    remote_bind_host: normalizeOptional(profile.remoteBindHost),
    local_target_host: normalizeOptional(profile.localTargetHost),
    local_target_port: profile.localTargetPort,
    private_key_path: normalizeOptional(profile.privateKeyPath),
  };
}

// Tauri command wrappers
export const TauriCommands = {
  startTunnel: (profile: RustTunnelProfile, password?: string) =>
    invoke<TunnelStartResult>("start_tunnel", { profile, password }),

  stopTunnel: (profileId: string) =>
    invoke<void>("stop_tunnel", { profileId }),

  getTunnelStatus: (profileId: string) =>
    invoke<TunnelStatusResult>(
      "get_tunnel_status",
      { profileId }
    ),

  getSshBinaryPath: () =>
    invoke<string>("get_ssh_binary_path"),

  getSshVersion: () =>
    invoke<string>("get_ssh_version"),

  checkPortAvailable: (port: number) =>
    invoke<boolean>("check_port_available", { port }),

  storeKeychain: (service: string, account: string, password: string) =>
    invoke<void>("store_keychain", { service, account, password }),

  retrieveKeychain: (service: string, account: string) =>
    invoke<string | null>("retrieve_keychain", { service, account }),

  deleteKeychain: (service: string, account: string) =>
    invoke<void>("delete_keychain", { service, account }),

  getSystemTheme: () =>
    invoke<string>("get_system_theme"),

  openUrl: (url: string) =>
    invoke<void>("open_url", { url }),

  getAppVersion: () =>
    invoke<string>("get_app_version"),

  checkForAppUpdate: (channel: UpdateChannel) =>
    invoke<UpdateCheckResult>("check_for_app_update", { channel }),

  downloadAndInstallAppUpdate: (manifestUrl: string) =>
    invoke<void>("download_and_install_app_update", { manifestUrl }),

  setMenuBarMode: (enabled: boolean) =>
    invoke<void>("set_menu_bar_mode", { enabled }),

  setCloseAction: (action: CloseAction) =>
    invoke<void>("set_close_action", { action }),

  syncMenuBarStatus: (status: MenuBarStatus) =>
    invoke<void>("sync_menu_bar_status", { status }),

  syncMenuBarProfiles: (profiles: MenuBarTunnelProfile[]) =>
    invoke<void>("sync_menu_bar_profiles", { profiles }),

  completeOnboarding: (action: OnboardingAction) =>
    invoke<void>("complete_onboarding", { action }),

  reopenOnboarding: () =>
    invoke<void>("reopen_onboarding"),

  takePendingMainWindowAction: () =>
    invoke<MainWindowNavigationPayload | null>("take_pending_main_window_action"),

  getDevShowGuideOnLaunch: () =>
    invoke<boolean>("get_dev_show_guide_on_launch"),

  setDevShowGuideOnLaunch: (enabled: boolean) =>
    invoke<void>("set_dev_show_guide_on_launch", { enabled }),

  restartApp: () => relaunch(),
};
