import { Modal } from "./ui";
import { SettingsSection, ToggleSwitch } from "./SettingsControls";
import type { ThemeMode } from "../store";
import type { CloseAction, UpdateChannel, UpdateInfo, UpdateStatus } from "../types";
import { useSshInfo } from "../hooks/useSshInfo";

interface SettingsPageProps {
  open: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  currentVersion: string;
  platformName: string;
  updateChannel: UpdateChannel;
  autoCheckUpdates: boolean;
  windowsSshHelpUrl: string;
  onOpenSshHelpUrl: (url: string) => void;
  menuBarModeEnabled: boolean;
  closeAction: CloseAction;
  updateStatus: UpdateStatus;
  updateStatusMessage: string;
  updateErrorMessage?: string;
  availableUpdate: UpdateInfo | null;
  lastCheckedAt?: string;
  onUpdateChannelChange: (channel: UpdateChannel) => void;
  onAutoCheckUpdatesChange: (enabled: boolean) => void;
  onMenuBarModeEnabledChange: (enabled: boolean) => void;
  onCloseActionChange: (action: CloseAction) => void;
  onCheckForUpdates: () => void | Promise<void>;
  onInstallUpdate: () => void | Promise<void>;
  onOpenReleaseNotes: (url: string) => void;
  onReopenOnboarding: () => void | Promise<void>;
  isDevBuild: boolean;
  devShowGuideOnLaunch: boolean;
  onDevShowGuideOnLaunchChange: (enabled: boolean) => void | Promise<void>;
}

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const updateChannelOptions: { value: UpdateChannel; label: string }[] = [
  { value: "stable", label: "Stable" },
  { value: "beta", label: "Beta" },
];

const closeActionOptions: { value: CloseAction; label: string; description: string }[] = [
  {
    value: "hide_to_menu_bar",
    label: "Hide to Tray",
    description: "Keep the app running in the system tray when the main window is closed.",
  },
  {
    value: "quit",
    label: "Quit",
    description: "Exit the app completely when the main window is closed.",
  },
];

