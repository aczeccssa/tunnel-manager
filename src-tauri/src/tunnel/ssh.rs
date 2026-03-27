use super::{TunnelProfile, WINDOWS_OPENSSH_INSTALL_URL};
use std::env;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub(super) struct AskpassAssets {
    pub command_path: PathBuf,
    pub cleanup_path: PathBuf,
}

pub(super) fn ssh_not_found_message() -> String {
    if cfg!(target_os = "windows") {
        format!(
            "OpenSSH Client is not installed on this Windows device. Install it from Settings > Optional Features or run `Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`. See {WINDOWS_OPENSSH_INSTALL_URL}"
        )
    } else {
        "SSH client was not found on this system. Install OpenSSH and ensure `ssh` is available on PATH.".to_string()
    }
}

pub(super) fn normalize_spawn_error(error: &str) -> String {
    if cfg!(target_os = "windows")
        && (error.contains("The system cannot find the file specified")
            || error.contains("The system cannot find the path specified"))
    {
        return ssh_not_found_message();
    }

    error.to_string()
}

fn executable_exists(path: &Path) -> bool {
    path.is_file()
}

fn path_entries() -> impl Iterator<Item = PathBuf> {
    env::var_os("PATH")
        .map(|value| env::split_paths(&value).collect::<Vec<_>>())
        .unwrap_or_default()
        .into_iter()
}

fn find_on_path(file_name: &str) -> Option<PathBuf> {
    path_entries()
        .map(|dir| dir.join(file_name))
        .find(|candidate| executable_exists(candidate))
}

fn windows_ssh_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(path_hit) = find_on_path("ssh.exe") {
        candidates.push(path_hit);
    }

    if let Some(windir) = env::var_os("WINDIR") {
        candidates.push(
            PathBuf::from(windir)
                .join("System32")
                .join("OpenSSH")
                .join("ssh.exe"),
        );
    }

    if let Some(program_files) = env::var_os("ProgramFiles") {
        candidates.push(PathBuf::from(program_files).join("OpenSSH").join("ssh.exe"));
    }

    candidates
}

fn unix_ssh_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(path_hit) = find_on_path("ssh") {
        candidates.push(path_hit);
    }

    candidates.push(PathBuf::from("/usr/bin/ssh"));
    candidates.push(PathBuf::from("/bin/ssh"));

    candidates
}

pub(super) fn resolve_ssh_binary() -> Result<PathBuf, String> {
    let candidates = if cfg!(target_os = "windows") {
        windows_ssh_candidates()
    } else {
        unix_ssh_candidates()
    };

    candidates
        .into_iter()
        .find(|candidate| executable_exists(candidate))
        .ok_or_else(ssh_not_found_message)
}

fn base_ssh_args() -> Vec<String> {
    vec![
        "-N".to_string(),
        "-o".to_string(),
        "ExitOnForwardFailure=yes".to_string(),
        "-o".to_string(),
        "ServerAliveInterval=60".to_string(),
        "-o".to_string(),
        "ServerAliveCountMax=3".to_string(),
        "-o".to_string(),
        "StrictHostKeyChecking=no".to_string(),
        "-o".to_string(),
        "LogLevel=ERROR".to_string(),
        "-o".to_string(),
        "BatchMode=no".to_string(),
        "-o".to_string(),
        "NumberOfPasswordPrompts=1".to_string(),
    ]
}

fn push_port_arg(args: &mut Vec<String>, port: u16) {
    if port != 22 {
        args.push("-p".to_string());
        args.push(port.to_string());
    }
}

fn push_mode_args(args: &mut Vec<String>, profile: &TunnelProfile) {
    match profile.mode.as_str() {
        "LOCAL" => {
            if let (Some(local_port), Some(remote_port)) = (profile.local_port, profile.remote_port)
            {
                let local_bind = profile.local_bind_host.as_deref().unwrap_or("127.0.0.1");
                let remote = profile.remote_host.as_deref().unwrap_or("localhost");
                args.push("-L".to_string());
                args.push(format!("{local_bind}:{local_port}:{remote}:{remote_port}"));
            }
        }
        "REMOTE" => {
            if let (Some(remote_port), Some(local_target_port)) =
                (profile.remote_port, profile.local_target_port)
            {
                let remote_bind = profile.remote_bind_host.as_deref().unwrap_or("127.0.0.1");
                let local_host = profile.local_target_host.as_deref().unwrap_or("localhost");
                args.push("-R".to_string());
                args.push(format!(
                    "{remote_bind}:{remote_port}:{local_host}:{local_target_port}"
                ));
            }
        }
        "DYNAMIC" => {
            if let Some(local_port) = profile.local_port {
                let local_bind = profile.local_bind_host.as_deref().unwrap_or("127.0.0.1");
                args.push("-D".to_string());
                args.push(format!("{local_bind}:{local_port}"));
            }
        }
        _ => {}
    }
}

fn push_key_arg(args: &mut Vec<String>, key_path: Option<&String>) {
    if let Some(key_path) = key_path.filter(|value| !value.is_empty()) {
        args.push("-i".to_string());
        args.push(key_path.clone());
    }
}

pub(super) fn build_ssh_args(profile: &TunnelProfile) -> Vec<String> {
    let mut args = base_ssh_args();
    push_port_arg(&mut args, profile.ssh_port);
    push_mode_args(&mut args, profile);
    push_key_arg(&mut args, profile.private_key_path.as_ref());

    args.push(format!("{}@{}", profile.username, profile.ssh_host));
    args
}

pub(super) fn shell_escape_single_quotes(value: &str) -> String {
    value.replace('\'', "'\"'\"'")
}

fn write_text_file(path: &Path, contents: &str) -> Result<(), String> {
    fs::write(path, contents).map_err(|e| e.to_string())
}

pub(super) fn create_askpass_assets(password: &str) -> Result<AskpassAssets, String> {
    let assets_dir =
        std::env::temp_dir().join(format!("tunnel-manager-askpass-{}", Uuid::new_v4()));
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let password_file = assets_dir.join("password.txt");
    write_text_file(&password_file, password)?;

    #[cfg(target_os = "windows")]
    {
        let script_path = assets_dir.join("askpass.cmd");
        let script_content = format!("@echo off\r\ntype \"{}\"\r\n", password_file.display());
        write_text_file(&script_path, &script_content)?;

        return Ok(AskpassAssets {
            command_path: script_path,
            cleanup_path: assets_dir,
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let script_path = assets_dir.join("askpass.sh");
        let escaped_password_file = shell_escape_single_quotes(&password_file.to_string_lossy());
        let script_content = format!("#!/bin/bash\ncat '{escaped_password_file}'\n");

        write_text_file(&script_path, &script_content)?;
        #[cfg(unix)]
        fs::set_permissions(&script_path, fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;

        Ok(AskpassAssets {
            command_path: script_path,
            cleanup_path: assets_dir,
        })
    }
}
