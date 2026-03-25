import { useMemo } from "react";
import type { ProfileFormData, TunnelMode } from "../types";
import { buildSSHCommand } from "../lib/ssh-command";

export function useSSHCommandPreview(
  mode: TunnelMode,
  sshHost: string,
  sshPort: number,
  username: string,
  authType: "PASSWORD" | "SSH_KEY",
  privateKeyPath: string | undefined,
  localBindHost: string | undefined,
  localPort: number | undefined,
  remoteHost: string | undefined,
  remotePort: number | undefined,
  remoteBindHost: string | undefined,
  localTargetHost: string | undefined,
  localTargetPort: number | undefined
): string {
  return useMemo(() => {
    const fakeProfile = {
      mode,
      sshHost: sshHost || "",
      sshPort: sshPort || 22,
      username: username || "",
      authType,
      privateKeyPath,
      localBindHost: localBindHost || "127.0.0.1",
      localPort,
      remoteHost,
      remotePort,
      remoteBindHost,
      localTargetHost,
      localTargetPort,
      autoReconnect: false,
    } as ProfileFormData;

    return buildSSHCommand(fakeProfile as never);
  }, [
    mode,
    sshHost,
    sshPort,
    username,
    authType,
    privateKeyPath,
    localBindHost,
    localPort,
    remoteHost,
    remotePort,
    remoteBindHost,
    localTargetHost,
    localTargetPort,
  ]);
}
