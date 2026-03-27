import { useMemo } from "react";
import type { ProfileFormData, TunnelMode } from "../types";
import { buildSSHCommand } from "../lib/ssh-command";

interface SSHCommandPreviewInput {
  mode: TunnelMode;
  sshHost: string;
  sshPort: number;
  username: string;
  authType: "PASSWORD" | "SSH_KEY";
  privateKeyPath: string | undefined;
  localBindHost: string | undefined;
  localPort: number | undefined;
  remoteHost: string | undefined;
  remotePort: number | undefined;
  remoteBindHost: string | undefined;
  localTargetHost: string | undefined;
  localTargetPort: number | undefined;
}

function toPreviewProfile(input: SSHCommandPreviewInput): ProfileFormData {
  return {
    name: "",
    iconType: "generated",
    mode: input.mode,
    sshHost: input.sshHost || "",
    sshPort: input.sshPort || 22,
    username: input.username || "",
    authType: input.authType,
    rememberPassword: true,
    privateKeyPath: input.privateKeyPath,
    localBindHost: input.localBindHost || "127.0.0.1",
    localPort: input.localPort,
    remoteHost: input.remoteHost,
    remotePort: input.remotePort,
    remoteBindHost: input.remoteBindHost,
    localTargetHost: input.localTargetHost,
    localTargetPort: input.localTargetPort,
    autoReconnect: false,
    openUrlAfterStart: false,
  };
}

export function useSSHCommandPreview(input: SSHCommandPreviewInput): string {
  return useMemo(() => {
    return buildSSHCommand(toPreviewProfile(input) as never);
  }, [input]);
}
