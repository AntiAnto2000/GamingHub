use serde::Serialize;
use std::{
    collections::HashSet,
    fs,
    io::Read,
    path::{Component, Path, PathBuf},
};
use tauri_plugin_opener::OpenerExt;

#[derive(Clone, Debug)]
pub(super) enum Value {
    Text(String),
    Object(Vec<(String, Value)>),
}
impl Value {
    pub(super) fn get(&self, key: &str) -> Option<&Value> {
        match self {
            Self::Object(items) => items
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(key))
                .map(|(_, v)| v),
            _ => None,
        }
    }
    pub(super) fn text(&self) -> Option<&str> {
        match self {
            Self::Text(s) => Some(s),
            _ => None,
        }
    }
}

// Valve KeyValues: quoted/unquoted tokens, escaped quotes/backslashes and line comments.
// Bound recursion and file size because these files can be incomplete during Steam updates.
fn parse(input: &str) -> Result<Value, String> {
    let mut chars = input.trim_start_matches('\u{feff}').chars().peekable();
    let mut tokens: Vec<String> = vec![];
    while let Some(c) = chars.next() {
        if c.is_whitespace() {
            continue;
        }
        if c == '/' && chars.peek() == Some(&'/') {
            chars.next();
            for c in chars.by_ref() {
                if c == '\n' {
                    break;
                }
            }
            continue;
        }
        if c == '{' || c == '}' {
            tokens.push(c.to_string());
            continue;
        }
        let mut token = String::new();
        if c == '"' {
            let mut closed = false;
            while let Some(c) = chars.next() {
                if c == '"' {
                    closed = true;
                    break;
                }
                if c == '\\' {
                    match chars.peek().copied() {
                        Some('\\' | '"') => token.push(chars.next().unwrap()),
                        _ => token.push(c),
                    }
                } else {
                    token.push(c);
                }
            }
            if !closed {
                return Err("Unvollständige Zeichenkette".into());
            }
            // Prefix string tokens so literal braces cannot become structural tokens.
            tokens.push(format!("s{token}"));
        } else {
            token.push(c);
            while chars
                .peek()
                .is_some_and(|c| !c.is_whitespace() && *c != '{' && *c != '}')
            {
                token.push(chars.next().unwrap());
            }
            tokens.push(format!("s{token}"));
        }
    }
    fn object(tokens: &[String], pos: &mut usize, depth: usize) -> Result<Value, String> {
        if depth > 24 {
            return Err("Zu tief verschachtelte Datei".into());
        }
        let mut items = vec![];
        while *pos < tokens.len() {
            if tokens[*pos] == "}" {
                if depth == 0 {
                    return Err("Unerwartete schließende Klammer".into());
                }
                *pos += 1;
                return Ok(Value::Object(items));
            }
            let key = tokens[*pos]
                .strip_prefix('s')
                .ok_or("Schlüssel erwartet")?
                .to_string();
            *pos += 1;
            let token = tokens.get(*pos).ok_or("Wert fehlt")?;
            *pos += 1;
            let value = if token == "{" {
                object(tokens, pos, depth + 1)?
            } else {
                Value::Text(token.strip_prefix('s').ok_or("Wert erwartet")?.to_string())
            };
            items.push((key, value));
        }
        if depth != 0 {
            return Err("Schließende Klammer fehlt".into());
        }
        Ok(Value::Object(items))
    }
    object(&tokens, &mut 0, 0)
}

pub(super) fn read_vdf(path: &Path) -> Result<Value, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut bytes = vec![];
    file.take(2_097_153)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > 2_097_152 {
        return Err("Datei ist ungewöhnlich groß".into());
    }
    parse(std::str::from_utf8(&bytes).map_err(|e| e.to_string())?)
}

#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SteamGame {
    pub app_id: u32,
    pub name: String,
    pub install_dir: String,
    pub library: String,
    pub update_required: bool,
}
#[derive(Serialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Scan {
    pub games: Vec<SteamGame>,
    pub libraries: Vec<String>,
    pub warnings: Vec<String>,
}

