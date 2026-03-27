import { useState, useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { ProfileList } from "./components/ProfileList";
import { ProfileForm } from "./components/ProfileForm";
import { LogPanel } from "./components/LogPanel";
import { PasswordPrompt } from "./components/PasswordPrompt";
import { SettingsPage } from "./components/SettingsPage";
import { Modal, ToastContainer, useToastStore } from "./components/ui";
import { useProfileStore, useRuntimeStore, useLogsStore, useUIStore, useUpdateStore } from "./store";
import { TauriCommands, toRustProfile } from "./TauriCommands";
import { useTunnelPolling } from "./hooks/useTunnelPolling";
import { useTheme } from "./hooks/useTheme";
import { useAppUpdater } from "./hooks/useAppUpdater";
import { platform } from "@tauri-apps/plugin-os";
import { z } from "zod";
import { STATUS_LABELS } from "./types";
import type { MenuBarStatus, TunnelProfile, ProfileFormData } from "./types";

const isMacOS = platform() === "macos";
const isDevBuild = import.meta.env.DEV;
const MENU_BAR_PROFILE_ACTION_EVENT = "menu-bar-profile-action";
const DEV_PASSWORD_CACHE_KEY = "tunnel-manager-dev-password-cache";
const PROFILE_CLIPBOARD_KIND = "tunnel-manager/profile-config";
const PROFILE_CLIPBOARD_VERSION = 1;
const WINDOWS_SSH_HELP_URL =
  "https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse";
const MAIN_WINDOW_NAVIGATION_EVENT = "main-window-navigation";

const clipboardProfileSchema = z.object({
  kind: z.literal(PROFILE_CLIPBOARD_KIND),
  version: z.literal(PROFILE_CLIPBOARD_VERSION),
  profile: z.object({
    name: z.string().min(1),
    notes: z.string().optional(),
    websiteUrl: z.string().optional(),
    iconType: z.enum(["custom", "generated"]).optional(),
    iconPath: z.string().optional(),
    generatedIconSeed: z.string().optional(),
    sshHost: z.string().min(1),
    sshPort: z.number().int().min(1).max(65535),
    username: z.string().min(1),
    authType: z.enum(["PASSWORD", "SSH_KEY"]),
    rememberPassword: z.boolean().optional(),
    privateKeyPath: z.string().optional(),
    mode: z.enum(["LOCAL", "REMOTE", "DYNAMIC"]),
    localBindHost: z.string().optional(),
    localPort: z.number().int().min(1).max(65535).optional(),
    remoteHost: z.string().optional(),
    remotePort: z.number().int().min(1).max(65535).optional(),
    remoteBindHost: z.string().optional(),
    localTargetHost: z.string().optional(),
    localTargetPort: z.number().int().min(1).max(65535).optional(),
    autoReconnect: z.boolean().optional(),
    openUrlAfterStart: z.boolean().optional(),
  }),
});

type ClipboardProfilePayload = z.infer<typeof clipboardProfileSchema>;

function isMissingSshError(message: string) {
  return (
    message.includes("OpenSSH Client is not installed") ||
    message.includes("OpenSSH Client not found") ||
    message.includes("SSH client was not found on this system")
  );
}

function normalizeTunnelStartError(message: string) {
  if (message.includes("OpenSSH Client is not installed") || message.includes("OpenSSH Client not found")) {
    return {
      cardMessage: "OpenSSH Client is not installed. Install it from Windows Optional Features, then try again.",
      toastMessage: "OpenSSH Client is not installed on Windows. Open Settings > Optional Features and install OpenSSH Client.",
    };
  }

  if (isMissingSshError(message)) {
    return {
      cardMessage: "SSH client is not installed. Install OpenSSH on this device, then try again.",
      toastMessage: "SSH client is not installed. Open Settings for install guidance, then try again.",
    };
  }

  return {
    cardMessage: message,
    toastMessage: `Failed to start: ${message}`,
  };
}

function resolveClipboardIconType(profile: ClipboardProfilePayload["profile"]): "custom" | "generated" {
  if (profile.iconType) {
    return profile.iconType;
  }

  if (profile.iconPath?.trim()) {
    return "custom";
  }

  return "generated";
}

interface MenuBarProfileActionPayload {
  profileId: string;
  action: "start" | "stop";
}

function getMenuBarStatus(states: Record<string, { status: string | undefined }>): MenuBarStatus {
  const runtimeStatuses = Object.values(states).map((state) => state.status);

  if (runtimeStatuses.includes("ERROR")) {
    return "Error";
  }

  if (runtimeStatuses.includes("RUNNING") || runtimeStatuses.includes("CONNECTING")) {
    return "Running";
  }

  return "Idle";
}

function getDevPasswordCache(): Record<string, string> {
  if (!isDevBuild) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(DEV_PASSWORD_CACHE_KEY);
    return raw ? JSON.parse(raw) as Record<string, string> : {};
  } catch {
    return {};
  }
}

