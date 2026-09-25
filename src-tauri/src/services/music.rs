use serde::Serialize;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session,
    GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
};
#[derive(Serialize, Default, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Music {
    pub connected: bool,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub playing: bool,
    pub can_toggle: bool,
    pub can_next: bool,
    pub can_previous: bool,
    pub can_stop: bool,
}
async fn spotify() -> Result<Option<Session>, String> {
    let manager = Manager::RequestAsync()
        .map_err(|e| e.to_string())?
        .await
        .map_err(|e| e.to_string())?;
    let sessions = manager.GetSessions().map_err(|e| e.to_string())?;
    for session in sessions {
        if session
            .SourceAppUserModelId()
            .map_err(|e| e.to_string())?
            .to_string()
            .to_lowercase()
            .contains("spotify")
        {
            return Ok(Some(session));
        }
    }
    Ok(None)
}
#[tauri::command]
pub async fn music_status() -> Result<Music, String> {
    let Some(session) = spotify().await? else {
        return Ok(Music::default());
    };
    let media = session
        .TryGetMediaPropertiesAsync()
        .map_err(|e| e.to_string())?
        .await
        .map_err(|e| e.to_string())?;
    let playback = session.GetPlaybackInfo().map_err(|e| e.to_string())?;
    let controls = playback.Controls().map_err(|e| e.to_string())?;
    Ok(Music {
        connected: true,
        title: media.Title().map_err(|e| e.to_string())?.to_string(),
        artist: media.Artist().map_err(|e| e.to_string())?.to_string(),
        album: media.AlbumTitle().map_err(|e| e.to_string())?.to_string(),
        playing: playback.PlaybackStatus().map_err(|e| e.to_string())? == Status::Playing,
        can_toggle: controls.IsPlayPauseToggleEnabled().unwrap_or(false),
        can_next: controls.IsNextEnabled().unwrap_or(false),
        can_previous: controls.IsPreviousEnabled().unwrap_or(false),
        can_stop: controls.IsStopEnabled().unwrap_or(false),
    })
}
#[tauri::command]
pub async fn music_control(action: String) -> Result<(), String> {
    let session = spotify()
        .await?
        .ok_or("Öffne Spotify und starte dort zuerst einen Titel.")?;
    let request = match action.as_str() {
        "toggle" => session.TryTogglePlayPauseAsync(),
        "next" => session.TrySkipNextAsync(),
        "previous" => session.TrySkipPreviousAsync(),
        "stop" => session.TryStopAsync(),
        _ => return Err("Unbekannte Musikaktion.".into()),
    }
    .map_err(|e| e.to_string())?;
    if request.await.map_err(|e| e.to_string())? {
        Ok(())
    } else {
        Err("Spotify hat die Steuerung nicht angenommen.".into())
    }
}
#[cfg(test)]
mod tests {
    #[test]
    #[ignore = "reads Windows media sessions"]
    fn read_spotify() {
        let result = tauri::async_runtime::block_on(super::music_status());
        println!("{result:?}");
        assert!(result.is_ok());
    }
}

#[tauri::command]
pub fn open_spotify(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url("spotify:", None::<&str>)
        .map_err(|e| {
            format!("Spotify konnte nicht geöffnet werden. Ist die Windows-App installiert? {e}")
        })
}
