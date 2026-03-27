use super::{ManagedTunnel, LOCAL_READY_TIMEOUT, REMOTE_READY_DELAY, STDERR_TAIL_LIMIT};
use parking_lot::Mutex;
use std::fs;
use std::io::Read;
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use tracing::warn;

pub(super) fn append_stderr_tail(buffer: &mut String, chunk: &str) {
    buffer.push_str(chunk);
    if buffer.len() > STDERR_TAIL_LIMIT {
        let trim_at = buffer.len() - STDERR_TAIL_LIMIT;
        buffer.drain(..trim_at);
    }
}

pub(super) fn extract_last_error(stderr_tail: &str) -> Option<String> {
    stderr_tail
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToOwned::to_owned)
}

pub(super) fn spawn_stderr_reader(
    mut stderr: impl Read + Send + 'static,
    buffer: Arc<Mutex<String>>,
    last_error: Arc<Mutex<Option<String>>>,
) {
    thread::spawn(move || {
        let mut chunk = [0u8; 1024];
        while let Some(read) = next_stderr_chunk(&mut stderr, &mut chunk) {
            // Keep a short rolling tail so failures still surface after the process exits.
            let text = String::from_utf8_lossy(&chunk[..read]).to_string();
            let mut stderr_tail = buffer.lock();
            append_stderr_tail(&mut stderr_tail, &text);
            *last_error.lock() = extract_last_error(&stderr_tail);
        }
    });
}

fn next_stderr_chunk(
    stderr: &mut (impl Read + Send + 'static),
    chunk: &mut [u8; 1024],
) -> Option<usize> {
    match stderr.read(chunk) {
        Ok(0) => None,
        Ok(read) => Some(read),
        Err(err) => {
            warn!("Failed to read ssh stderr: {err}");
            None
        }
    }
}

pub(super) fn connectable_local_addr(bind_host: Option<&str>, port: u16) -> Option<SocketAddr> {
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

    TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(200)).is_ok()
}

pub(super) fn update_ready_state(tunnel: &mut ManagedTunnel) -> bool {
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

pub(super) fn cleanup_askpass_script(script_path: &mut Option<PathBuf>) {
    if let Some(path) = script_path.take() {
        let _ = fs::remove_dir_all(path);
    }
}

pub(super) fn terminate_tunnel_process(tunnel: &mut ManagedTunnel) {
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

pub(super) fn exited_tunnel_status(
    tunnel: &mut ManagedTunnel,
    pid: u32,
    stderr_tail: Option<String>,
    exit_code: Option<i32>,
) -> super::TunnelStatus {
    if tunnel.mode != "REMOTE" && !tunnel.ready && tunnel.started_at.elapsed() > LOCAL_READY_TIMEOUT
    {
        *tunnel.last_error.lock() = Some("Tunnel did not become ready before timeout".to_string());
    }

    let last_error = tunnel.last_error.lock().clone().or_else(|| {
        stderr_tail
            .clone()
            .and_then(|tail| extract_last_error(&tail))
    });
    cleanup_askpass_script(&mut tunnel.askpass_script);

    super::TunnelStatus {
        running: false,
        pid: Some(pid),
        exit_code,
        ready: false,
        last_error,
        stderr_tail,
    }
}

pub(super) fn running_tunnel_status(
    tunnel: &mut ManagedTunnel,
    pid: u32,
    stderr_tail: Option<String>,
) -> super::TunnelStatus {
    let ready = update_ready_state(tunnel);
    let last_error = tunnel.last_error.lock().clone();

    super::TunnelStatus {
        running: true,
        pid: Some(pid),
        exit_code: None,
        ready,
        last_error,
        stderr_tail,
    }
}
