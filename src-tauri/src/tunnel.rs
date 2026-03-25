use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write as IoWrite};
use std::net::{SocketAddr, TcpListener, TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::State;
use tracing::{error, warn};
use uuid::Uuid;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

const STDERR_TAIL_LIMIT: usize = 8192;
const REMOTE_READY_DELAY: Duration = Duration::from_millis(800);
const LOCAL_READY_TIMEOUT: Duration = Duration::from_secs(15);

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

fn get_ssh_binary() -> String {
    "/usr/bin/ssh".to_string()
}

fn build_ssh_args(profile: &TunnelProfile) -> Vec<String> {
    let mut args = vec![
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
    ];

    if profile.ssh_port != 22 {
        args.push("-p".to_string());
        args.push(profile.ssh_port.to_string());
    }

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

    if let Some(ref key_path) = profile.private_key_path {
        if !key_path.is_empty() {
            args.push("-i".to_string());
            args.push(key_path.clone());
        }
    }

    args.push(format!("{}@{}", profile.username, profile.ssh_host));
    args
}

fn shell_escape_single_quotes(value: &str) -> String {
    value.replace('\'', "'\"'\"'")
}

fn create_askpass_script(password: &str) -> Result<PathBuf, String> {
    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join(format!("tunnel-manager-askpass-{}", Uuid::new_v4()));
    let escaped = shell_escape_single_quotes(password);
    let script_content = format!("#!/bin/bash\nprintf '%s\\n' '{escaped}'\n");

    let mut file = fs::File::create(&script_path).map_err(|e| e.to_string())?;
    file.write_all(script_content.as_bytes())
        .map_err(|e| e.to_string())?;
    fs::set_permissions(&script_path, fs::Permissions::from_mode(0o700))
        .map_err(|e| e.to_string())?;

    Ok(script_path)
}

fn append_stderr_tail(buffer: &mut String, chunk: &str) {
    buffer.push_str(chunk);
    if buffer.len() > STDERR_TAIL_LIMIT {
        let trim_at = buffer.len() - STDERR_TAIL_LIMIT;
        buffer.drain(..trim_at);
    }
}

fn extract_last_error(stderr_tail: &str) -> Option<String> {
    stderr_tail
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToOwned::to_owned)
}

fn spawn_stderr_reader(
    mut stderr: impl Read + Send + 'static,
    buffer: Arc<Mutex<String>>,
    last_error: Arc<Mutex<Option<String>>>,
) {
    thread::spawn(move || {
        let mut chunk = [0u8; 1024];
        loop {
            match stderr.read(&mut chunk) {
                Ok(0) => break,
                Ok(read) => {
                    let text = String::from_utf8_lossy(&chunk[..read]).to_string();
                    let mut stderr_tail = buffer.lock();
                    append_stderr_tail(&mut stderr_tail, &text);
                    *last_error.lock() = extract_last_error(&stderr_tail);
                }
                Err(_) => break,
            }
        }
    });
}

fn connectable_local_addr(bind_host: Option<&str>, port: u16) -> Option<SocketAddr> {
    let host = match bind_host.unwrap_or("127.0.0.1") {
        "0.0.0.0" | "::" | "" => "127.0.0.1",
        value => value,
    };

    (host, port)
        .to_socket_addrs()
        .ok()?
        .find(|addr| matches!(addr, SocketAddr::V4(_) | SocketAddr::V6(_)))
}

fn is_local_port_ready(bind_host: Option<&str>, port: u16) -> bool {
    let Some(addr) = connectable_local_addr(bind_host, port) else {
        return false;
    };

    TcpStream::connect_timeout(&addr, Duration::from_millis(200)).is_ok()
}

fn update_ready_state(tunnel: &mut ManagedTunnel) -> bool {
    if tunnel.ready {
        return true;
    }

    let ready = match tunnel.mode.as_str() {
        "LOCAL" | "DYNAMIC" => match tunnel.local_port {
            Some(port) => is_local_port_ready(tunnel.local_bind_host.as_deref(), port),
            None => false,
        },
        "REMOTE" => tunnel.started_at.elapsed() >= REMOTE_READY_DELAY,
        _ => false,
    };

    tunnel.ready = ready;
    ready
}

fn cleanup_askpass_script(script_path: &mut Option<PathBuf>) {
    if let Some(path) = script_path.take() {
        let _ = fs::remove_file(path);
    }
}

fn terminate_tunnel_process(tunnel: &mut ManagedTunnel) {
    #[cfg(unix)]
    {
        let pid = tunnel.child.id();
        let _ = unsafe { libc::kill(-(pid as libc::pid_t), libc::SIGTERM) };
    }
    #[cfg(not(unix))]
    {
        let _ = tunnel.child.kill();
    }

    if let Err(err) = tunnel.child.wait() {
        warn!("Error waiting for tunnel process: {err}");
    }
    cleanup_askpass_script(&mut tunnel.askpass_script);
}

pub fn stop_all_tunnels(state: &Arc<AppState>) {
    let mut processes = state.processes.lock();
    for (_, tunnel) in processes.iter_mut() {
        terminate_tunnel_process(tunnel);
    }
    processes.clear();
}

#[tauri::command]
pub fn get_ssh_binary_path() -> String {
    get_ssh_binary()
}

#[tauri::command]
pub fn get_ssh_version() -> Result<String, String> {
    let output = Command::new(get_ssh_binary())
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

    let mut cmd = Command::new(get_ssh_binary());
    let args = build_ssh_args(&profile);
    tracing::info!("SSH command: {}", args.join(" "));

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }

    cmd.args(&args);
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::null());
    cmd.stderr(Stdio::piped());

    let mut askpass_script = None;
    if let Some(password) = password {
        let script_path = create_askpass_script(&password)?;
        let display = std::env::var("DISPLAY").unwrap_or_else(|_| "tauri".to_string());
        cmd.env("DISPLAY", display);
        cmd.env("SSH_ASKPASS", script_path.display().to_string());
        cmd.env("SSH_ASKPASS_REQUIRE", "force");
        askpass_script = Some(script_path);
    }

    let mut child = cmd.spawn().map_err(|e| {
        error!("Failed to spawn SSH process: {e}");
        e.to_string()
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
        Ok(Some(exit)) => {
            if tunnel.mode != "REMOTE"
                && !tunnel.ready
                && tunnel.started_at.elapsed() > LOCAL_READY_TIMEOUT
            {
                *tunnel.last_error.lock() =
                    Some("Tunnel did not become ready before timeout".to_string());
            }

            let last_error = tunnel.last_error.lock().clone().or_else(|| {
                stderr_tail
                    .clone()
                    .and_then(|tail| extract_last_error(&tail))
            });
            cleanup_askpass_script(&mut tunnel.askpass_script);

            Ok(TunnelStatus {
                running: false,
                pid: Some(pid),
                exit_code: exit.code(),
                ready: false,
                last_error,
                stderr_tail,
            })
        }
        Ok(None) => {
            let ready = update_ready_state(&mut tunnel);
            let last_error = tunnel.last_error.lock().clone();
            processes.insert(profile_id, tunnel);

            Ok(TunnelStatus {
                running: true,
                pid: Some(pid),
                exit_code: None,
                ready,
                last_error,
                stderr_tail,
            })
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
    use super::*;

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
}