export function SettingsPage({
  open,
  onClose,
  themeMode,
  onThemeModeChange,
  currentVersion,
  platformName,
  updateChannel,
  autoCheckUpdates,
  windowsSshHelpUrl,
  onOpenSshHelpUrl,
  menuBarModeEnabled,
  closeAction,
  updateStatus,
  updateStatusMessage,
  updateErrorMessage,
  availableUpdate,
  lastCheckedAt,
  onUpdateChannelChange,
  onAutoCheckUpdatesChange,
  onMenuBarModeEnabledChange,
  onCloseActionChange,
  onCheckForUpdates,
  onInstallUpdate,
  onOpenReleaseNotes,
  onReopenOnboarding,
  isDevBuild,
  devShowGuideOnLaunch,
  onDevShowGuideOnLaunchChange,
}: SettingsPageProps) {
  // SSH diagnostics are fetched lazily so opening the modal reflects the current host environment.
  const { sshPath, sshVersion, sshStatus, sshError, reload } = useSshInfo(open);
  const isWindows = platformName === "windows";
  const isMissingSsh =
    sshError.includes("OpenSSH Client is not installed") ||
    sshError.includes("OpenSSH Client not found") ||
    sshError.includes("SSH client was not found on this system");

  const formatTimestamp = (value?: string) =>
    value
      ? new Date(value).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Never";

  const updateActionBusy = updateStatus === "checking" || updateStatus === "downloading" || updateStatus === "installing";

  return (
    <Modal open={open} onClose={onClose} size="md" showClose={false}>
      <div className="flex flex-col h-full max-h-[90vh]">
        <header className="px-6 py-5 flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-highest/30 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">settings</span>
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Settings</h2>
              <p className="text-[13px] text-on-surface-variant font-label">Runtime environment and local app configuration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        <SettingsSection title="Updates">
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-container-highest px-4 py-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-on-surface">Automatic update checks</div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Check for new releases on startup after a short delay.
                  </p>
                </div>
                <ToggleSwitch checked={autoCheckUpdates} onChange={() => onAutoCheckUpdatesChange(!autoCheckUpdates)} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-on-surface">Release channel</div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Beta lets you receive prerelease builds.
                  </p>
                </div>
                <div className="flex items-center rounded-xl bg-surface-container p-1 shrink-0">
                  {updateChannelOptions.map((option) => {
                    const active = updateChannel === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onUpdateChannelChange(option.value)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-primary text-on-primary shadow-sm"
                            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-surface-container-highest px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-on-surface">Current version</div>
                  <p className="text-xs text-on-surface-variant mt-1">{currentVersion || "Unknown"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void onCheckForUpdates()}
                  disabled={updateActionBusy}
                  className="px-4 py-2 rounded-md text-on-surface bg-surface-container hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  {updateStatus === "checking" ? "Checking..." : "Check for Updates"}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">Last checked</span>
                <span className="text-on-surface font-medium">{formatTimestamp(lastCheckedAt)}</span>
              </div>

              <div className="flex items-start justify-between gap-4 text-sm">
                <span className="text-on-surface-variant">Status</span>
                <span className={`text-right font-medium ${updateErrorMessage ? "text-error" : "text-on-surface"}`}>
                  {updateStatusMessage}
                </span>
              </div>

              {availableUpdate && (
                <div className="rounded-xl bg-surface-container px-4 py-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-on-surface">
                        Version {availableUpdate.version} is available
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1">
                        Published {formatTimestamp(availableUpdate.publishedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onInstallUpdate()}
                      disabled={updateStatus === "downloading" || updateStatus === "installing"}
                      className="px-4 py-2 rounded-md bg-primary text-on-primary font-medium hover:bg-primary-dim transition-colors disabled:opacity-50"
                    >
                      {updateStatus === "downloading" ? "Downloading..." : updateStatus === "installing" ? "Restarting..." : "Update and Restart"}
                    </button>
                  </div>

                  {availableUpdate.releaseNotes && (
                    <p className="text-sm text-on-surface-variant leading-6 whitespace-pre-wrap">
                      {availableUpdate.releaseNotes}
                    </p>
                  )}

                  {availableUpdate.releaseUrl && (
                    <button
                      type="button"
                      onClick={() => onOpenReleaseNotes(availableUpdate.releaseUrl!)}
                      className="text-sm text-primary hover:text-primary-dim transition-colors"
                    >
                      View release notes
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Appearance">
          <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-container-highest px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-on-surface">Theme</div>
              <p className="text-xs text-on-surface-variant mt-1">
                Choose light, dark, or follow the macOS setting.
              </p>
            </div>
            <div className="flex items-center rounded-xl bg-surface-container p-1 shrink-0">
              {themeOptions.map((option) => {
                const active = themeMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onThemeModeChange(option.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="System Tray">
            <div className="space-y-4">
              <div className="rounded-xl bg-surface-container-highest px-4 py-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-on-surface">Tray mode</div>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Keep a persistent tray icon and hide the main window to tray when it is closed.
                    </p>
                  </div>
                  <ToggleSwitch checked={menuBarModeEnabled} onChange={() => onMenuBarModeEnabledChange(!menuBarModeEnabled)} />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-on-surface">Close button behavior</div>
                  <div className="grid gap-2">
                    {closeActionOptions.map((option) => {
                      const active = closeAction === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onCloseActionChange(option.value)}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                            active
                              ? "border-primary bg-primary/8"
                              : "border-outline-variant/40 bg-surface-container hover:bg-surface-container-high"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-sm font-medium text-on-surface">{option.label}</div>
                              <p className="text-xs text-on-surface-variant mt-1 leading-5">
                                {option.description}
                              </p>
                            </div>
                            <span
                              className={`material-symbols-outlined text-lg ${
                                active ? "text-primary" : "text-on-surface-variant"
                              }`}
                            >
                              {active ? "radio_button_checked" : "radio_button_unchecked"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>

        {/* SSH Binary */}
        <SettingsSection title="SSH Configuration">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-highest rounded-xl">
              <div
                className={`w-2 h-2 rounded-full ${
                  sshStatus === "ok"
                    ? "bg-primary"
                    : sshStatus === "error"
                    ? "bg-error"
                    : "bg-on-surface-variant animate-pulse"
                }`}
              />
              <span className="text-sm font-medium text-on-surface">
                {sshPath || "Detecting..."}
              </span>
            </div>
            {sshVersion && (
              <span className="text-xs text-on-surface-variant px-1">
                {sshVersion}
              </span>
            )}
            {sshStatus === "error" && (
              <div className="rounded-xl bg-error/10 border border-error/20 px-4 py-4 space-y-3">
                <p className="text-sm text-error">
                  {isWindows
                    ? "OpenSSH Client not found"
                    : isMissingSsh
                    ? "SSH client not found"
                    : sshError || "SSH client detection failed"}
                </p>
                {isWindows && (
                  <>
                    <p className="text-sm text-on-surface-variant leading-6">
                      Install `OpenSSH Client` from `Settings {" > "} Optional Features`, then click `Re-check`.
                    </p>
                    <div className="rounded-md bg-surface-container px-3 py-3 font-mono text-xs text-on-surface overflow-x-auto">
                      Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenSshHelpUrl(windowsSshHelpUrl)}
                      className="text-sm text-primary hover:text-primary-dim transition-colors"
                    >
                      Open Microsoft Learn guide
                    </button>
                  </>
                )}
                {!isWindows && (
                  <>
                    {isMissingSsh ? (
                      <p className="text-sm text-on-surface-variant leading-6">
                        Install OpenSSH and make sure `ssh` is available on `PATH`, then click `Re-check`.
                      </p>
                    ) : null}
                    {sshError && (
                      <p className="text-sm text-on-surface-variant leading-6">{sshError}</p>
                    )}
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => void reload()}
              className="self-start px-3 py-2 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              Re-check
            </button>
          </div>
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">Version</span>
              <span className="text-on-surface font-medium">{currentVersion || "Unknown"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">Framework</span>
              <span className="text-on-surface font-medium">Tauri 2</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">Platform</span>
              <span className="text-on-surface font-medium">{platformName}</span>
            </div>
            <div className="pt-3">
              <button
                type="button"
                onClick={() => void onReopenOnboarding()}
                className="rounded-md bg-surface-container px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
              >
                Reopen Onboarding
              </button>
            </div>
          </div>
        </SettingsSection>

        {isDevBuild && (
          <SettingsSection title="Developer">
            <div className="rounded-xl bg-surface-container-highest px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-on-surface">Show guide on every launch</div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Dev only. Ignore the first-run flag and reopen the intro guide every time the app starts.
                  </p>
                </div>
                <ToggleSwitch
                  checked={devShowGuideOnLaunch}
                  onChange={() => void onDevShowGuideOnLaunchChange(!devShowGuideOnLaunch)}
                />
              </div>
            </div>
          </SettingsSection>
        )}

        {/* Data */}
        <SettingsSection title="Data Storage">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-on-surface-variant leading-6">
              Profiles are stored locally in your app data directory. Sensitive information (passwords,
              passphrases) is stored in the macOS Keychain.
            </p>
            <p className="text-sm text-on-surface-variant leading-6">
              Copied and pasted profiles copy configuration only. Saved credentials are not carried over.
            </p>
          </div>
        </SettingsSection>

        <div className="flex justify-end pt-4 border-t border-outline-variant/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-on-surface hover:bg-surface-container transition-colors"
          >
            Close
          </button>
        </div>
        </div>
      </div>
    </Modal>
  );
}