fn library_root(path: PathBuf) -> PathBuf {
    if path
        .file_name()
        .is_some_and(|s| s.eq_ignore_ascii_case("steamapps"))
    {
        path.parent().unwrap_or(&path).to_path_buf()
    } else {
        path
    }
}
pub(super) fn detected_roots() -> Vec<PathBuf> {
    use winreg::{
        enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY},
        RegKey,
    };
    let mut roots = vec![];
    for (hive, subkey, value, flags) in [
        (
            HKEY_CURRENT_USER,
            "Software\\Valve\\Steam",
            "SteamPath",
            KEY_READ,
        ),
        (
            HKEY_LOCAL_MACHINE,
            "Software\\Valve\\Steam",
            "InstallPath",
            KEY_READ | KEY_WOW64_32KEY,
        ),
    ] {
        if let Ok(key) = RegKey::predef(hive).open_subkey_with_flags(subkey, flags) {
            if let Ok(value) = key.get_value::<String, _>(value) {
                roots.push(PathBuf::from(value));
            }
        }
    }
    for name in ["ProgramFiles(x86)", "ProgramFiles"] {
        if let Some(dir) = std::env::var_os(name) {
            let path = PathBuf::from(dir).join("Steam");
            if path.join("steamapps").is_dir() {
                roots.push(path);
            }
        }
    }
    roots
}
fn game_from_manifest(library: &Path, app_id: u32) -> Result<Option<SteamGame>, String> {
    if app_id == 0 || app_id == 228980 {
        return Ok(None);
    } // Shared Steamworks runtime is not a game.
    let data = read_vdf(
        &library
            .join("steamapps")
            .join(format!("appmanifest_{app_id}.acf")),
    )?;
    let state = data.get("AppState").ok_or("AppState fehlt")?;
    let value = |key| {
        state
            .get(key)
            .and_then(Value::text)
            .ok_or_else(|| format!("{key} fehlt"))
    };
    if value("appid")?.parse::<u32>().ok() != Some(app_id) {
        return Err("App-ID passt nicht zum Dateinamen".into());
    }
    let flags = value("StateFlags")?
        .parse::<u32>()
        .map_err(|_| "Ungültiger Installationsstatus")?;
    if flags & 4 == 0 {
        return Ok(None);
    }
    let name = value("name")?.trim();
    if name.is_empty() {
        return Err("Spielname fehlt".into());
    }
    let dir = value("installdir")?;
    let mut components = Path::new(dir).components();
    if !matches!(components.next(), Some(Component::Normal(_)))
        || components.next().is_some()
        || dir.contains(['/', '\\'])
    {
        return Err("Ungültiger Spielordner".into());
    }
    let common = library.join("steamapps").join("common");
    let installed = common.join(dir);
    if !installed.is_dir() {
        return Ok(None);
    }
    Ok(Some(SteamGame {
        app_id,
        name: name.to_string(),
        install_dir: installed.to_string_lossy().into(),
        library: library.to_string_lossy().into(),
        update_required: flags & 2 != 0,
    }))
}

fn scan_roots(roots: Vec<PathBuf>) -> Scan {
    let mut result = Scan::default();
    let mut pending = roots;
    let mut seen = HashSet::new();
    let mut apps = HashSet::new();
    while let Some(root) = pending.pop() {
        let root = library_root(root);
        if !root.is_absolute() {
            result
                .warnings
                .push("Bitte einen absoluten Steam-Ordner auswählen.".into());
            continue;
        }
        let key = root.to_string_lossy().to_lowercase();
        if !seen.insert(key) {
            continue;
        }
        let root = match root.canonicalize() {
            Ok(p) => p,
            Err(_) => {
                result
                    .warnings
                    .push(format!("Bibliothek nicht erreichbar: {}", root.display()));
                continue;
            }
        };
        let normalized = root.to_string_lossy().to_lowercase();
        // A canonical Windows path may have the extended path prefix.
        if !seen.insert(format!("canonical:{normalized}")) {
            continue;
        }
        let apps_dir = root.join("steamapps");
        let entries = match fs::read_dir(&apps_dir) {
            Ok(v) => v,
            Err(_) => {
                result.warnings.push(format!(
                    "Kein lesbarer steamapps-Ordner: {}",
                    root.display()
                ));
                continue;
            }
        };
        result.libraries.push(root.to_string_lossy().into());
        let folders = apps_dir.join("libraryfolders.vdf");
        if folders.is_file() {
            match read_vdf(&folders) {
                Ok(data) => {
                    if let Some(Value::Object(items)) = data.get("libraryfolders") {
                        for (index, value) in items {
                            if index.parse::<u32>().is_ok() {
                                if let Some(path) = value
                                    .get("path")
                                    .and_then(Value::text)
                                    .or_else(|| value.text())
                                {
                                    pending.push(PathBuf::from(path));
                                }
                            }
                        }
                    }
                }
                Err(e) => result
                    .warnings
                    .push(format!("Bibliotheksliste nicht lesbar: {e}")),
            }
        }
        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => {
                    result.warnings.push(e.to_string());
                    continue;
                }
            };
            let filename = entry.file_name().to_string_lossy().to_string();
            let Some(id) = filename
                .strip_prefix("appmanifest_")
                .and_then(|s| s.strip_suffix(".acf"))
                .and_then(|s| s.parse::<u32>().ok())
            else {
                continue;
            };
            match game_from_manifest(&root, id) {
                Ok(Some(game)) => {
                    if apps.insert(id) {
                        result.games.push(game);
                    }
                }
                Ok(None) => {}
                Err(e) => result.warnings.push(format!("{filename}: {e}")),
            }
        }
    }
    result.games.sort_by_key(|g| g.name.to_lowercase());
    result.libraries.sort();
    result
}

