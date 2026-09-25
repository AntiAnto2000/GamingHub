use serde_json::Value;
use tauri_plugin_opener::OpenerExt;
const CREDENTIAL_SERVICE: &str = "GamingHub";
const CREDENTIAL_USER: &str = "discord-bot-token";

fn token_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_USER)
        .map_err(|_| "Der sichere Windows-Anmeldespeicher ist nicht verfügbar.".into())
}
fn valid_token(token: &str) -> bool {
    token.len() >= 20
        && token.len() <= 256
        && token.bytes().all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
}
#[tauri::command]
pub fn discord_token_status() -> bool {
    token_entry().and_then(|entry| entry.get_password().map_err(|_| String::new())).is_ok()
}
#[tauri::command]
pub fn discord_save_token(token: String) -> Result<(), String> {
    if !valid_token(token.trim()) { return Err("Bitte einen gültigen Bot-Token eingeben.".into()); }
    token_entry()?.set_password(token.trim())
        .map_err(|_| "Discord konnte nicht sicher mit Windows verbunden werden.".into())
}
#[tauri::command]
pub fn discord_forget_token() -> Result<(), String> {
    if let Ok(entry) = token_entry() { let _ = entry.delete_credential(); }
    Ok(())
}
fn resolved_token(token: String) -> Result<String, String> {
    let token = if token.trim().is_empty() {
        token_entry()?.get_password().map_err(|_| "Keine gespeicherte Discord-Verbindung gefunden.".to_string())?
    } else { token };
    if !valid_token(token.trim()) { return Err("Bitte einen gültigen Bot-Token eingeben.".into()); }
    Ok(token.trim().to_string())
}
fn snowflake(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 20
        && id.bytes().all(|c| c.is_ascii_digit())
        && id.parse::<u64>().is_ok_and(|n| n > 0)
}
fn endpoint(kind: &str, id: &str) -> Result<String, String> {
    match kind {
        "servers" => Ok("users/@me/guilds?limit=200".into()),
        "channels" if snowflake(id) => Ok(format!("guilds/{id}/channels")),
        "messages" if snowflake(id) => Ok(format!("channels/{id}/messages?limit=30")),
        _ => Err("Ungültige Discord-Auswahl.".into()),
    }
}
#[tauri::command]
pub async fn discord_read(token: String, kind: String, id: String) -> Result<Value, String> {
    let path = endpoint(&kind, &id)?;
    let token = resolved_token(token)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "HTTPS nicht verfügbar.")?;
    let mut response = client
        .get(format!("https://discord.com/api/v10/{path}"))
        .header("Authorization", format!("Bot {token}"))
        .send()
        .await
        .map_err(|_| "Discord ist nicht erreichbar.")?;
    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            401 => "Bot-Token ungültig. Bitte im Developer Portal prüfen.".into(),
            403 => "Dem Bot fehlen Kanalrechte: Kanal ansehen und Nachrichtenverlauf lesen.".into(),
            429 => format!(
                "Discord begrenzt die Abrufe. Bitte {} Sekunden warten.",
                response
                    .headers()
                    .get("retry-after")
                    .and_then(|s| s.to_str().ok())
                    .and_then(|s| s.parse::<f64>().ok())
                    .unwrap_or(60.0)
                    .ceil()
            ),
            _ => "Discord konnte die Auswahl nicht laden.".into(),
        });
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Discord-Antwort unterbrochen.")?
    {
        if bytes.len() + chunk.len() > 4_194_304 {
            return Err("Discord-Antwort ist zu groß.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let data: Value = serde_json::from_slice(&bytes).map_err(|_| "Unerwartete Discord-Antwort.")?;
    if !data.is_array() {
        return Err("Unerwartete Discord-Antwort.".into());
    }
    Ok(data)
}
#[tauri::command]
pub fn open_discord(app: tauri::AppHandle) -> Result<(), String> {
    app.opener()
        .open_url("https://discord.com/channels/@me", None::<&str>)
        .map_err(|_| "Discord konnte nicht geöffnet werden.".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_fixed_read_routes() {
        assert!(endpoint("messages", "123").unwrap().ends_with("?limit=30"));
        for id in ["../users", "1?token=x", "0", "18446744073709551616"] {
            assert!(endpoint("messages", id).is_err());
        }
        assert!(endpoint("send", "123").is_err());
    }
}
