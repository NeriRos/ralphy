use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

struct SidecarState {
    process: Mutex<Option<Child>>,
    port: Mutex<u16>,
}

fn spawn_sidecar() -> (Child, u16) {
    let mut child = Command::new("bun")
        .arg("run")
        .arg("src-sidecar/server.ts")
        .stdout(Stdio::piped())
        .current_dir(env!("CARGO_MANIFEST_DIR").to_owned() + "/..")
        .spawn()
        .expect("Failed to start sidecar. Is bun installed?");

    // Read stdout lines until we find the port announcement
    let stdout = child.stdout.take().expect("Failed to capture sidecar stdout");
    let reader = std::io::BufReader::new(stdout);
    let mut port: u16 = 0;

    for line in reader.lines() {
        let line = line.expect("Failed to read sidecar stdout");
        if let Some(port_str) = line.strip_prefix("SIDECAR_PORT:") {
            port = port_str
                .trim()
                .parse()
                .expect("Sidecar printed invalid port");
            break;
        }
    }

    if port == 0 {
        panic!("Sidecar exited without reporting a port");
    }

    (child, port)
}

#[tauri::command]
fn get_sidecar_url(state: tauri::State<SidecarState>) -> String {
    let port = state.port.lock().unwrap();
    format!("http://localhost:{}", *port)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (child, port) = spawn_sidecar();

    tauri::Builder::default()
        .manage(SidecarState {
            process: Mutex::new(Some(child)),
            port: Mutex::new(port),
        })
        .invoke_handler(tauri::generate_handler![get_sidecar_url])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<SidecarState>();
                let mut guard = state.process.lock().unwrap();
                if let Some(ref mut child) = *guard {
                    let _ = child.kill();
                }
                drop(guard);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
