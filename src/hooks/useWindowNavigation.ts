import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useProfileStore } from "../store";
import type { TunnelProfile } from "../types";

interface MenuBarProfileActionPayload {
  profileId: string;
  action: "start" | "stop";
}

const MENU_BAR_PROFILE_ACTION_EVENT = "menu-bar-profile-action";
const MAIN_WINDOW_NAVIGATION_EVENT = "main-window-navigation";

export function useMenuBarProfileActions(
  enabled: boolean,
  onStart: (profile: TunnelProfile) => Promise<void>,
  onStop: (profile: TunnelProfile) => Promise<void>
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let unlisten: (() => void) | undefined;

    void listen<MenuBarProfileActionPayload>(MENU_BAR_PROFILE_ACTION_EVENT, ({ payload }) => {
      const profile = useProfileStore.getState().profiles.find((item) => item.id === payload.profileId);
      if (!profile) {
        return;
      }

      if (payload.action === "start") {
        void onStart(profile);
        return;
      }

      void onStop(profile);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [enabled, onStart, onStop]);
}

export function useMainWindowNavigation(
  loadPendingAction: () => Promise<{ action: "open_settings" | "create_profile" } | null>,
  handleOpenSettings: () => void,
  handleCreate: () => void
) {
  useEffect(() => {
    void loadPendingAction().then((payload) => {
      if (!payload) {
        return;
      }

      if (payload.action === "open_settings") {
        handleOpenSettings();
        return;
      }

      handleCreate();
    });
  }, [handleCreate, handleOpenSettings, loadPendingAction]);

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
}
