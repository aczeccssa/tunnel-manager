import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SshInfoState {
  sshPath: string;
  sshVersion: string;
  sshStatus: "ok" | "error" | "loading";
  sshError: string;
}

export function useSshInfo(open: boolean) {
  const [state, setState] = useState<SshInfoState>({
    sshPath: "",
    sshVersion: "",
    sshStatus: "loading",
    sshError: "",
  });

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, sshStatus: "loading", sshError: "" }));

    try {
      const path = await invoke<string>("get_ssh_binary_path");
      const version = await invoke<string>("get_ssh_version");
      setState({
        sshPath: path,
        sshVersion: version,
        sshStatus: "ok",
        sshError: "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({
        sshPath: "Not found",
        sshVersion: "",
        sshStatus: "error",
        sshError: message,
      });
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    void reload();
  }, [open, reload]);

  return { ...state, reload };
}
