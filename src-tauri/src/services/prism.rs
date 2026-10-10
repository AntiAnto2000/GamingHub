use serde::Serialize;
use std::{fs, path::{Path, PathBuf}, process::Command};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PrismInstance {
    pub id: String,
    pub name: String,
    pub path: String,
    pub version: String,
    pub loader: String,
}

fn launcher_candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        paths.push(PathBuf::from(program_files).join("PrismLauncher/prismlauncher.exe"));
    }
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let local = PathBuf::from(local);
        paths.push(local.join("Programs/PrismLauncher/prismlauncher.exe"));
        paths.push(local.join("PrismLauncher/prismlauncher.exe"));
    }
    paths
}

fn launcher() -> Result<PathBuf, String> {
    launcher_candidates().into_iter().find(|path| path.is_file()).ok_or_else(||
        "Prism Launcher wurde nicht gefunden. Installiere ihn über prismlauncher.org oder WinGet und starte ihn einmal.".into()
    )
}

fn root() -> PathBuf {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_default()
        .join("PrismLauncher")
}

fn value_from_cfg(path: &Path, key: &str) -> Option<String> {
    fs::read_to_string(path).ok()?.lines().find_map(|line| {
        let (candidate, value) = line.split_once('=')?;
        (candidate.trim() == key).then(|| value.trim().to_string())
    })
}

fn metadata(path: &Path) -> (String, String) {
    let value: serde_json::Value = fs::read_to_string(path.join("mmc-pack.json"))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default();
    let components = value.get("components").and_then(|item| item.as_array());
    let version = components.and_then(|items| items.iter().find(|item| item.get("uid").and_then(|v| v.as_str()) == Some("net.minecraft")))
        .and_then(|item| item.get("version")).and_then(|v| v.as_str()).unwrap_or("unbekannt").to_string();
    let loader = components.and_then(|items| items.iter().find_map(|item| {
        let uid = item.get("uid")?.as_str()?;
        ["fabric", "forge", "neoforge", "quilt", "liteloader"].into_iter().find(|loader| uid.to_lowercase().contains(loader)).map(str::to_string)
    })).unwrap_or_else(|| "Vanilla".into());
    (version, loader)
}

fn scan() -> Result<Vec<PrismInstance>, String> {
    let instances = root().join("instances");
    let mut output = Vec::new();
    for entry in fs::read_dir(&instances).map_err(|_| "Keine Prism-Instanzen gefunden. Starte Prism Launcher einmal und lege oder importiere dort ein Modpack an.")? {
        let entry = entry.map_err(|_| "Eine Prism-Instanz konnte nicht gelesen werden.")?;
        if !entry.file_type().map_err(|_| "Instanztyp konnte nicht gelesen werden.")?.is_dir() { continue; }
        let path = entry.path();
        let id = entry.file_name().to_string_lossy().to_string();
        let name = value_from_cfg(&path.join("instance.cfg"), "name").filter(|value| !value.is_empty()).unwrap_or_else(|| id.clone());
        let (version, loader) = metadata(&path);
        output.push(PrismInstance { id, name, path: path.to_string_lossy().to_string(), version, loader });
    }
    output.sort_by_key(|instance| instance.name.to_lowercase());
    Ok(output)
}

#[tauri::command]
pub async fn scan_prism() -> Result<Vec<PrismInstance>, String> {
    tauri::async_runtime::spawn_blocking(scan).await.map_err(|_| String::from("Prism-Scan fehlgeschlagen."))?
}

#[tauri::command]
pub fn open_prism() -> Result<(), String> {
    Command::new(launcher()?).spawn().map(|_| ()).map_err(|_| "Prism Launcher konnte nicht geöffnet werden.".into())
}

#[tauri::command]
pub fn launch_prism(instance_id: String, instance_path: String) -> Result<(), String> {
    if instance_id.is_empty() || instance_id.len() > 160 || instance_id.contains(['/', '\\', ':']) {
        return Err("Ungültige Prism-Instanz-ID.".into());
    }
    let expected = root().join("instances").canonicalize().map_err(|_| "Prism-Instanzordner wurde nicht gefunden.")?;
    let selected = PathBuf::from(instance_path).canonicalize().map_err(|_| "Die Prism-Instanz wurde nicht gefunden.")?;
    if !selected.starts_with(expected) || selected.file_name().and_then(|value| value.to_str()) != Some(instance_id.as_str()) {
        return Err("Die ausgewählte Prism-Instanz ist ungültig.".into());
    }
    Command::new(launcher()?).args(["--launch", &instance_id]).spawn().map(|_| ()).map_err(|_| "Das Modpack konnte über Prism nicht gestartet werden.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn root_uses_prism_data_directory() { assert!(root().to_string_lossy().contains("PrismLauncher")); }
    #[test]
    fn unsafe_ids_are_rejected_before_launch() {
        assert!(launch_prism("../bad".into(), "C:\\bad".into()).is_err());
    }
}
