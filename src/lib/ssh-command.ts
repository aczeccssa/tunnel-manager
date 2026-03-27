import type { TunnelProfile } from "../types";

export function buildSSHCommand(profile: TunnelProfile): string {
  const parts: string[] = ["ssh"];

  // Mirror the runtime tunnel flags closely so the preview stays useful when debugging a profile.
  parts.push("-N");
  parts.push("-o", `ServerAliveInterval=${profile.autoReconnect ? "60" : "0"}`);
  parts.push("-o", "ServerAliveCountMax=3");
  parts.push("-o", "StrictHostKeyChecking=accept-new");

  if (profile.sshPort !== 22) {
    parts.push("-p", profile.sshPort.toString());
  }

  switch (profile.mode) {
    case "LOCAL": {
      const localBind = profile.localBindHost || "127.0.0.1";
      const localPort = profile.localPort;
      const remoteHost = profile.remoteHost || "localhost";
      const remotePort = profile.remotePort;
      if (localPort && remotePort) {
        parts.push("-L", `${localBind}:${localPort}:${remoteHost}:${remotePort}`);
      }
      break;
    }
    case "REMOTE": {
      const remoteBind = profile.remoteBindHost || "127.0.0.1";
      const remotePort = profile.remotePort;
      const localHost = profile.localTargetHost || "localhost";
      const localPort = profile.localTargetPort;
      if (remotePort && localPort) {
        parts.push("-R", `${remoteBind}:${remotePort}:${localHost}:${localPort}`);
      }
      break;
    }
    case "DYNAMIC": {
      const localBind = profile.localBindHost || "127.0.0.1";
      const localPort = profile.localPort;
      if (localPort) {
        parts.push("-D", `${localBind}:${localPort}`);
      }
      break;
    }
  }

  if (profile.authType === "SSH_KEY" && profile.privateKeyPath) {
    parts.push("-i", profile.privateKeyPath);
  }

  parts.push(`${profile.username}@${profile.sshHost}`);

  return parts.join(" ");
}

export function getCommandPreview(profile: Partial<TunnelProfile>): string {
  const p = profile as TunnelProfile;
  return buildSSHCommand(p);
}
