import { Modal } from "./ui";
import { useLogsStore } from "../store";
import type { TunnelProfile } from "../types";

interface LogPanelProps {
  open: boolean;
  onClose: () => void;
  profile: TunnelProfile | null;
}

export function LogPanel({ open, onClose, profile }: LogPanelProps) {
  const profileId = profile?.id ?? "";
  const allLogs = useLogsStore((s) => s.logs);
  const logs = profileId ? (allLogs[profileId] ?? []) : [];

  const latestLog = logs[0];

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" showClose={false}>
      <div className="flex flex-col h-full max-h-[90vh]">
        <header className="px-6 py-5 flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-highest/30 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">terminal</span>
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Logs</h2>
              <p className="text-[13px] text-on-surface-variant font-label">
                {profile ? `Latest runtime output for ${profile.name}` : "Tunnel execution details"}
              </p>
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
        {profile && (
          <div className="rounded-xl bg-surface-container-highest p-4 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-sm font-medium text-on-surface">
              {profile.name}
            </span>
            <span className="text-xs text-on-surface-variant ml-auto">
              {profile.username}@{profile.sshHost}:{profile.sshPort}
            </span>
          </div>
        )}

        {!latestLog ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl bg-surface-container-highest/50">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="mb-3 text-on-surface-variant"
            >
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-on-surface-variant">
              No logs yet. Start the tunnel to see logs here.
            </p>
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full"></span>
              <h3 className="font-headline text-lg font-semibold text-on-surface">Latest Entry</h3>
            </div>
            <div className="flex flex-col gap-3 p-4 bg-surface-container-highest rounded-xl">
              <div className="flex items-center gap-4 text-xs text-on-surface-variant flex-wrap">
                <span>Started: {formatDate(latestLog.startedAt)}</span>
                {latestLog.endedAt && (
                  <span>Ended: {formatDate(latestLog.endedAt)}</span>
                )}
                {latestLog.exitCode !== undefined && (
                  <span className={`ml-auto font-semibold ${latestLog.exitCode === 0 ? "text-primary" : "text-error"}`}>
                    Exit code: {latestLog.exitCode}
                  </span>
                )}
              </div>
              {latestLog.summary && (
                <p className="text-sm text-on-surface">{latestLog.summary}</p>
              )}
              {latestLog.stderr && (
                <pre className="text-xs text-error font-mono whitespace-pre-wrap bg-surface rounded-lg p-3 max-h-48 overflow-y-auto">
                  {latestLog.stderr}
                </pre>
              )}
            </div>
          </section>
        )}

        {logs.length > 1 && (
          <div className="text-xs text-on-surface-variant text-center">
            {logs.length} log entries (showing latest)
          </div>
        )}

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
