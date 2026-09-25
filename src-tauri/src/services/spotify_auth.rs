use std::{
    io::{Read, Write},
    net::TcpListener,
    time::Duration,
};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub async fn spotify_authorize(app: tauri::AppHandle, url: String) -> Result<String, String> {
    if !url.starts_with("https://accounts.spotify.com/authorize?") {
        return Err("Ungültige Spotify-Anmeldeadresse.".into());
    }

    // This address must exactly match the redirect URI registered for the app
    // in Spotify's developer dashboard.
    let listener = TcpListener::bind("127.0.0.1:3000").map_err(|error| {
        format!("Der Spotify-Rückgabeport 3000 ist belegt: {error}")
    })?;
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| format!("Spotify konnte nicht geöffnet werden: {error}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        let deadline = std::time::Instant::now() + Duration::from_secs(180);
        loop {
            if std::time::Instant::now() > deadline {
                return Err("Spotify-Anmeldung hat zu lange gedauert. Bitte erneut versuchen.".to_string());
            }
            let (mut stream, _) = match listener.accept() {
                Ok(connection) => connection,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(50));
                    continue;
                }
                Err(error) => return Err(error.to_string()),
            };
            stream.set_read_timeout(Some(Duration::from_secs(10))).map_err(|error| error.to_string())?;
            let mut buffer = [0_u8; 8192];
            let size = stream.read(&mut buffer).map_err(|error| error.to_string())?;
            let request = String::from_utf8_lossy(&buffer[..size]);
            let target = request.lines().next().and_then(|line| line.split_whitespace().nth(1)).unwrap_or("");
            if !target.starts_with("/callback?") {
                let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                continue;
            }
            let target = target.to_string();
            let body = "<!doctype html><html lang=de><meta charset=utf-8><title>GamingHub</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#101513;color:#edf3ef;font:16px Segoe UI,sans-serif}.box{padding:36px;border:1px solid #35443a;border-radius:18px;background:#18201b;text-align:center}b{color:#b9f57b;font-size:22px}</style><div class=box><b>Spotify ist verbunden.</b><p>Du kannst dieses Fenster schließen und zu GamingHub zurückkehren.</p></div>";
            let response = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
            stream.write_all(response.as_bytes()).map_err(|error| error.to_string())?;
            return Ok(target);
        }
    })
    .await
    .map_err(|error| error.to_string())?
}
