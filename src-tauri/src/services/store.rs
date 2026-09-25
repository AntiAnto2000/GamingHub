use std::process::Command;
#[tauri::command]
pub fn launch_store_app(aumid: String) -> Result<(), String> {
    let id = aumid.trim();
    if id.is_empty() || id.len() > 240 || id.contains(['/', '\\', '"', '\'', ';', '&', '|']) {
        return Err("Ungültige Windows-App-ID.".into());
    }
    Command::new("explorer.exe")
        .arg(format!("shell:AppsFolder\\{id}"))
        .spawn()
        .map(|_| ())
        .map_err(|_| "Microsoft-Store-App konnte nicht gestartet werden.".into())
}
#[tauri::command]
pub fn open_store(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url("ms-windows-store://home", None::<&str>)
        .map_err(|_| "Microsoft Store konnte nicht geöffnet werden.".into())
}
#[cfg(test)]
mod tests {
    #[test]
    fn rejects_shell_chars() {
        assert!(super::launch_store_app("x;y".into()).is_err());
    }
}