function setDevPasswordCache(next: Record<string, string>) {
  if (!isDevBuild) {
    return;
  }

  window.localStorage.setItem(DEV_PASSWORD_CACHE_KEY, JSON.stringify(next));
}

async function writeClipboardText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const el = document.createElement("textarea");
    el.value = value;
    document.body.appendChild(el);
    el.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(el);
    if (!copied) {
      throw new Error("Clipboard write is not available in this environment");
    }
  }
}

async function readClipboardText() {
  if (!navigator.clipboard?.readText) {
    throw new Error("Clipboard read is not available in this environment");
  }

  return navigator.clipboard.readText();
}

function buildClipboardPayload(profile: TunnelProfile): ClipboardProfilePayload {
  return {
    kind: PROFILE_CLIPBOARD_KIND,
    version: PROFILE_CLIPBOARD_VERSION,
    profile: {
      name: profile.name,
      notes: profile.notes,
      websiteUrl: profile.websiteUrl,
      iconType: profile.iconType,
      iconPath: profile.iconPath,
      generatedIconSeed: profile.generatedIconSeed,
      sshHost: profile.sshHost,
      sshPort: profile.sshPort,
      username: profile.username,
      authType: profile.authType,
      rememberPassword: profile.rememberPassword,
      privateKeyPath: profile.privateKeyPath,
      mode: profile.mode,
      localBindHost: profile.localBindHost,
      localPort: profile.localPort,
      remoteHost: profile.remoteHost,
      remotePort: profile.remotePort,
      remoteBindHost: profile.remoteBindHost,
      localTargetHost: profile.localTargetHost,
      localTargetPort: profile.localTargetPort,
      autoReconnect: profile.autoReconnect,
      openUrlAfterStart: profile.openUrlAfterStart,
    },
  };
}

