use serde::Serialize;
use std::{fs, path::PathBuf};
use tauri_plugin_opener::OpenerExt;
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModrinthProfile {
    pub name: String,
    pub path: String,
    pub version: String,
    pub loader: String,
}
fn root() -> PathBuf {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_default()
        .join("ModrinthApp/profiles")
}
#[tauri::command]
pub fn open_modrinth(app: tauri::AppHandle) -> Result<(), String> {
    let exe = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_default()
        .join("Modrinth App/Modrinth App.exe");
    if !exe.is_file() {
        return Err("Modrinth App.exe wurde nicht gefunden. Bitte Modrinth installieren.".into());
    }
    app.opener()
        .open_path(exe.to_string_lossy().to_string(), None::<&str>)
        .map_err(|_| "Modrinth konnte nicht gestartet werden.".into())
}
#[tauri::command]
pub fn open_labymod(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let exe = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_default()
        .join("labymodlauncher/LabyModLauncher.exe");
    if !exe.is_file() {
        return Err("LabyModLauncher.exe wurde an diesem Pfad nicht gefunden.".into());
    }
    app.opener()
        .open_path(exe.to_string_lossy().to_string(), None::<&str>)
        .map_err(|_| "LabyMod Launcher konnte nicht gestartet werden.".into())
}
fn scan() -> Result<Vec<ModrinthProfile>, String> {
    let dir = root();
    let mut out = vec![];
    for e in fs::read_dir(&dir).map_err(|_| {
        "Modrinth-App oder Profile wurden nicht gefunden. Bitte Modrinth zuerst starten."
    })? {
        let e = e.map_err(|_| "Modrinth-Profil konnte nicht gelesen werden.")?;
        if !e
            .file_type()
            .map_err(|_| "Profil konnte nicht gelesen werden.")?
            .is_dir()
        {
            continue;
        }
        let p = e.path();
        let cfg = p.join("profile.json");
        let text = fs::read_to_string(&cfg).unwrap_or_default();
        let v: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
        out.push(ModrinthProfile {
            name: e.file_name().to_string_lossy().to_string(),
            path: p.to_string_lossy().to_string(),
            version: v
                .get("game_version")
                .and_then(|x| x.as_str())
                .unwrap_or("unbekannt")
                .into(),
            loader: v
                .get("loader")
                .and_then(|x| x.as_str())
                .unwrap_or("unbekannt")
                .into(),
        });
    }
    out.sort_by_key(|p| p.name.to_lowercase());
    Ok(out)
}
#[tauri::command]
pub async fn scan_modrinth() -> Result<Vec<ModrinthProfile>, String> {
    tauri::async_runtime::spawn_blocking(scan)
        .await
        .map_err(|_| String::from("Modrinth-Scan fehlgeschlagen."))?
}
#[tauri::command]
pub fn launch_modrinth(app: tauri::AppHandle, profile_path: String) -> Result<(), String> {
    let p = PathBuf::from(&profile_path);
    let root = root();
    let c = p
        .canonicalize()
        .map_err(|_| "Profilordner nicht gefunden.")?;
    let r = root
        .canonicalize()
        .map_err(|_| "Modrinth-Profilordner nicht gefunden.")?;
    if !c.starts_with(&r) {
        return Err("Ungültiger Modrinth-Profilordner.".into());
    }
    let exe = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_default()
        .join("Modrinth App/Modrinth App.exe");
    if !exe.is_file() {
        return Err("Modrinth App.exe wurde nicht gefunden. Bitte Modrinth installieren.".into());
    }
    app.opener()
        .open_path(exe.to_string_lossy().to_string(), None::<&str>)
        .map_err(|_| "Profilordner konnte nicht geöffnet werden.".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn root_is_appdata() {
        assert!(root().to_string_lossy().contains("ModrinthApp"));
    }
}
