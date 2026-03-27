import { useEffect, useState } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { TauriCommands } from "../TauriCommands";
import { useTheme } from "../hooks/useTheme";
import { useUIStore } from "../store";

const WINDOWS_SSH_HELP_URL =
  "https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse";

type SshStatus = "loading" | "ok" | "error";
type PendingAction = "continue" | "create_profile" | null;

const STEPS = [
  {
    eyebrow: "Welcome",
    title: "TunnelArch, ready in a minute.",
    description: "A quick intro, then you drop into the main app and start creating your first tunnel.",
    icon: "rocket_launch",
  },
  {
    eyebrow: "Environment",
    title: "Check local SSH support.",
    description: "Checking your system SSH client...",
    icon: "terminal",
  },
  {
    eyebrow: "Start",
    title: "You are ready to build the first profile.",
    description: "Open the main app now, or jump straight into the create profile form.",
    icon: "add_link",
  },
] as const;

export function OnboardingWindow() {
  const isWindows = platform() === "windows";
  const themeMode = useUIStore((s) => s.themeMode);
  const resolvedTheme = useTheme(themeMode);
  const [stepIndex, setStepIndex] = useState(0);
  const [sshStatus, setSshStatus] = useState<SshStatus>("loading");
  const [sshVersion, setSshVersion] = useState("");
  const [sshError, setSshError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const root = document.getElementById("root");
    if (root) {
      root.style.background = "transparent";
    }

    void loadSshInfo();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === "system") {
      root.removeAttribute("data-theme");
      root.style.colorScheme = resolvedTheme;
      return;
    }

    root.setAttribute("data-theme", themeMode);
    root.style.colorScheme = themeMode;
  }, [resolvedTheme, themeMode]);

  const loadSshInfo = async () => {
    setSshStatus("loading");
    setSshError("");
    try {
      const version = await TauriCommands.getSshVersion();
      setSshVersion(version);
      setSshStatus("ok");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSshVersion("");
      setSshError(message);
      setSshStatus("error");
    }
  };

  const handleFinish = async (action: PendingAction) => {
    if (!action) return;
    setPendingAction(action);
    try {
      await TauriCommands.completeOnboarding(action);
    } finally {
      setPendingAction(null);
    }
  };

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;
  const step = STEPS[stepIndex];
  const subtitle =
    stepIndex === 1
      ? sshStatus === "ok"
        ? sshVersion || "System SSH is available and ready."
        : sshStatus === "loading"
        ? "Checking your system SSH client..."
        : isWindows
        ? "OpenSSH Client is missing. Install it from Windows Optional Features."
        : sshError.includes("SSH client was not found on this system")
        ? "SSH client is missing. Install OpenSSH and ensure `ssh` is on PATH."
        : sshError || "SSH client was not detected."
      : step.description;

  return (
    <div className="relative min-h-screen overflow-hidden rounded-[24px] bg-background text-on-background font-body shadow-[0_28px_80px_-30px_rgba(38,31,86,0.45)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_50%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_34%)] transition-opacity duration-500 ease-out" />

      <div className="relative flex min-h-screen flex-col rounded-[24px] border border-outline-variant/30 bg-background">
        <div data-tauri-drag-region className="h-8 w-full shrink-0" />

        <div className="relative flex flex-1 flex-col overflow-hidden px-8 pb-8">
          <div className="mb-7 flex items-center justify-between">
            <div className="flex gap-2">
              {STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all ${
                    index === stepIndex ? "w-10 bg-primary" : "w-4 bg-outline-variant/70"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => void handleFinish("continue")}
              disabled={pendingAction !== null}
              className="text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-60"
            >
              Skip
            </button>
          </div>

          <div className="pointer-events-none absolute right-[-40px] top-1/2 -translate-y-1/2 text-primary/10 guide-icon-enter">
            <span key={step.icon} className="material-symbols-outlined text-[320px] leading-none guide-icon-enter">
              {step.icon}
            </span>
          </div>

          <div className="relative flex flex-1 items-center">
            <div key={`${stepIndex}-${step.icon}`} className="max-w-[360px] guide-copy-enter">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-primary">
                {step.eyebrow}
              </div>
              <h1 className="max-w-[12ch] font-headline text-[2.45rem] font-extrabold leading-[1.02] tracking-tight text-on-surface">
                {step.title}
              </h1>
              <p className="mt-5 max-w-[30ch] text-[15px] leading-7 text-on-surface-variant">
                {subtitle}
              </p>
              {stepIndex === 1 && sshStatus === "error" && isWindows && (
                <button
                  type="button"
                  onClick={() => void TauriCommands.openUrl(WINDOWS_SSH_HELP_URL)}
                  className="mt-4 text-sm font-medium text-primary transition-colors hover:text-primary-dim"
                >
                  Install guide
                </button>
              )}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-4 border-t border-outline-variant/35 pt-5">
            <button
              type="button"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              disabled={isFirstStep || pendingAction !== null}
              className="rounded-2xl px-4 py-3 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>

            <div className="flex items-center gap-3">
              {stepIndex === 1 && (
                <button
                  type="button"
                  onClick={() => void loadSshInfo()}
                  disabled={pendingAction !== null}
                  className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-bright disabled:opacity-60"
                >
                  Re-check
                </button>
              )}

              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((current) => Math.min(STEPS.length - 1, current + 1))}
                  disabled={pendingAction !== null}
                  className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-dim active:scale-[0.98] disabled:opacity-60"
                >
                  Next
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void handleFinish("continue")}
                    disabled={pendingAction !== null}
                    className="rounded-2xl bg-surface-container-highest px-5 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-bright disabled:opacity-60"
                  >
                    {pendingAction === "continue" ? "Opening..." : "Open App"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleFinish("create_profile")}
                    disabled={pendingAction !== null}
                    className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-dim active:scale-[0.98] disabled:opacity-60"
                  >
                    {pendingAction === "create_profile" ? "Opening..." : "Create First Profile"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
