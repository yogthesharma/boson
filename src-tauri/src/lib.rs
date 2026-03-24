use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State, Window};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalDataEvent {
    session_id: u32,
    data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExitEvent {
    session_id: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalCreateResponse {
    session_id: u32,
    shell: String,
}

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send>,
}

#[derive(Default)]
struct TerminalState {
    next_id: AtomicU32,
    sessions: Mutex<HashMap<u32, Arc<Mutex<TerminalSession>>>>,
}

fn default_shell() -> String {
    if cfg!(target_os = "windows") {
        "powershell.exe".to_string()
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
}

#[tauri::command]
fn terminal_create(
    window: Window,
    state: State<TerminalState>,
    cwd: String,
) -> Result<TerminalCreateResponse, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = default_shell();
    let mut cmd = CommandBuilder::new(shell.clone());
    cmd.cwd(cwd);
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| e.to_string())?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let session_id = state.next_id.fetch_add(1, Ordering::Relaxed) + 1;
    let app = window.app_handle().clone();

    std::thread::spawn(move || {
        let mut buf = vec![0_u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit(
                        "terminal-data",
                        TerminalDataEvent {
                            session_id,
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
        let _ = app.emit("terminal-exit", TerminalExitEvent { session_id });
    });

    let session = TerminalSession {
        master: pair.master,
        writer,
        child,
    };
    let mut sessions = state.sessions.lock().map_err(|_| "lock poisoned".to_string())?;
    sessions.insert(session_id, Arc::new(Mutex::new(session)));
    Ok(TerminalCreateResponse { session_id, shell })
}

#[tauri::command]
fn terminal_write(state: State<TerminalState>, session_id: u32, data: String) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|_| "lock poisoned".to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "terminal session not found".to_string())?;
    let mut locked = session.lock().map_err(|_| "session lock poisoned".to_string())?;
    locked
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    locked.writer.flush().map_err(|e| e.to_string())
}

#[tauri::command]
fn terminal_resize(
    state: State<TerminalState>,
    session_id: u32,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|_| "lock poisoned".to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| "terminal session not found".to_string())?;
    let locked = session.lock().map_err(|_| "session lock poisoned".to_string())?;
    locked
        .master
        .resize(PtySize {
            rows: rows.max(2),
            cols: cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn terminal_kill(state: State<TerminalState>, session_id: u32) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|_| "lock poisoned".to_string())?;
    let session = sessions
        .remove(&session_id)
        .ok_or_else(|| "terminal session not found".to_string())?;
    let mut locked = session.lock().map_err(|_| "session lock poisoned".to_string())?;
    locked.child.kill().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(TerminalState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            terminal_create,
            terminal_write,
            terminal_resize,
            terminal_kill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
