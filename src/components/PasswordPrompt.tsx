import { useEffect, useState } from "react";
import { Modal } from "./ui";
import type { TunnelProfile } from "../types";

interface PasswordPromptProps {
  open: boolean;
  profile: TunnelProfile | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (password: string, rememberPassword: boolean) => void;
}

export function PasswordPrompt({
  open,
  profile,
  loading = false,
  onCancel,
  onSubmit,
}: PasswordPromptProps) {
  const [password, setPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(true);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setRememberPassword(profile?.rememberPassword ?? true);
  }, [open, profile]);

  return (
    <Modal open={open} onClose={loading ? () => undefined : onCancel} size="sm" showClose={false}>
      <form
        className="flex flex-col h-full max-h-[90vh]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!password) return;
          onSubmit(password, rememberPassword);
        }}
      >
        <header className="px-6 py-5 flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-highest/30 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">key</span>
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Enter Password</h2>
              <p className="text-[13px] text-on-surface-variant font-label">
                {profile ? `${profile.username}@${profile.sshHost}` : "Authenticate this SSH tunnel"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 bg-primary rounded-full"></span>
              <h3 className="font-headline text-lg font-semibold text-on-surface">Credentials</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-6">
              {profile ? `Enter the SSH password for ${profile.username}@${profile.sshHost}.` : "Enter the SSH password."}
            </p>
            <div className="flex flex-col gap-2">
              <label className="text-on-surface-variant text-[13px] font-medium px-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="SSH password"
                required
                autoFocus
                className="bg-surface-container-highest border-none rounded-md px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/30 outline-none transition-all"
              />
            </div>
            <label className="flex items-center gap-3 rounded-md bg-surface-container-highest px-4 py-3 text-sm text-on-surface cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={rememberPassword}
                onChange={(e) => setRememberPassword(e.target.checked)}
              />
              <span>Remember password in system keychain</span>
            </label>
          </section>

          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-md text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password}
              className="bg-gradient-to-br from-primary to-primary-container text-on-primary font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <span className="material-symbols-outlined text-lg">lock_open</span>
              {loading ? "Starting..." : "Start Tunnel"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