function App() {
  // Tunnel status polling
  useTunnelPolling();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TunnelProfile | null>(null);
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<TunnelProfile | null>(null);
  const [logProfile, setLogProfile] = useState<TunnelProfile | null>(null);
  const [passwordPromptProfile, setPasswordPromptProfile] = useState<TunnelProfile | null>(null);
  const [startingWithPrompt, setStartingWithPrompt] = useState(false);
  const [devShowGuideOnLaunch, setDevShowGuideOnLaunch] = useState(false);
  const sessionPasswordsRef = useRef<Record<string, string>>({});

  const profiles = useProfileStore((s) => s.profiles);
  const runtimeStates = useRuntimeStore((s) => s.states);
  const addProfile = useProfileStore((s) => s.addProfile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const deleteProfile = useProfileStore((s) => s.deleteProfile);
  const setStatus = useRuntimeStore((s) => s.setStatus);
  const setError = useRuntimeStore((s) => s.setError);
  const clearState = useRuntimeStore((s) => s.clearState);
  const addLog = useLogsStore((s) => s.addLog);
  const { add: addToast } = useToastStore();

  const {
    viewMode,
    filterStatus,
    filterType,
    themeMode,
    menuBarModeEnabled,
    closeAction,
    setViewMode,
    setFilterStatus,
    setFilterType,
    setThemeMode,
    setMenuBarModeEnabled,
    setCloseAction,
  } = useUIStore();
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const resolvedTheme = useTheme(themeMode);
  const {
    updateChannel,
    autoCheckUpdates,
    currentVersion,
    lastCheckedAt,
    status: updateStatus,
    statusMessage: updateStatusMessage,
    errorMessage: updateErrorMessage,
    availableUpdate,
    promptOpen: updatePromptOpen,
    hasPendingUpdate,
    showUpdateIndicator,
    checkForUpdates,
    dismissPrompt,
    reopenPrompt,
    installUpdate,
    setUpdateChannel,
    setAutoCheckUpdates,
  } = useAppUpdater();

  const activeCount = profiles.filter(p => runtimeStates[p.id]?.status === 'RUNNING').length;
  const menuBarStatus = getMenuBarStatus(runtimeStates);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === "system") {
      root.removeAttribute("data-theme");
      root.style.colorScheme = resolvedTheme;
      return;
    }

    root.setAttribute("data-theme", themeMode);
    root.style.colorScheme = themeMode;
  }, [themeMode, resolvedTheme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.key !== ",") {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditable =
        target?.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT";

      if (isEditable) {
        return;
      }

      event.preventDefault();
      setSettingsOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isDevBuild) {
      return;
    }

    void TauriCommands.getDevShowGuideOnLaunch()
      .then(setDevShowGuideOnLaunch)
      .catch(() => setDevShowGuideOnLaunch(false));
  }, []);

  useEffect(() => {
    void TauriCommands.setCloseAction(closeAction).catch(() => undefined);

    void TauriCommands.setMenuBarMode(menuBarModeEnabled).catch(() => {
      if (menuBarModeEnabled) {
        setMenuBarModeEnabled(false);
      }
    });
    // Sync persisted tray settings once on startup.
    // Subsequent user changes go through explicit handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void TauriCommands.syncMenuBarStatus(menuBarStatus).catch(() => undefined);
  }, [menuBarStatus]);

  useEffect(() => {
    const menuBarProfiles = profiles.map((profile) => {
      const status = runtimeStates[profile.id]?.status ?? "IDLE";
      return {
        id: profile.id,
        name: profile.name,
        status: STATUS_LABELS[status],
        canStart: status !== "RUNNING" && status !== "CONNECTING" && status !== "STOPPING",
        canStop: status === "RUNNING" || status === "CONNECTING" || status === "STOPPING",
      };
    });

    void TauriCommands.syncMenuBarProfiles(menuBarProfiles).catch(() => undefined);
  }, [profiles, runtimeStates]);

  const getKeychainService = useCallback((profileId: string) => `tunnel-manager.${profileId}`, []);
  const getPasswordAccount = useCallback((profileId: string) => `password.${profileId}`, []);

  const syncStoredPassword = useCallback(
    async (
      profileId: string,
      authType: TunnelProfile["authType"],
      password: string | undefined,
      rememberPassword: boolean,
      hasStoredPassword: boolean
    ) => {
      const service = getKeychainService(profileId);
      const account = getPasswordAccount(profileId);

      if (authType !== "PASSWORD") {
        delete sessionPasswordsRef.current[profileId];
        if (isDevBuild) {
          const cache = getDevPasswordCache();
          delete cache[profileId];
          setDevPasswordCache(cache);
        }
        await TauriCommands.deleteKeychain(service, account);
        return false;
      }

      if (rememberPassword && password) {
        sessionPasswordsRef.current[profileId] = password;
        if (isDevBuild) {
          const cache = getDevPasswordCache();
          cache[profileId] = password;
          setDevPasswordCache(cache);
        }
        await TauriCommands.storeKeychain(service, account, password);
        return true;
      }

      if (!rememberPassword) {
        if (password) {
          sessionPasswordsRef.current[profileId] = password;
          if (isDevBuild) {
            const cache = getDevPasswordCache();
            cache[profileId] = password;
            setDevPasswordCache(cache);
          }
        } else {
          delete sessionPasswordsRef.current[profileId];
          if (isDevBuild) {
            const cache = getDevPasswordCache();
            delete cache[profileId];
            setDevPasswordCache(cache);
          }
        }
        await TauriCommands.deleteKeychain(service, account);
        return false;
      }

      if (password) {
        sessionPasswordsRef.current[profileId] = password;
        if (isDevBuild) {
          const cache = getDevPasswordCache();
          cache[profileId] = password;
          setDevPasswordCache(cache);
        }
      }
      return hasStoredPassword;
    },
    [getKeychainService, getPasswordAccount]
  );

  const startTunnel = useCallback(
    async (
      profile: TunnelProfile,
      password?: string,
      rememberPassword = profile.rememberPassword ?? true
    ) => {
      setStatus(profile.id, "CONNECTING");

      const portToCheck =
        profile.mode === "LOCAL" || profile.mode === "DYNAMIC"
          ? profile.localPort
          : undefined;

      if (portToCheck) {
        const available = await TauriCommands.checkPortAvailable(portToCheck);
        if (!available) {
          throw new Error(`Port ${portToCheck} is already in use`);
        }
      }

      if (profile.authType === "PASSWORD" && password) {
        const hasStoredPassword = await syncStoredPassword(
          profile.id,
          profile.authType,
          password,
          rememberPassword,
          profile.hasStoredPassword ?? false
        );
        updateProfile(profile.id, {
          rememberPassword,
          hasStoredPassword,
        });
      }

      const result = await TauriCommands.startTunnel(toRustProfile(profile), password);
      useRuntimeStore.getState().setPid(profile.id, result.pid);
      setStatus(profile.id, "CONNECTING");
    },
    [setStatus, syncStoredPassword, updateProfile]
  );

  const handleCreate = useCallback(() => {
    setEditingProfile(null);
    setFormOpen(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleEdit = useCallback((profile: TunnelProfile) => {
    setEditingProfile(profile);
    setFormOpen(true);
  }, []);

  const handleSave = useCallback(
    async (formData: ProfileFormData) => {
      const now = new Date().toISOString();
      const profileId = editingProfile?.id ?? crypto.randomUUID();
      const hasStoredPassword = await syncStoredPassword(
        profileId,
        formData.authType,
        formData.password,
        formData.rememberPassword,
        editingProfile?.hasStoredPassword ?? false
      );

      const nextProfile: TunnelProfile = {
        name: formData.name,
        notes: formData.notes,
        websiteUrl: formData.websiteUrl,
        iconType: formData.iconType,
        iconPath: formData.iconPath,
        sshHost: formData.sshHost,
        sshPort: formData.sshPort,
        username: formData.username,
        authType: formData.authType,
        rememberPassword: formData.authType === "PASSWORD" ? formData.rememberPassword : false,
        privateKeyPath: formData.privateKeyPath,
        mode: formData.mode,
        localBindHost: formData.localBindHost,
        localPort: formData.localPort,
        remoteHost: formData.remoteHost,
        remotePort: formData.remotePort,
        remoteBindHost: formData.remoteBindHost,
        localTargetHost: formData.localTargetHost,
        localTargetPort: formData.localTargetPort,
        autoReconnect: formData.autoReconnect,
        openUrlAfterStart: formData.openUrlAfterStart,
        id: profileId,
        generatedIconSeed: formData.name,
        hasStoredPassword,
        createdAt: editingProfile?.createdAt ?? now,
        updatedAt: now,
        sortOrder: editingProfile?.sortOrder ?? 0,
      } as TunnelProfile;

      if (editingProfile) {
        updateProfile(editingProfile.id, nextProfile);
        addToast({ message: "Profile updated", type: "success" });
      } else {
        addProfile(nextProfile);
        addToast({ message: "Profile created", type: "success" });
      }
      setFormOpen(false);
      setEditingProfile(null);
    },
    [editingProfile, updateProfile, addProfile, addToast, syncStoredPassword]
  );

  const handleDelete = useCallback((profile: TunnelProfile) => {
    setDeleteConfirm(profile);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteProfile(deleteConfirm.id);
      clearState(deleteConfirm.id);
      delete sessionPasswordsRef.current[deleteConfirm.id];
      void TauriCommands.deleteKeychain(
        getKeychainService(deleteConfirm.id),
        getPasswordAccount(deleteConfirm.id)
      );
      if (isDevBuild) {
        const cache = getDevPasswordCache();
        delete cache[deleteConfirm.id];
        setDevPasswordCache(cache);
      }
      addToast({ message: "Profile deleted", type: "info" });
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteProfile, clearState, addToast, getKeychainService, getPasswordAccount]);

  const handleDuplicate = useCallback(
    (profile: TunnelProfile) => {
      const now = new Date().toISOString();
      const dup: TunnelProfile = {
        ...profile,
        id: crypto.randomUUID(),
        name: `${profile.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
        lastStartedAt: undefined,
        lastStoppedAt: undefined,
      };
      addProfile(dup);
      addToast({ message: "Profile duplicated", type: "success" });
    },
    [addProfile, addToast]
  );

  const handleCopyConfig = useCallback(
    async (profile: TunnelProfile) => {
      try {
        const payload = buildClipboardPayload(profile);
        await writeClipboardText(JSON.stringify(payload));
        addToast({ message: `Copied config for "${profile.name}"`, type: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addToast({ message: `Failed to copy config: ${message}`, type: "error" });
      }
    },
    [addToast]
  );

  const handleLoadClipboardConfig = useCallback(async (rawText?: string): Promise<ProfileFormData> => {
    const raw = rawText ?? await readClipboardText();
    let decoded: unknown;

    try {
      decoded = JSON.parse(raw);
    } catch {
      throw new Error("Clipboard does not contain a copied profile");
    }

    const parsed = clipboardProfileSchema.safeParse(decoded);

    if (!parsed.success) {
      throw new Error("Clipboard does not contain a copied profile");
    }

    const source = parsed.data.profile;
    const iconType = resolveClipboardIconType(source);
    return {
      name: source.name,
      notes: source.notes ?? "",
      websiteUrl: source.websiteUrl ?? "",
      iconType,
      iconPath: source.iconPath ?? "",
      sshHost: source.sshHost,
      sshPort: source.sshPort,
      username: source.username,
      authType: source.authType,
      rememberPassword: source.rememberPassword ?? true,
      hasStoredPassword: false,
      password: "",
      privateKeyPath: source.privateKeyPath ?? "",
      passphrase: "",
      mode: source.mode,
      localBindHost: source.localBindHost ?? "127.0.0.1",
      localPort: source.localPort,
      remoteHost: source.remoteHost ?? "",
      remotePort: source.remotePort,
      remoteBindHost: source.remoteBindHost ?? "",
      localTargetHost: source.localTargetHost ?? "",
      localTargetPort: source.localTargetPort,
      autoReconnect: source.autoReconnect ?? false,
      openUrlAfterStart: source.openUrlAfterStart ?? false,
    };
  }, []);

  const handleStart = useCallback(
    async (profile: TunnelProfile) => {
      try {
        if (profile.authType === "PASSWORD") {
          let password: string | undefined;
          try {
            password = await TauriCommands.retrieveKeychain(
              getKeychainService(profile.id),
              getPasswordAccount(profile.id)
            ) ?? undefined;
          } catch {
            password = undefined;
          }

          if (!password) {
            password = sessionPasswordsRef.current[profile.id];
          }

          if (!password && isDevBuild) {
            password = getDevPasswordCache()[profile.id];
          }

          if (!password) {
            if (profile.hasStoredPassword) {
              updateProfile(profile.id, { hasStoredPassword: false });
            }
            setPasswordPromptProfile(profile);
            return;
          }

          await startTunnel(profile, password, profile.rememberPassword ?? true);
          return;
        }

        await startTunnel(profile);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const normalized = normalizeTunnelStartError(msg);
        setError(profile.id, normalized.cardMessage);
        addToast({ message: normalized.toastMessage, type: "error" });
      }
    },
    [setError, addToast, startTunnel, getKeychainService, getPasswordAccount, updateProfile]
  );

  const handlePasswordPromptSubmit = useCallback(
    async (password: string, rememberPassword: boolean) => {
      if (!passwordPromptProfile) return;

      setStartingWithPrompt(true);
      try {
        await startTunnel(passwordPromptProfile, password, rememberPassword);
        setPasswordPromptProfile(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const normalized = normalizeTunnelStartError(msg);
        setError(passwordPromptProfile.id, normalized.cardMessage);
        addToast({ message: normalized.toastMessage, type: "error" });
      } finally {
        setStartingWithPrompt(false);
      }
    },
    [passwordPromptProfile, startTunnel, setError, addToast]
  );

  const handleStop = useCallback(
    async (profile: TunnelProfile) => {
      setStatus(profile.id, "STOPPING");
      try {
        await TauriCommands.stopTunnel(profile.id);
        clearState(profile.id);
        updateProfile(profile.id, { lastStoppedAt: new Date().toISOString() });
        addLog({
          id: crypto.randomUUID(),
          profileId: profile.id,
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          summary: "Manually stopped",
        });
        addToast({ message: `Tunnel "${profile.name}" stopped`, type: "info" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(profile.id, msg);
        addToast({ message: `Failed to stop: ${msg}`, type: "error" });
      }
    },
    [setStatus, clearState, updateProfile, addLog, addToast]
  );

  const handleViewLogs = useCallback((profile: TunnelProfile) => {
    setLogProfile(profile);
    setLogPanelOpen(true);
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    try {
      await installUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast({ message: `Update failed: ${message}`, type: "error" });
    }
  }, [addToast, installUpdate]);

  const handleCheckForUpdates = useCallback(async () => {
    const update = await checkForUpdates();
    if (update) {
      addToast({ message: `Version ${update.version} is ready to install`, type: "success" });
      return;
    }

    if (useUpdateStore.getState().status !== "error") {
      addToast({ message: "You're on the latest version", type: "info" });
    }
  }, [addToast, checkForUpdates, updateStatus]);

  const handleDevShowGuideOnLaunchChange = useCallback(
    async (enabled: boolean) => {
      try {
        await TauriCommands.setDevShowGuideOnLaunch(enabled);
        setDevShowGuideOnLaunch(enabled);
        addToast({
          message: enabled
            ? "Guide card will show on every launch in dev mode"
            : "Guide card will only show on first launch again",
          type: "success",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addToast({ message: `Failed to update dev guide setting: ${message}`, type: "error" });
      }
    },
    [addToast]
  );

  const handleMenuBarModeEnabledChange = useCallback(
    async (enabled: boolean) => {
      try {
        await TauriCommands.setMenuBarMode(enabled);
        setMenuBarModeEnabled(enabled);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addToast({ message: `Failed to update tray mode: ${message}`, type: "error" });
      }
    },
    [addToast, setMenuBarModeEnabled]
  );

  const handleCloseActionChange = useCallback(
    async (action: typeof closeAction) => {
      try {
        await TauriCommands.setCloseAction(action);
        setCloseAction(action);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addToast({ message: `Failed to update close behavior: ${message}`, type: "error" });
      }
    },
    [addToast, setCloseAction]
  );

  const handleReopenOnboarding = useCallback(async () => {
    setSettingsOpen(false);
    try {
      await TauriCommands.reopenOnboarding();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addToast({ message: `Failed to open onboarding: ${message}`, type: "error" });
    }
  }, [addToast]);

  useEffect(() => {
    if (!isMacOS) {
      return;
    }

    let unlisten: (() => void) | undefined;

    void listen<MenuBarProfileActionPayload>(MENU_BAR_PROFILE_ACTION_EVENT, ({ payload }) => {
      const profile = useProfileStore.getState().profiles.find((item) => item.id === payload.profileId);
      if (!profile) {
        return;
      }

      if (payload.action === "start") {
        void handleStart(profile);
        return;
      }

      void handleStop(profile);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [handleStart, handleStop]);

  useEffect(() => {
    void TauriCommands.takePendingMainWindowAction().then((payload) => {
      if (!payload) {
        return;
      }

      if (payload.action === "open_settings") {
        handleOpenSettings();
        return;
      }

      handleCreate();
    });
  }, [handleCreate, handleOpenSettings]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen<{ action: "open_settings" | "create_profile" }>(MAIN_WINDOW_NAVIGATION_EVENT, ({ payload }) => {
      if (payload.action === "open_settings") {
        handleOpenSettings();
        return;
      }

      handleCreate();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [handleCreate, handleOpenSettings]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-background font-body">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 bg-background font-headline text-sm font-medium tracking-tight">
        <div data-tauri-drag-region className="h-8 w-full" />
        <div className="flex h-14 items-center px-8">
          <div
            data-tauri-drag-region
            className="flex h-full min-w-0 flex-1 items-center text-base font-bold tracking-tight text-on-surface"
          >
            <span>SSH Tunnel Manager</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center bg-surface-container-low rounded-full px-4 py-1.5 focus-within:ring-2 ring-primary/30 transition-all">
              <span className="material-symbols-outlined text-on-surface-variant text-lg mr-2">search</span>
              <input className="bg-transparent border-none text-xs focus:ring-0 text-on-surface placeholder:text-on-surface-variant w-48 outline-none" placeholder="Quick find..." type="text"/>
            </div>
            <div className="flex items-center gap-2">
              {showUpdateIndicator && (
                <button
                  onClick={() => {
                    setSettingsOpen(true);
                    reopenPrompt();
                  }}
                  className="relative text-primary hover:text-primary-dim transition-colors"
                  title={`Update ${availableUpdate?.version} available`}
                >
                  <span className="material-symbols-outlined">arrow_upward</span>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary status-pulse" />
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
                title="Settings (Command+,)"
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Canvas */}
      <main className="px-8 py-10 max-w-7xl mx-auto w-full flex-1">
        {/* Hero Stats / Bento Header */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
          <div className="md:col-span-8 bg-surface-container-low rounded-xl p-8 flex flex-col justify-between min-h-[220px] panel-interactive panel-entrance">
            <div>
              <h1 className="text-5xl font-headline font-extrabold text-on-surface tracking-tight leading-none mb-2">
                {activeCount} Active
              </h1>
              <p className="text-on-surface-variant text-lg">Secure tunnels currently routing traffic</p>
            </div>
            <div className="flex gap-4 mt-6">
              <button 
                onClick={handleCreate} 
                className="bg-primary text-on-primary font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-dim active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                New Connection
              </button>
              <button 
                onClick={() => setLogPanelOpen(true)} 
                className="bg-surface-container-highest text-on-surface font-semibold px-6 py-2.5 rounded-xl hover:bg-surface-bright transition-all"
              >
                View Logs
              </button>
            </div>
          </div>
          <div className="md:col-span-4 bg-surface-container-highest rounded-xl p-8 relative overflow-hidden group panel-interactive panel-entrance">
            <div className="relative z-10">
              <span className="text-xs font-bold text-primary tracking-widest uppercase mb-4 block">Total Profiles</span>
              <div className="text-3xl font-bold font-headline text-on-surface mb-1">{profiles.length}</div>
              <p className="text-on-surface-variant text-sm">Configured connections</p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-[140px]">speed</span>
            </div>
          </div>
        </div>

        {/* Tunnels Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-headline font-bold text-on-surface">Connected Profiles</h2>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <button
                  onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                  className={`p-2 transition-colors rounded-full ${
                    filterStatus !== 'all' || filterType !== 'all'
                      ? "text-primary"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
                  }`}
                  title="Filter Profiles"
                >
                  <span className="material-symbols-outlined">filter_list</span>
                </button>
                
                {filterMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setFilterMenuOpen(false)} />
                    <div className="absolute right-0 top-0 z-20 bg-surface-container-highest border border-outline-variant/40 rounded-xl shadow-[0_24px_40px_-12px_rgba(0,0,0,0.45)] py-2 min-w-[200px] overflow-hidden backdrop-blur-xl">
                      <div className="px-3 py-1.5 text-[11px] font-label text-on-surface-variant uppercase tracking-wider">Status</div>
                      <FilterMenuItem 
                        label="All Statuses" 
                        active={filterStatus === 'all'} 
                        onClick={() => { setFilterStatus('all'); setFilterMenuOpen(false); }} 
                      />
                      <FilterMenuItem 
                        label="Active Only" 
                        active={filterStatus === 'active'} 
                        onClick={() => { setFilterStatus('active'); setFilterMenuOpen(false); }} 
                      />
                      <FilterMenuItem 
                        label="Inactive Only" 
                        active={filterStatus === 'inactive'} 
                        onClick={() => { setFilterStatus('inactive'); setFilterMenuOpen(false); }} 
                      />
                      
                      <div className="h-px bg-outline-variant/40 my-2 mx-2" />
                      
                      <div className="px-3 py-1.5 text-[11px] font-label text-on-surface-variant uppercase tracking-wider">Type</div>
                      <FilterMenuItem 
                        label="All Types" 
                        active={filterType === 'all'} 
                        onClick={() => { setFilterType('all'); setFilterMenuOpen(false); }} 
                      />
                      <FilterMenuItem 
                        label="Local (-L)" 
                        active={filterType === 'LOCAL'} 
                        onClick={() => { setFilterType('LOCAL'); setFilterMenuOpen(false); }} 
                      />
                      <FilterMenuItem 
                        label="Remote (-R)" 
                        active={filterType === 'REMOTE'} 
                        onClick={() => { setFilterType('REMOTE'); setFilterMenuOpen(false); }} 
                      />
                      <FilterMenuItem 
                        label="Dynamic (-D)" 
                        active={filterType === 'DYNAMIC'} 
                        onClick={() => { setFilterType('DYNAMIC'); setFilterMenuOpen(false); }} 
                      />
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                className="p-2 text-on-surface-variant hover:text-on-surface transition-colors rounded-full"
                title={viewMode === 'list' ? 'Switch to Grid View' : 'Switch to List View'}
              >
                <span className="material-symbols-outlined">
                  {viewMode === 'list' ? 'grid_view' : 'view_list'}
                </span>
              </button>
            </div>
          </div>
          
          <ProfileList
            onCreate={handleCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onCopyConfig={(profile) => void handleCopyConfig(profile)}
            onStart={handleStart}
            onStop={handleStop}
            onViewLogs={handleViewLogs}
          />
        </div>
      </main>

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={handleCreate}
        className="fixed bottom-20 right-8 w-14 h-14 rounded-full bg-primary text-on-primary shadow-2xl shadow-primary/25 flex items-center justify-center hover:bg-primary-dim hover:scale-110 active:scale-95 transition-all md:hidden z-50"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>

      {/* Mobile Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-low flex justify-around items-center py-3 md:hidden z-50 border-t border-outline-variant/40">
        <button className="flex flex-col items-center text-primary">
          <span className="material-symbols-outlined">lan</span>
          <span className="text-[10px] mt-1">Tunnels</span>
        </button>
        <button onClick={() => setSettingsOpen(true)} className="flex flex-col items-center text-on-surface-variant">
          <span className="relative material-symbols-outlined">
            settings
            {showUpdateIndicator && (
              <span className="absolute -top-1 -right-2 material-symbols-outlined text-[14px] text-primary">arrow_upward</span>
            )}
          </span>
          <span className="text-[10px] mt-1">Settings</span>
        </button>
      </nav>

      {/* Modals */}
      <ProfileForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        onPasteConfig={handleLoadClipboardConfig}
        initialData={editingProfile || undefined}
      />

      <PasswordPrompt
        open={!!passwordPromptProfile}
        profile={passwordPromptProfile}
        loading={startingWithPrompt}
        onCancel={() => setPasswordPromptProfile(null)}
        onSubmit={handlePasswordPromptSubmit}
      />

      <LogPanel
        open={logPanelOpen}
        onClose={() => setLogPanelOpen(false)}
        profile={logProfile}
      />

      <SettingsPage
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        currentVersion={currentVersion}
        platformName={platform()}
        updateChannel={updateChannel}
        autoCheckUpdates={autoCheckUpdates}
        windowsSshHelpUrl={WINDOWS_SSH_HELP_URL}
        onOpenSshHelpUrl={(url) => void TauriCommands.openUrl(url)}
        menuBarModeEnabled={menuBarModeEnabled}
        closeAction={closeAction}
        updateStatus={updateStatus}
        updateStatusMessage={updateStatusMessage}
        updateErrorMessage={updateErrorMessage}
        availableUpdate={availableUpdate}
        lastCheckedAt={lastCheckedAt}
        onUpdateChannelChange={setUpdateChannel}
        onAutoCheckUpdatesChange={setAutoCheckUpdates}
        onMenuBarModeEnabledChange={handleMenuBarModeEnabledChange}
        onCloseActionChange={handleCloseActionChange}
        onCheckForUpdates={handleCheckForUpdates}
        onInstallUpdate={handleInstallUpdate}
        onOpenReleaseNotes={(url) => void TauriCommands.openUrl(url)}
        onReopenOnboarding={handleReopenOnboarding}
        isDevBuild={isDevBuild}
        devShowGuideOnLaunch={devShowGuideOnLaunch}
        onDevShowGuideOnLaunchChange={handleDevShowGuideOnLaunchChange}
      />

      <Modal
        open={updatePromptOpen && hasPendingUpdate}
        onClose={dismissPrompt}
        size="md"
        showClose={false}
      >
        <div className="flex flex-col h-full max-h-[90vh]">
          <header className="px-6 py-5 flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-highest/30 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">system_update_alt</span>
              </div>
              <div>
                <h2 className="font-headline text-xl font-bold text-on-surface">Update Available</h2>
                <p className="text-[13px] text-on-surface-variant font-label">
                  {availableUpdate ? `Version ${availableUpdate.version} is ready to install` : "A new release is available"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissPrompt}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-6 bg-primary rounded-full" />
                <h3 className="font-headline text-lg font-semibold text-on-surface">Release</h3>
              </div>
              <p className="text-sm leading-6 text-on-surface-variant">
                {availableUpdate
                  ? `Current version ${availableUpdate.currentVersion} can be updated to ${availableUpdate.version}.`
                  : "An update is available for this app."}
              </p>
              {availableUpdate?.releaseNotes && (
                <div className="rounded-xl bg-surface-container px-4 py-4">
                  <p className="text-sm text-on-surface-variant whitespace-pre-wrap leading-6">
                    {availableUpdate.releaseNotes}
                  </p>
                </div>
              )}
            </section>
            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40">
              {availableUpdate?.releaseUrl && (
                <button
                  type="button"
                  className="px-4 py-2 rounded-md text-on-surface hover:bg-surface-container transition-colors"
                  onClick={() => void TauriCommands.openUrl(availableUpdate.releaseUrl!)}
                >
                  Release Notes
                </button>
              )}
              <button
                type="button"
                className="px-4 py-2 rounded-md text-on-surface hover:bg-surface-container transition-colors"
                onClick={dismissPrompt}
              >
                Later
              </button>
              <button
                type="button"
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-semibold hover:bg-primary-dim transition-colors"
                onClick={() => void handleInstallUpdate()}
              >
                Update and Restart
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        size="sm"
        showClose={false}
      >
        <div className="flex flex-col h-full max-h-[90vh]">
          <header className="px-6 py-5 flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-highest/30 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-md bg-error/10 flex items-center justify-center text-error">
                <span className="material-symbols-outlined">delete</span>
              </div>
              <div>
                <h2 className="font-headline text-xl font-bold text-on-surface">Delete Profile</h2>
                <p className="text-[13px] text-on-surface-variant font-label">This action cannot be undone</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-6 bg-error rounded-full"></span>
                <h3 className="font-headline text-lg font-semibold text-on-surface">Confirmation</h3>
              </div>
              <p className="text-sm leading-6 text-on-surface-variant">
                Are you sure you want to delete "{deleteConfirm?.name}"? This profile, related runtime state, and cached credentials will be removed from the app.
              </p>
            </section>
            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40">
              <button className="px-4 py-2 rounded-md text-on-surface hover:bg-surface-container transition-colors" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </button>
              <button className="px-5 py-2.5 rounded-xl bg-error text-on-error font-semibold hover:bg-error/90 transition-colors" onClick={confirmDelete}>
              Delete
            </button>
          </div>
          </div>
        </div>
      </Modal>

      {/* Toasts */}
      <ToastContainer />
    </div>
  );
}

export default App;

function FilterMenuItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center justify-between px-4 py-2 text-[13px] font-medium text-left transition-colors
        hover:bg-surface-container
        ${active ? "text-primary" : "text-on-surface"}
      `}
    >
      {label}
      {active && <span className="material-symbols-outlined text-[16px]">check</span>}
    </button>
  );
}
