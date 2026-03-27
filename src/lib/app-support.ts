import { z } from "zod";
import type { MenuBarStatus, TunnelProfile } from "../types";

const DEV_PASSWORD_CACHE_KEY = "tunnel-manager-dev-password-cache";
const PROFILE_CLIPBOARD_KIND = "tunnel-manager/profile-config";
const PROFILE_CLIPBOARD_VERSION = 1;

export const clipboardProfileSchema = z.object({
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

export type ClipboardProfilePayload = z.infer<typeof clipboardProfileSchema>;

function isMissingSshError(message: string) {
  return (
    message.includes("OpenSSH Client is not installed") ||
    message.includes("OpenSSH Client not found") ||
    message.includes("SSH client was not found on this system")
  );
}

export function normalizeTunnelStartError(message: string) {
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

export function resolveClipboardIconType(profile: ClipboardProfilePayload["profile"]): "custom" | "generated" {
  if (profile.iconType) {
    return profile.iconType;
  }

  return profile.iconPath?.trim() ? "custom" : "generated";
}

export function getMenuBarStatus(states: Record<string, { status: string | undefined }>): MenuBarStatus {
  const runtimeStatuses = Object.values(states).map((state) => state.status);

  if (runtimeStatuses.includes("ERROR")) {
    return "Error";
  }

  if (runtimeStatuses.includes("RUNNING") || runtimeStatuses.includes("CONNECTING")) {
    return "Running";
  }

  return "Idle";
}

export function getDevPasswordCache(isDevBuild: boolean): Record<string, string> {
  if (!isDevBuild) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(DEV_PASSWORD_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function setDevPasswordCache(isDevBuild: boolean, next: Record<string, string>) {
  if (!isDevBuild) {
    return;
  }

  try {
    window.localStorage.setItem(DEV_PASSWORD_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort cache only; runtime passwords still work without local storage.
  }
}

function copyWithLegacyClipboardApi(value: string) {
  const el = document.createElement("textarea");
  el.value = value;
  document.body.appendChild(el);
  el.select();
  // noinspection JSDeprecatedSymbols
  const copied = document.execCommand("copy");
  document.body.removeChild(el);
  return copied;
}

export async function writeClipboardText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const copied = copyWithLegacyClipboardApi(value);
    if (!copied) {
      throw new Error("Clipboard write is not available in this environment");
    }
  }
}

export async function readClipboardText() {
  if (!navigator.clipboard?.readText) {
    throw new Error("Clipboard read is not available in this environment");
  }

  return navigator.clipboard.readText();
}

export function buildClipboardPayload(profile: TunnelProfile): ClipboardProfilePayload {
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
