import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CloseAction, TunnelProfile, RuntimeStatus, UpdateChannel, UpdateInfo, UpdateStatus } from "../types";

interface ProfileStore {
  profiles: TunnelProfile[];
  addProfile: (profile: TunnelProfile) => void;
  updateProfile: (id: string, updates: Partial<TunnelProfile>) => void;
  deleteProfile: (id: string) => void;
  reorderProfiles: (profiles: TunnelProfile[]) => void;
  getProfile: (id: string) => TunnelProfile | undefined;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      profiles: [],

      addProfile: (profile) =>
        set((state) => ({
          profiles: [
            { ...profile, sortOrder: 0 },
            ...state.profiles.map((p) => ({ ...p, sortOrder: p.sortOrder + 1 })),
          ],
        })),

      updateProfile: (id, updates) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        })),

      deleteProfile: (id) =>
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
        })),

      reorderProfiles: (profiles) => set({ profiles }),

      getProfile: (id) => get().profiles.find((p) => p.id === id),
    }),
    {
      name: "tunnel-manager-profiles",
    }
  )
);

// --- UI State Store (persisted) ---

export type ViewMode = "list" | "grid";
export type FilterStatus = "all" | "active" | "inactive";
export type FilterType = "all" | "LOCAL" | "REMOTE" | "DYNAMIC";
export type ThemeMode = "system" | "light" | "dark";

interface UIStore {
  viewMode: ViewMode;
  filterStatus: FilterStatus;
  filterType: FilterType;
  themeMode: ThemeMode;
  updateChannel: UpdateChannel;
  autoCheckUpdates: boolean;
  menuBarModeEnabled: boolean;
  closeAction: CloseAction;
  dismissedUpdateVersion: string | null;
  setViewMode: (mode: ViewMode) => void;
  setFilterStatus: (status: FilterStatus) => void;
  setFilterType: (type: FilterType) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setUpdateChannel: (channel: UpdateChannel) => void;
  setAutoCheckUpdates: (enabled: boolean) => void;
  setMenuBarModeEnabled: (enabled: boolean) => void;
  setCloseAction: (action: CloseAction) => void;
  setDismissedUpdateVersion: (version: string | null) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      viewMode: "list",
      filterStatus: "all",
      filterType: "all",
      themeMode: "system",
      updateChannel: "stable",
      autoCheckUpdates: true,
      menuBarModeEnabled: true,
      closeAction: "hide_to_menu_bar",
      dismissedUpdateVersion: null,
      setViewMode: (viewMode) => set({ viewMode }),
      setFilterStatus: (filterStatus) => set({ filterStatus }),
      setFilterType: (filterType) => set({ filterType }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setUpdateChannel: (updateChannel) => set({ updateChannel }),
      setAutoCheckUpdates: (autoCheckUpdates) => set({ autoCheckUpdates }),
      setMenuBarModeEnabled: (menuBarModeEnabled) => set({ menuBarModeEnabled }),
      setCloseAction: (closeAction) => set({ closeAction }),
      setDismissedUpdateVersion: (dismissedUpdateVersion) => set({ dismissedUpdateVersion }),
    }),
    {
      name: "tunnel-manager-ui",
    }
  )
);

// --- Runtime State Store (not persisted) ---

interface RuntimeStore {
  states: Record<string, {
    status: RuntimeStatus;
    pid?: number;
    startedAt?: string;
    errorMessage?: string;
    lastExitCode?: number;
  }>;
  setStatus: (profileId: string, status: RuntimeStatus) => void;
  setPid: (profileId: string, pid: number) => void;
  setError: (profileId: string, errorMessage: string) => void;
  clearState: (profileId: string) => void;
  getState: (profileId: string) => RuntimeStore["states"][string] | undefined;
}

export const useRuntimeStore = create<RuntimeStore>()((set, get) => ({
  states: {},

  setStatus: (profileId, status) =>
    set((state) => ({
      states: {
        ...state.states,
        [profileId]: {
          ...state.states[profileId],
          status,
          ...(status !== "ERROR" ? { errorMessage: undefined } : {}),
          ...(status === "CONNECTING" && !state.states[profileId]?.startedAt
            ? { startedAt: new Date().toISOString() }
            : {}),
        },
      },
    })),

  setPid: (profileId, pid) =>
    set((state) => ({
      states: {
        ...state.states,
        [profileId]: { ...state.states[profileId], pid },
      },
    })),

  setError: (profileId, errorMessage) =>
    set((state) => ({
      states: {
        ...state.states,
        [profileId]: { ...state.states[profileId], status: "ERROR", errorMessage },
      },
    })),

  clearState: (profileId) =>
    set((state) => {
      const { [profileId]: _, ...rest } = state.states;
      return { states: rest };
    }),

  getState: (profileId) => get().states[profileId],
}));

// --- Logs Store (not persisted) ---
export interface LogEntry {
  id: string;
  profileId: string;
  startedAt: string;
  endedAt?: string;
  exitCode?: number;
  stderr?: string;
  summary?: string;
}

interface LogsStore {
  logs: Record<string, LogEntry[]>;
  addLog: (entry: LogEntry) => void;
  getLogs: (profileId: string) => LogEntry[];
  clearLogs: (profileId: string) => void;
}

export const useLogsStore = create<LogsStore>()((set, get) => ({
  logs: {},

  addLog: (entry) =>
    set((state) => {
      const existing = state.logs[entry.profileId] || [];
      return {
        logs: {
          ...state.logs,
          [entry.profileId]: [entry, ...existing].slice(0, 20),
        },
      };
    }),

  getLogs: (profileId) => get().logs[profileId] || [],

  clearLogs: (profileId) =>
    set((state) => {
      const { [profileId]: _, ...rest } = state.logs;
      return { logs: rest };
    }),
}));

interface UpdateStore {
  status: UpdateStatus;
  currentVersion: string;
  lastCheckedAt?: string;
  availableUpdate: UpdateInfo | null;
  errorMessage?: string;
  setStatus: (status: UpdateStatus) => void;
  setCurrentVersion: (version: string) => void;
  setLastCheckedAt: (value?: string) => void;
  setAvailableUpdate: (update: UpdateInfo | null) => void;
  setErrorMessage: (message?: string) => void;
  reset: () => void;
}

export const useUpdateStore = create<UpdateStore>()((set) => ({
  status: "idle",
  currentVersion: "",
  lastCheckedAt: undefined,
  availableUpdate: null,
  errorMessage: undefined,
  setStatus: (status) => set({ status }),
  setCurrentVersion: (currentVersion) => set({ currentVersion }),
  setLastCheckedAt: (lastCheckedAt) => set({ lastCheckedAt }),
  setAvailableUpdate: (availableUpdate) => set({ availableUpdate }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  reset: () =>
    set({
      status: "idle",
      currentVersion: "",
      lastCheckedAt: undefined,
      availableUpdate: null,
      errorMessage: undefined,
    }),
}));
