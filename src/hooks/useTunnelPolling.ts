import { useEffect, useRef } from "react";
import { TauriCommands } from "../TauriCommands";
import { useToastStore } from "../components/ui";
import { useLogsStore, useProfileStore, useRuntimeStore } from "../store";

const POLL_INTERVAL = 3000; // 3 seconds

export function useTunnelPolling() {
  const states = useRuntimeStore((s) => s.states);
  const setStatus = useRuntimeStore((s) => s.setStatus);
  const setError = useRuntimeStore((s) => s.setError);
  const setPid = useRuntimeStore((s) => s.setPid);
  const addLog = useLogsStore((s) => s.addLog);
  const profiles = useProfileStore((s) => s.profiles);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const addToast = useToastStore((s) => s.add);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const runningIds = Object.entries(states)
      .filter(([, state]) => state.status === "RUNNING" || state.status === "CONNECTING")
      .map(([id]) => id);

    if (runningIds.length === 0) {
      // No running tunnels, stop polling
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start polling if not already started
    if (!intervalRef.current) {
      intervalRef.current = setInterval(async () => {
        const currentStates = useRuntimeStore.getState().states;
        const stillRunning = Object.entries(currentStates)
          .filter(([, s]) => s.status === "RUNNING" || s.status === "CONNECTING");

        for (const [profileId, state] of stillRunning) {
          if (!state.pid) continue;

          try {
            const result = await TauriCommands.getTunnelStatus(profileId);
            const profile = profiles.find((p) => p.id === profileId);
            const name = profile?.name ?? profileId;

            if (result.running && state.status === "CONNECTING" && result.ready) {
              setPid(profileId, result.pid ?? state.pid ?? 0);
              setStatus(profileId, "RUNNING");
              updateProfile(profileId, { lastStartedAt: new Date().toISOString() });
              addToast({
                message: `Tunnel "${name}" started`,
                type: "success",
              });

              if (profile?.websiteUrl && profile.openUrlAfterStart) {
                try {
                  await TauriCommands.openUrl(profile.websiteUrl);
                } catch {
                  // ignore opener failures
                }
              }
              continue;
            }

            if (!result.running) {
              // Process exited unexpectedly
              setStatus(profileId, "ERROR");
              if (result.pid) {
                setPid(profileId, result.pid);
              }

              const exitCodeMsg = result.last_error
                ? result.last_error
                : result.exit_code !== null
                ? `Process exited with code ${result.exit_code}`
                : "Process exited unexpectedly";

              setError(profileId, exitCodeMsg);
              addLog({
                id: crypto.randomUUID(),
                profileId,
                startedAt: state.startedAt ?? new Date().toISOString(),
                endedAt: new Date().toISOString(),
                exitCode: result.exit_code ?? undefined,
                stderr: result.stderr_tail ?? undefined,
                summary: `Exited unexpectedly: ${exitCodeMsg}`,
              });

              addToast({
                message: `Tunnel "${name}" stopped unexpectedly`,
                type: "error",
              });
            }
          } catch {
            // Ignore errors during polling
          }
        }

        // Stop polling if no more running tunnels
        const remaining = Object.entries(useRuntimeStore.getState().states)
          .filter(([, s]) => s.status === "RUNNING" || s.status === "CONNECTING");
        if (remaining.length === 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [states, profiles, updateProfile, setStatus, setError, setPid, addLog, addToast]);
}