#[tauri::command]
pub async fn scan_steam(folder: Option<String>) -> Result<Scan, String> {
    tauri::async_runtime::spawn_blocking(move || {
        scan_roots(
            folder
                .map(|s| vec![PathBuf::from(s)])
                .unwrap_or_else(detected_roots),
        )
    })
    .await
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn pick_steam_folder() -> Option<String> {
    rfd::AsyncFileDialog::new()
        .set_title("Steam- oder SteamLibrary-Ordner auswählen")
        .pick_folder()
        .await
        .map(|f| f.path().to_string_lossy().into())
}
fn launch_uri(app_id: u32) -> Result<String, String> {
    if app_id == 0 {
        return Err("Ungültige Steam-App-ID".into());
    }
    Ok(format!("steam://rungameid/{app_id}"))
}
#[tauri::command]
pub async fn launch_steam(
    app: tauri::AppHandle,
    app_id: u32,
    library: String,
) -> Result<(), String> {
    let uri = launch_uri(app_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        let root = library_root(PathBuf::from(library));
        if !root.is_absolute() {
            return Err("Ungültiger Bibliotheksordner.".into());
        }
        if game_from_manifest(&root, app_id)?.is_none() {
            return Err(
                "Spiel nicht mehr installiert. Bitte Steam-Bibliothek erneut durchsuchen.".into(),
            );
        }
        app.opener()
            .open_url(uri, None::<&str>)
            .map_err(|e| format!("Steam konnte den Startauftrag nicht öffnen: {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn keyvalues_handles_unicode_comments_and_escapes() {
        let doc=parse("\u{feff}// hi\n\"root\" { \"name\" \"Spiel ™ \\\"Test\\\"\" \"path\" \"D:\\\\SteamLibrary\" }").unwrap();
        let root = doc.get("root").unwrap();
        assert_eq!(
            root.get("name").and_then(Value::text),
            Some("Spiel ™ \"Test\"")
        );
        assert_eq!(
            root.get("path").and_then(Value::text),
            Some("D:\\SteamLibrary")
        );
    }
    #[test]
    fn rejects_broken_vdf() {
        for s in ["\"root\" {", "\"root\" \"unterminated", "}", "key"] {
            assert!(parse(s).is_err());
        }
    }
    #[test]
    fn uri_contains_only_numeric_id() {
        assert_eq!(launch_uri(976730).unwrap(), "steam://rungameid/976730");
        assert!(launch_uri(0).is_err());
    }
    #[test]
    fn scans_multiple_libraries_deduplicates_and_skips_incomplete() {
        let temp = std::env::temp_dir().join(format!(
            "gaminghub-steam-test-{}-{}",
            std::process::id(),
            super::super::monitor::timestamp()
        ));
        let a = temp.join("A");
        let b = temp.join("B");
        for root in [&a, &b] {
            fs::create_dir_all(root.join("steamapps/common/Test Game")).unwrap();
        }
        let folders = format!(
            "\"libraryfolders\" {{ \"0\" {{ \"path\" {} }} \"1\" {{ \"path\" {} }} }}",
            serde_json::to_string(&a.to_string_lossy()).unwrap(),
            serde_json::to_string(&b.to_string_lossy()).unwrap()
        );
        fs::write(a.join("steamapps/libraryfolders.vdf"), folders).unwrap();
        let manifest = |id, flags, dir: &str| {
            format!("\"AppState\" {{ \"appid\" \"{id}\" \"name\" \"Test ™\" \"StateFlags\" \"{flags}\" \"installdir\" \"{dir}\" }}")
        };
        fs::write(
            a.join("steamapps/appmanifest_42.acf"),
            manifest(42, 4, "Test Game"),
        )
        .unwrap();
        fs::write(
            b.join("steamapps/appmanifest_42.acf"),
            manifest(42, 4, "Test Game"),
        )
        .unwrap();
        fs::write(
            b.join("steamapps/appmanifest_43.acf"),
            manifest(43, 6, "Test Game"),
        )
        .unwrap();
        fs::write(
            b.join("steamapps/appmanifest_44.acf"),
            manifest(44, 2, "Test Game"),
        )
        .unwrap();
        fs::write(
            b.join("steamapps/appmanifest_45.acf"),
            manifest(45, 4, "Missing"),
        )
        .unwrap();
        fs::write(
            b.join("steamapps/appmanifest_46.acf"),
            manifest(46, 4, "../outside"),
        )
        .unwrap();
        fs::write(b.join("steamapps/appmanifest_47.acf"), "broken").unwrap();
        let result = scan_roots(vec![a.clone()]);
        assert_eq!(result.libraries.len(), 2);
        assert_eq!(result.games.len(), 2);
        assert!(
            result
                .games
                .iter()
                .find(|g| g.app_id == 43)
                .unwrap()
                .update_required
        );
        assert_eq!(result.warnings.len(), 2);
        fs::remove_dir_all(&temp).unwrap();
    }
    #[test]
    #[ignore = "reads installed Steam libraries, never launches games"]
    fn real_library_scan() {
        let result = scan_roots(detected_roots());
        println!("{}", serde_json::to_string_pretty(&result).unwrap());
        assert!(!result.libraries.is_empty());
    }
}
