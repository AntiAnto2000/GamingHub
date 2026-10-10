use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDiagnostic { name: String, status: String, detail: String }

fn crash_file(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_log_dir().map_err(|e| e.to_string())?.join("crash.log"))
}

#[tauri::command]
pub fn native_diagnostics(app: tauri::AppHandle) -> Vec<NativeDiagnostic> {
    let mut rows = Vec::new();
    let data = app.path().app_data_dir();
    rows.push(NativeDiagnostic { name: "App-Daten".into(), status: if data.is_ok() { "ok" } else { "error" }.into(), detail: data.map(|p| p.display().to_string()).unwrap_or_else(|e| e.to_string()) });
    let credentials = keyring::Entry::new("GamingHub", "diagnostic-probe");
    rows.push(NativeDiagnostic { name: "Windows-Anmeldespeicher".into(), status: if credentials.is_ok() { "ok" } else { "error" }.into(), detail: if credentials.is_ok() { "Sichere Speicherung verfügbar".into() } else { "Nicht verfügbar".into() } });
    let crash = crash_file(&app).ok().filter(|path| path.exists());
    rows.push(NativeDiagnostic { name: "Absturzprotokoll".into(), status: if crash.is_some() { "warning" } else { "ok" }.into(), detail: crash.map(|p| p.display().to_string()).unwrap_or_else(|| "Kein Absturz protokolliert".into()) });
    rows
}

#[tauri::command]
pub fn read_crash_log(app: tauri::AppHandle) -> Result<String, String> {
    let path = crash_file(&app)?;
    if !path.exists() { return Ok("Kein Absturzprotokoll vorhanden.".into()); }
    let value = fs::read_to_string(path).map_err(|e| e.to_string())?;
    Ok(value.chars().rev().take(20_000).collect::<String>().chars().rev().collect())
}

pub fn install_panic_log() {
    std::panic::set_hook(Box::new(|info| {
        let root = std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir).join("GamingHub").join("logs");
        let _ = fs::create_dir_all(&root);
        let _ = fs::write(root.join("crash.log"), format!("GamingHub panic: {info}\n"));
    }));
}
