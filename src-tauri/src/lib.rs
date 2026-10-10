mod services;
use tauri::{Manager, menu::{Menu, MenuItem}, tray::TrayIconBuilder};
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    services::diagnostics::install_panic_log();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            app.manage(services::Hub::start(app.handle())?);
            let open = MenuItem::with_id(app, "open", "GamingHub öffnen", true, None::<&str>)?;
            let command = MenuItem::with_id(app, "command", "Command Center", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &command, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("app icon").clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => { if let Some(window)=app.get_webview_window("main") { let _=window.show(); let _=window.set_focus(); } },
                    "command" => { if let Some(window)=app.get_webview_window("main") { let _=window.show(); let _=window.set_focus(); let _=window.eval("dispatchEvent(new Event('gaminghub:toggle-command-center'))"); } },
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            services::hub_snapshot,
            services::launch_game,
            services::finish_session,
            services::pick_game,
            services::steam::scan_steam,
            services::steam::pick_steam_folder,
            services::steam::launch_steam,
            services::steam_stats::steam_playtime,
            services::steam_stats::steam_profiles,
            services::steam_stats::steam_achievements,
            services::discord::discord_read,
            services::discord::discord_token_status,
            services::discord::discord_save_token,
            services::discord::discord_forget_token,
            services::discord::open_discord,
            services::modrinth::scan_modrinth,
            services::modrinth::launch_modrinth,
            services::modrinth::open_modrinth,
            services::modrinth::open_labymod,
            services::minecraft_server::minecraft_server_status,
            services::minecraft_server::minecraft_telemetry,
            services::minecraft_server::minecraft_save_telemetry_token,
            services::minecraft_server::minecraft_forget_telemetry_token,
            services::store::launch_store_app,
            services::store::open_store,
            services::music::music_status,
            services::music::music_control,
            services::music::open_spotify
            ,services::spotify_auth::spotify_authorize,
            services::diagnostics::native_diagnostics,
            services::diagnostics::read_crash_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running GamingHub");
}
