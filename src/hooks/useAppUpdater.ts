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

  useEffect(() => {
    void TauriCommands.getAppVersion()
      .then(setCurrentVersion)
      .catch(() => undefined);
  }, [setCurrentVersion]);

  useEffect(() => {
    setAvailableUpdate(null);
    setErrorMessage(undefined);
    setStatus("idle");
    setPromptOpen(false);
  }, [setAvailableUpdate, setErrorMessage, setStatus, updateChannel]);

  const runCheck = useCallback(
    async (source: "auto" | "manual") => {
      setStatus("checking");
      setErrorMessage(undefined);

      try {
        const result = await TauriCommands.checkForAppUpdate(updateChannel);
        const checkedAt = new Date().toISOString();
        setCurrentVersion(result.currentVersion);
        setLastCheckedAt(checkedAt);

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

        if (source === "manual" || dismissedUpdateVersion !== result.update.version) {
          setPromptOpen(true);
        }

        return result.update;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setAvailableUpdate(null);
        setStatus("error");
        setErrorMessage(message);
        return null;
      }
    },
    [
      dismissedUpdateVersion,
      setAvailableUpdate,
      setCurrentVersion,
      setErrorMessage,
      setLastCheckedAt,
      setStatus,
      updateChannel,
    ]
  );

  useEffect(() => {
    if (!autoCheckUpdates || autoCheckedRef.current) {
      return;
    }

    autoCheckedRef.current = true;
    const timer = window.setTimeout(() => {
      void runCheck("auto");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [autoCheckUpdates, runCheck]);

  const dismissPrompt = useCallback(() => {
    if (availableUpdate) {
      setDismissedUpdateVersion(availableUpdate.version);
    }
    setPromptOpen(false);
  }, [availableUpdate, setDismissedUpdateVersion]);

  const reopenPrompt = useCallback(() => {
    if (availableUpdate) {
      setPromptOpen(true);
    }
  }, [availableUpdate]);

  const installUpdate = useCallback(async () => {
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
