mod process;
mod ssh;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::State;
use tracing::error;

use self::process::{
    cleanup_askpass_script, running_tunnel_status, spawn_stderr_reader, terminate_tunnel_process,
};
use self::ssh::{build_ssh_args, create_askpass_assets, normalize_spawn_error, resolve_ssh_binary};

const STDERR_TAIL_LIMIT: usize = 8192;
const REMOTE_READY_DELAY: Duration = Duration::from_millis(800);
const LOCAL_READY_TIMEOUT: Duration = Duration::from_secs(15);
const WINDOWS_OPENSSH_INSTALL_URL: &str =
    "https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse";

pub struct AppState {
    processes: Mutex<HashMap<String, ManagedTunnel>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }
}

struct ManagedTunnel {
    child: Child,
    stderr_tail: Arc<Mutex<String>>,
    last_error: Arc<Mutex<Option<String>>>,
    askpass_script: Option<PathBuf>,
    ready: bool,
    started_at: Instant,
    mode: String,
    local_bind_host: Option<String>,
    local_port: Option<u16>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct TunnelProfile {
    pub id: String,
    pub name: String,
    pub ssh_host: String,
    pub ssh_port: u16,
    pub username: String,
    pub auth_type: String,
    pub mode: String,
    pub local_bind_host: Option<String>,
    pub local_port: Option<u16>,
    pub remote_host: Option<String>,
    pub remote_port: Option<u16>,
    pub remote_bind_host: Option<String>,
    pub local_target_host: Option<String>,
    pub local_target_port: Option<u16>,
    pub private_key_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TunnelResult {
    pub pid: u32,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct TunnelStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub exit_code: Option<i32>,
    pub ready: bool,
    pub last_error: Option<String>,
    pub stderr_tail: Option<String>,
}

pub fn stop_all_tunnels(state: &Arc<AppState>) {
    let mut processes = state.processes.lock();
    for (_, tunnel) in processes.iter_mut() {
        terminate_tunnel_process(tunnel);
    }
    processes.clear();
}

#[tauri::command]
pub fn get_ssh_binary_path() -> Result<String, String> {
    resolve_ssh_binary().map(|path| path.display().to_string())
}

#[tauri::command]
pub fn get_ssh_version() -> Result<String, String> {
    let ssh_binary = resolve_ssh_binary()?;
    let output = Command::new(ssh_binary)
        .arg("-V")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stderr).trim().to_string())
}

#[tauri::command]
pub fn start_tunnel(
    profile: TunnelProfile,
    password: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<TunnelResult, String> {
    let mut processes = state.processes.lock();
    if processes.contains_key(&profile.id) {
        return Err("Tunnel is already running".to_string());
    }

    let ssh_binary = resolve_ssh_binary()?;
    let mut cmd = Command::new(ssh_binary);
    let args = build_ssh_args(&profile);
    tracing::info!("SSH command: {}", args.join(" "));

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use windows_sys::Win32::System::Threading::CREATE_NO_WINDOW;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd.args(&args);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());

    let mut askpass_script = None;
    if let Some(password) = password {
        let askpass_assets = create_askpass_assets(&password)?;
        let display = std::env::var("DISPLAY").unwrap_or_else(|_| "tauri".to_string());
        cmd.env("DISPLAY", display);
        cmd.env(
            "SSH_ASKPASS",
            askpass_assets.command_path.display().to_string(),
        );
        cmd.env("SSH_ASKPASS_REQUIRE", "force");
        askpass_script = Some(askpass_assets.cleanup_path);
    }

    let mut child = cmd.spawn().map_err(|e| {
        error!("Failed to spawn SSH process: {e}");
        normalize_spawn_error(&e.to_string())
    })?;

    let pid = child.id();
    let stderr_tail = Arc::new(Mutex::new(String::new()));
    let last_error = Arc::new(Mutex::new(None));

    if let Some(stderr) = child.stderr.take() {
        spawn_stderr_reader(stderr, Arc::clone(&stderr_tail), Arc::clone(&last_error));
    }

    processes.insert(
        profile.id.clone(),
        ManagedTunnel {
            child,
            stderr_tail,
            last_error,
            askpass_script,
            ready: false,
            started_at: Instant::now(),
            mode: profile.mode.clone(),
            local_bind_host: profile.local_bind_host.clone(),
            local_port: profile.local_port,
        },
    );

    Ok(TunnelResult {
        pid,
        status: "CONNECTING".to_string(),
    })
}

#[tauri::command]
pub fn stop_tunnel(profile_id: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut processes = state.processes.lock();
    if let Some(mut tunnel) = processes.remove(&profile_id) {
        terminate_tunnel_process(&mut tunnel);
        Ok(())
    } else {
        Err("Tunnel is not running".to_string())
    }
}

