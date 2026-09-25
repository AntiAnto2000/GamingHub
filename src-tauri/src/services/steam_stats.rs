use super::steam::{detected_roots, read_vdf, Value};
use serde::{Deserialize, Serialize};

const STEAM_ID_BASE: u64 = 76561197960265728;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamProfile {
    steam_id: String,
    account_id: u32,
}

#[tauri::command]
pub async fn steam_profiles() -> Result<Vec<SteamProfile>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut profiles = Vec::new();
        for root in detected_roots() {
            let userdata = root.join("userdata");
            let Ok(entries) = std::fs::read_dir(userdata) else { continue };
            for entry in entries.flatten() {
                let Some(name) = entry.file_name().to_str().map(str::to_owned) else { continue };
                let Ok(account_id) = name.parse::<u32>() else { continue };
                if account_id == 0 || !entry.path().join("config/localconfig.vdf").is_file() { continue; }
                profiles.push(SteamProfile { steam_id: (STEAM_ID_BASE + u64::from(account_id)).to_string(), account_id });
            }
        }
        profiles.sort_by_key(|profile| profile.account_id);
        profiles.dedup_by_key(|profile| profile.account_id);
        Ok(profiles)
    }).await.map_err(|_| "Steam-Profile konnten nicht erkannt werden.".to_string())?
}

fn account_id(id: &str) -> Result<u32, String> {
    id.parse::<u64>()
        .ok()
        .and_then(|n| n.checked_sub(STEAM_ID_BASE))
        .and_then(|n| u32::try_from(n).ok())
        .filter(|n| *n > 0)
        .ok_or_else(|| "Bitte eine gültige Steam-ID64 eingeben.".into())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Playtime {
    app_id: u32,
    minutes: Option<u64>,
    last_played: Option<u64>,
}

fn extract(root: &Value) -> Result<Vec<Playtime>, String> {
    let mut apps = root;
    for key in ["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"] {
        apps = apps
            .get(key)
            .ok_or("Keine lokalen Spielzeitdaten gefunden.")?;
    }
    let Value::Object(entries) = apps else {
        return Err("Ungültige Steam-Spieldaten.".into());
    };
    Ok(entries
        .iter()
        .filter_map(|(id, v)| {
            Some(Playtime {
                app_id: id.parse().ok()?,
                minutes: v
                    .get("Playtime")
                    .and_then(Value::text)
                    .and_then(|s| s.parse().ok()),
                last_played: v
                    .get("LastPlayed")
                    .and_then(Value::text)
                    .and_then(|s| s.parse().ok())
                    .filter(|n| *n > 0),
            })
        })
        .collect())
}

#[tauri::command]
pub async fn steam_playtime(steam_id: String) -> Result<Vec<Playtime>, String> {
    let account = account_id(&steam_id)?;
    tauri::async_runtime::spawn_blocking(move || {
        for root in detected_roots() {
            let path = root.join("userdata").join(account.to_string()).join("config/localconfig.vdf");
            if path.is_file() { return extract(&read_vdf(&path)?); }
        }
        Err("Für dieses Profil liegen hier keine Steam-Spielzeiten vor. Bitte Steam mit diesem Konto öffnen.".into())
    }).await.map_err(|_| "Spielzeiten konnten nicht gelesen werden.")?
}

#[derive(Deserialize, Serialize)]
pub struct Achievement {
    apiname: String,
    achieved: u8,
    #[serde(default)]
    unlocktime: u64,
    #[serde(default)]
    name: String,
    #[serde(default)]
    description: String,
}
#[derive(Deserialize)]
struct PlayerStats {
    success: bool,
    achievements: Option<Vec<Achievement>>,
}
#[derive(Deserialize)]
struct Response {
    playerstats: PlayerStats,
}

fn decode(bytes: &[u8]) -> Result<Vec<Achievement>, String> {
    let response: Response = serde_json::from_slice(bytes)
        .map_err(|_| "Steam hat eine unerwartete Antwort geliefert.")?;
    if !response.playerstats.success {
        return Err("Achievements nicht verfügbar. Prüfe die Sichtbarkeit deiner Spieldetails; möglicherweise unterstützt das Spiel keine Achievements.".into());
    }
    response
        .playerstats
        .achievements
        .ok_or_else(|| "Steam liefert für dieses Spiel keine Achievement-Liste.".into())
}

#[tauri::command]
pub async fn steam_achievements(
    steam_id: String,
    app_id: u32,
    api_key: String,
) -> Result<Vec<Achievement>, String> {
    account_id(&steam_id)?;
    if app_id == 0 || api_key.len() != 32 || !api_key.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Bitte einen gültigen Steam Web API-Schlüssel eingeben (32 Zeichen).".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "HTTPS konnte nicht initialisiert werden.")?;
    // Never expose reqwest errors: their URLs can contain the API key.
    let mut response = client
        .get("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/")
        .query(&[
            ("key", api_key.as_str()),
            ("steamid", steam_id.as_str()),
            ("appid", &app_id.to_string()),
            ("l", "german"),
        ])
        .send()
        .await
        .map_err(|_| "Steam ist nicht erreichbar. Bitte die Internetverbindung prüfen.")?;
    if !response.status().is_success() {
        return Err(format!(
            "Steam meldet HTTP {}. Bitte API-Schlüssel und Profilfreigabe prüfen.",
            response.status().as_u16()
        ));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Steam-Antwort konnte nicht geladen werden.")?
    {
        if bytes.len() + chunk.len() > 2_097_152 {
            return Err("Steam-Antwort ist zu groß.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    decode(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn profile_validation() {
        assert_eq!(account_id("76561199838638815").unwrap(), 1878373087);
        for id in ["../config", "1", "76561197960265728", "999999999999999999"] {
            assert!(account_id(id).is_err());
        }
    }
    #[test]
    fn unavailable_is_not_zero_achievements() {
        assert!(decode(br#"{"playerstats":{"success":false}}"#).is_err());
        assert!(decode(br#"{"playerstats":{"success":true}}"#).is_err());
        let a = decode(br#"{"playerstats":{"success":true,"achievements":[{"apiname":"FIRST","achieved":1,"unlocktime":123}]}}"#).unwrap();
        assert_eq!(a[0].unlocktime, 123);
    }
    #[test]
    #[ignore]
    fn real_profile_playtime() {
        let root = detected_roots()
            .into_iter()
            .find(|r| {
                r.join("userdata/1878373087/config/localconfig.vdf")
                    .is_file()
            })
            .unwrap();
        let data =
            extract(&read_vdf(&root.join("userdata/1878373087/config/localconfig.vdf")).unwrap())
                .unwrap();
        assert!(data.iter().any(|p| p.minutes.is_some()));
        println!("Spielzeit-Einträge: {}", data.len());
    }
}
