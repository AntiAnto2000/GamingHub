pub mod discord;
pub mod modrinth;
pub mod monitor;
pub mod music;
pub mod minecraft_server;
pub mod sessions;
pub mod steam;
pub mod steam_stats;
pub mod store;
pub mod spotify_auth;
use monitor::{Monitor, Telemetry};
use serde::Serialize;
use sessions::{Session, Sessions};
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{Manager, State};
#[derive(Clone)]
pub struct Hub(pub Arc<Mutex<HubData>>);
pub struct HubData {
    telemetry: Option<Telemetry>,
    sessions: Sessions,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    telemetry: Option<Telemetry>,
    sessions: Vec<Session>,
    storage_error: Option<String>,
}
impl Hub {
    pub fn start(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let file = app.path().app_data_dir()?.join("sessions.json");
        let hub = Self(Arc::new(Mutex::new(HubData {
            telemetry: None,
            sessions: Sessions::load(file),
        })));
        let thread_hub = hub.clone();
        std::thread::spawn(move || {
            let mut monitor = Monitor::new();
            let mut ticks = 0;
            loop {
                std::thread::sleep(Duration::from_secs(2));
                let data = monitor.sample();
                if let Ok(mut hub) = thread_hub.0.lock() {
                    hub.sessions.tick(&data);
                    hub.telemetry = Some(data);
                    ticks += 1;
                    if ticks % 5 == 0 {
                        hub.sessions.persist();
                    }
                }
            }
        });
        Ok(hub)
    }
}
#[tauri::command]
pub fn hub_snapshot(hub: State<'_, Hub>) -> Result<Snapshot, String> {
    let hub = hub.0.lock().map_err(|e| e.to_string())?;
    Ok(Snapshot {
        telemetry: hub.telemetry.clone(),
        sessions: hub.sessions.records.clone(),
        storage_error: hub.sessions.error.clone(),
    })
}
#[tauri::command]
pub fn launch_game(
    hub: State<'_, Hub>,
    game_id: String,
    name: String,
    path: String,
) -> Result<String, String> {
    hub.0
        .lock()
        .map_err(|e| e.to_string())?
        .sessions
        .launch(game_id, name, path)
}
#[tauri::command]
pub fn finish_session(hub: State<'_, Hub>, id: String) -> Result<(), String> {
    hub.0
        .lock()
        .map_err(|e| e.to_string())?
        .sessions
        .finish(&id)
}
#[tauri::command]
pub async fn pick_game() -> Result<Option<String>, String> {
    Ok(rfd::AsyncFileDialog::new()
        .set_title("Spiel oder Programm auswählen")
        .add_filter("Windows-Programme", &["exe"])
        .pick_file()
        .await
        .map(|f| f.path().to_string_lossy().to_string()))
}