#[tauri::command]
pub fn get_tunnel_status(
    profile_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<TunnelStatus, String> {
    let mut processes = state.processes.lock();
    let Some(mut tunnel) = processes.remove(&profile_id) else {
        return Ok(TunnelStatus {
            running: false,
            pid: None,
            exit_code: None,
            ready: false,
            last_error: None,
            stderr_tail: None,
        });
    };

    let pid = tunnel.child.id();
    let stderr_tail = {
        let value = tunnel.stderr_tail.lock().clone();
        if value.is_empty() {
            None
        } else {
            Some(value)
        }
    };

    match tunnel.child.try_wait() {
        Ok(Some(exit)) => Ok(process::exited_tunnel_status(
            &mut tunnel,
            pid,
            stderr_tail,
            exit.code(),
        )),
        Ok(None) => {
            let status = running_tunnel_status(&mut tunnel, pid, stderr_tail);
            processes.insert(profile_id, tunnel);

            Ok(status)
        }
        Err(err) => {
            cleanup_askpass_script(&mut tunnel.askpass_script);
            Err(err.to_string())
        }
    }
}

#[tauri::command]
pub fn check_port_available(port: u16) -> Result<bool, String> {
    let addr = format!("127.0.0.1:{port}");
    Ok(TcpListener::bind(addr).is_ok())
}

#[cfg(test)]
mod tests {
    use super::process::{append_stderr_tail, connectable_local_addr, extract_last_error};
    use super::ssh::{create_askpass_assets, shell_escape_single_quotes, ssh_not_found_message};
    use super::*;
    use std::fs;

    fn sample_profile(mode: &str) -> TunnelProfile {
        TunnelProfile {
            id: "profile-1".to_string(),
            name: "Test".to_string(),
            ssh_host: "example.com".to_string(),
            ssh_port: 2222,
            username: "alice".to_string(),
            auth_type: "password".to_string(),
            mode: mode.to_string(),
            local_bind_host: Some("127.0.0.1".to_string()),
            local_port: Some(8080),
            remote_host: Some("remote.internal".to_string()),
            remote_port: Some(80),
            remote_bind_host: Some("0.0.0.0".to_string()),
            local_target_host: Some("localhost".to_string()),
            local_target_port: Some(3000),
            private_key_path: Some("/tmp/id_rsa".to_string()),
        }
    }

    #[test]
    fn builds_local_ssh_args() {
        let args = build_ssh_args(&sample_profile("LOCAL"));

        assert!(args.contains(&"-L".to_string()));
        assert!(args.contains(&"127.0.0.1:8080:remote.internal:80".to_string()));
        assert!(args.contains(&"-p".to_string()));
        assert!(args.contains(&"2222".to_string()));
        assert_eq!(args.last(), Some(&"alice@example.com".to_string()));
    }

    #[test]
    fn builds_remote_ssh_args() {
        let args = build_ssh_args(&sample_profile("REMOTE"));

        assert!(args.contains(&"-R".to_string()));
        assert!(args.contains(&"0.0.0.0:80:localhost:3000".to_string()));
    }

    #[test]
    fn builds_dynamic_ssh_args() {
        let args = build_ssh_args(&sample_profile("DYNAMIC"));

        assert!(args.contains(&"-D".to_string()));
        assert!(args.contains(&"127.0.0.1:8080".to_string()));
    }

    #[test]
    fn escapes_single_quotes_for_shell() {
        assert_eq!(
            shell_escape_single_quotes("pa'ss"),
            "pa'\"'\"'ss".to_string()
        );
    }

    #[test]
    fn trims_stderr_tail_to_limit() {
        let mut buffer = "a".repeat(STDERR_TAIL_LIMIT - 2);

        append_stderr_tail(&mut buffer, "bcdef");

        assert_eq!(buffer.len(), STDERR_TAIL_LIMIT);
        assert!(buffer.ends_with("bcdef"));
    }

    #[test]
    fn extracts_last_non_empty_error_line() {
        let stderr = "\nwarning\n\nfatal: failed\n";

        assert_eq!(
            extract_last_error(stderr),
            Some("fatal: failed".to_string())
        );
    }

    #[test]
    fn normalizes_unspecified_bind_host_for_connectivity() {
        let addr = connectable_local_addr(Some("0.0.0.0"), 8080).expect("address");

        assert_eq!(addr.ip().to_string(), "127.0.0.1");
        assert_eq!(addr.port(), 8080);
    }

    #[test]
    fn normalizes_windows_missing_ssh_spawn_error() {
        let input = "The system cannot find the file specified. (os error 2)";
        let normalized = if cfg!(target_os = "windows") {
            normalize_spawn_error(input)
        } else {
            input.to_string()
        };

        if cfg!(target_os = "windows") {
            assert!(normalized.contains("OpenSSH Client"));
        } else {
            assert_eq!(normalized, input);
        }
    }

    #[test]
    fn windows_ssh_not_found_message_mentions_install_guidance() {
        let message = ssh_not_found_message();

        if cfg!(target_os = "windows") {
            assert!(message.contains("OpenSSH Client"));
            assert!(message.contains("Add-WindowsCapability"));
        } else {
            assert!(message.contains("SSH client"));
        }
    }

    #[test]
    fn creates_platform_specific_askpass_assets() {
        let password = uuid::Uuid::new_v4().to_string();
        let assets = create_askpass_assets(&password).expect("askpass assets");

        assert!(assets.command_path.exists());
        assert!(assets.cleanup_path.exists());

        if cfg!(target_os = "windows") {
            assert_eq!(
                assets.command_path.extension().and_then(|ext| ext.to_str()),
                Some("cmd")
            );
            let script = fs::read_to_string(&assets.command_path).expect("read cmd");
            assert!(script.contains("type \""));
        } else {
            assert_eq!(
                assets.command_path.extension().and_then(|ext| ext.to_str()),
                Some("sh")
            );
            let script = fs::read_to_string(&assets.command_path).expect("read script");
            assert!(script.contains("printf '%s\\n' '"));
            assert!(script.contains(&password));
        }

        fs::remove_dir_all(assets.cleanup_path).expect("cleanup askpass");
    }
}
