// ============================================================
// Core Types - SSH Tunnel Manager
// ============================================================

export type TunnelMode = "LOCAL" | "REMOTE" | "DYNAMIC";
export type AuthType = "PASSWORD" | "SSH_KEY";
export type UpdateChannel = "stable" | "beta";
export type CloseAction = "hide_to_menu_bar" | "quit";
export type MenuBarStatus = "Idle" | "Running" | "Error";
export type RuntimeStatus =
  | "IDLE"
  | "CONNECTING"
  | "RUNNING"
  | "RECONNECTING"
  | "STOPPING"
  | "ERROR";

export interface TunnelProfile {
  id: string;
  name: string;
  notes?: string;
  websiteUrl?: string;

  iconType: "custom" | "generated";
  iconPath?: string;
  generatedIconSeed?: string;

  sshHost: string;
  sshPort: number;
  username: string;
  authType: AuthType;

  rememberPassword?: boolean;
  hasStoredPassword?: boolean;
  passwordRef?: string;
  privateKeyPath?: string;
  passphraseRef?: string;

  mode: TunnelMode;

  localBindHost?: string;
  localPort?: number;

  remoteHost?: string;
  remotePort?: number;
  remoteBindHost?: string;

  localTargetHost?: string;
  localTargetPort?: number;

  autoReconnect?: boolean;
  openUrlAfterStart?: boolean;

  createdAt: string;
  updatedAt: string;
  lastStartedAt?: string;
  lastStoppedAt?: string;
  sortOrder: number;
}

export interface RuntimeState {
  profileId: string;
  status: RuntimeStatus;
  pid?: number;
  startedAt?: string;
  errorMessage?: string;
  lastExitCode?: number;
}

export interface LogRecord {
  id: string;
  profileId: string;
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  summary?: string;
}

export interface ProfileFormData {
  name: string;
  notes?: string;
  websiteUrl?: string;
  iconType: "custom" | "generated";
  iconPath?: string;
  sshHost: string;
  sshPort: number;
  username: string;
  authType: AuthType;
  rememberPassword: boolean;
  hasStoredPassword?: boolean;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
  mode: TunnelMode;
  localBindHost: string;
  localPort?: number;
  remoteHost?: string;
  remotePort?: number;
  remoteBindHost?: string;
  localTargetHost?: string;
  localTargetPort?: number;
  autoReconnect: boolean;
  openUrlAfterStart: boolean;
}

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not_available"
  | "downloading"
  | "downloaded"
  | "installing"
  | "error";

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  channel: UpdateChannel;
  releaseNotes?: string;
  releaseUrl?: string;
  publishedAt?: string;
  manifestUrl: string;
}

export const DEFAULT_FORM_DATA: ProfileFormData = {
  name: "",
  sshHost: "",
  sshPort: 22,
  username: "",
  authType: "SSH_KEY",
  rememberPassword: true,
  mode: "LOCAL",
  localBindHost: "127.0.0.1",
  autoReconnect: false,
  openUrlAfterStart: false,
  iconType: "generated",
};

export const MODE_LABELS: Record<TunnelMode, string> = {
  LOCAL: "Local Forward (-L)",
  REMOTE: "Remote Forward (-R)",
  DYNAMIC: "Dynamic Forward (-D)",
};

export const STATUS_LABELS: Record<RuntimeStatus, string> = {
  IDLE: "Idle",
  CONNECTING: "Connecting",
  RUNNING: "Running",
  RECONNECTING: "Reconnecting",
  STOPPING: "Stopping",
  ERROR: "Error",
};
