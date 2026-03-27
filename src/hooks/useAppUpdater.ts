import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore, useUpdateStore } from "../store";
import { TauriCommands } from "../TauriCommands";
import type { UpdateStatus } from "../types";

function statusMessage(status: UpdateStatus, errorMessage?: string) {
  switch (status) {
    case "checking":
      return "Checking for updates...";
    case "available":
      return "A new version is ready to install.";
    case "not_available":
      return "You're on the latest version.";
    case "downloading":
      return "Downloading the update package...";
    case "downloaded":
      return "Update downloaded. Restart to apply.";
    case "installing":
      return "Restarting to apply update...";
    case "error":
      return errorMessage || "Unable to check for updates.";
    default:
      return "Update checks are idle.";
  }
}

function shouldOpenPrompt(source: "auto" | "manual", dismissedVersion: string | null, nextVersion: string) {
  return source === "manual" || dismissedVersion !== nextVersion;
}

function useInitialVersion(setCurrentVersion: (version: string) => void) {
  useEffect(() => {
    void TauriCommands.getAppVersion()
      .then(setCurrentVersion)
      .catch(() => undefined);
  }, [setCurrentVersion]);
}

interface ResetUpdateStateOptions {
  updateChannel: string;
  setAvailableUpdate: (update: ReturnType<typeof useUpdateStore.getState>["availableUpdate"]) => void;
  setErrorMessage: (message: string | undefined) => void;
  setStatus: (status: UpdateStatus) => void;
  setPromptOpen: (open: boolean) => void;
}

function useResetUpdateState({
  updateChannel,
  setAvailableUpdate,
  setErrorMessage,
  setStatus,
  setPromptOpen,
}: ResetUpdateStateOptions) {
  useEffect(() => {
    setAvailableUpdate(null);
    setErrorMessage(undefined);
    setStatus("idle");
    setPromptOpen(false);
  }, [setAvailableUpdate, setErrorMessage, setPromptOpen, setStatus, updateChannel]);
}

function useAutoCheck(
  autoCheckUpdates: boolean,
  autoCheckedRef: { current: boolean },
  runCheck: (source: "auto" | "manual") => Promise<unknown>
) {
  useEffect(() => {
    if (!autoCheckUpdates || autoCheckedRef.current) {
      return;
    }

    autoCheckedRef.current = true;
    const timer = window.setTimeout(() => {
      void runCheck("auto");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [autoCheckUpdates, runCheck, autoCheckedRef]);
}

function useUpdatePromptActions(
  availableUpdate: ReturnType<typeof useUpdateStore.getState>["availableUpdate"],
  setDismissedUpdateVersion: (version: string) => void,
  setPromptOpen: (open: boolean) => void
) {
  const dismissPrompt = useCallback(() => {
    if (availableUpdate) {
      setDismissedUpdateVersion(availableUpdate.version);
    }
    setPromptOpen(false);
  }, [availableUpdate, setDismissedUpdateVersion, setPromptOpen]);

  const reopenPrompt = useCallback(() => {
    if (availableUpdate) {
      setPromptOpen(true);
    }
  }, [availableUpdate, setPromptOpen]);

  return { dismissPrompt, reopenPrompt };
}

function useInstallUpdate(
  availableUpdate: ReturnType<typeof useUpdateStore.getState>["availableUpdate"],
  setErrorMessage: (message: string | undefined) => void,
  setStatus: (status: UpdateStatus) => void
) {
  return useCallback(async () => {
    if (!availableUpdate) {
      return;
    }

    setErrorMessage(undefined);
    setStatus("downloading");

    try {
      await TauriCommands.downloadAndInstallAppUpdate(availableUpdate.manifestUrl);
      setStatus("downloaded");
      setStatus("installing");
      await TauriCommands.restartApp();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus("error");
      setErrorMessage(message);
      throw error;
    }
  }, [availableUpdate, setErrorMessage, setStatus]);
}

interface ApplyCheckResultOptions {
  dismissedUpdateVersion: string | null;
  setCurrentVersion: (version: string) => void;
  setLastCheckedAt: (value: string) => void;
  setAvailableUpdate: (update: ReturnType<typeof useUpdateStore.getState>["availableUpdate"]) => void;
  setStatus: (status: UpdateStatus) => void;
  setErrorMessage: (message: string | undefined) => void;
  setPromptOpen: (open: boolean) => void;
}

function useApplyCheckResult(
  {
    dismissedUpdateVersion,
    setCurrentVersion,
    setLastCheckedAt,
    setAvailableUpdate,
    setStatus,
    setErrorMessage,
    setPromptOpen,
  }: ApplyCheckResultOptions
) {
  return useCallback(
    (source: "auto" | "manual", result: Awaited<ReturnType<typeof TauriCommands.checkForAppUpdate>>) => {
      setCurrentVersion(result.currentVersion);
      setLastCheckedAt(new Date().toISOString());

      if (!result.configured) {
        setAvailableUpdate(null);
        setStatus("error");
        setErrorMessage(result.message || "Updater is not configured for this build.");
        return null;
      }

      if (!result.update) {
        setAvailableUpdate(null);
        setStatus("not_available");
        return null;
      }

      setAvailableUpdate(result.update);
      setStatus("available");

      if (shouldOpenPrompt(source, dismissedUpdateVersion, result.update.version)) {
        setPromptOpen(true);
      }

      return result.update;
    },
    [
      dismissedUpdateVersion,
      setAvailableUpdate,
      setCurrentVersion,
      setErrorMessage,
      setLastCheckedAt,
      setPromptOpen,
      setStatus,
    ]
  );
}

export function useAppUpdater() {
  const {
    updateChannel,
    autoCheckUpdates,
    dismissedUpdateVersion,
    setDismissedUpdateVersion,
    setUpdateChannel,
    setAutoCheckUpdates,
  } = useUIStore();
  const {
    status,
    currentVersion,
    lastCheckedAt,
    availableUpdate,
    errorMessage,
    setStatus,
    setCurrentVersion,
    setLastCheckedAt,
    setAvailableUpdate,
    setErrorMessage,
  } = useUpdateStore();

  const [promptOpen, setPromptOpen] = useState(false);
  const autoCheckedRef = useRef(false);

  const applyCheckResult = useApplyCheckResult({
    dismissedUpdateVersion,
    setCurrentVersion,
    setLastCheckedAt,
    setAvailableUpdate,
    setStatus,
    setErrorMessage,
    setPromptOpen,
  });

  useInitialVersion(setCurrentVersion);
  useResetUpdateState({
    updateChannel,
    setAvailableUpdate,
    setErrorMessage,
    setStatus,
    setPromptOpen,
  });

  const runCheck = useCallback(
    async (source: "auto" | "manual") => {
      setStatus("checking");
      setErrorMessage(undefined);

      try {
        const result = await TauriCommands.checkForAppUpdate(updateChannel);
        return applyCheckResult(source, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setAvailableUpdate(null);
        setStatus("error");
        setErrorMessage(message);
        return null;
      }
    },
    [
      applyCheckResult,
      setAvailableUpdate,
      setErrorMessage,
      setStatus,
      updateChannel,
    ]
  );

  useAutoCheck(autoCheckUpdates, autoCheckedRef, runCheck);

  const { dismissPrompt, reopenPrompt } = useUpdatePromptActions(
    availableUpdate,
    setDismissedUpdateVersion,
    setPromptOpen
  );
  const installUpdate = useInstallUpdate(availableUpdate, setErrorMessage, setStatus);
  const hideUpdateIndicator =
    !!availableUpdate && dismissedUpdateVersion === availableUpdate.version;

  return {
    updateChannel,
    autoCheckUpdates,
    currentVersion,
    lastCheckedAt,
    status,
    statusMessage: statusMessage(status, errorMessage),
    errorMessage,
    availableUpdate,
    promptOpen,
    hasPendingUpdate: !!availableUpdate && status !== "installing" && status !== "downloading",
    showUpdateIndicator: !!availableUpdate && !hideUpdateIndicator,
    checkForUpdates: () => runCheck("manual"),
    dismissPrompt,
    reopenPrompt,
    installUpdate,
    setPromptOpen,
    setUpdateChannel,
    setAutoCheckUpdates,
  };
}
