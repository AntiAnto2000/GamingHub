use serde::Serialize;
use serde_json::Value;
use std::{io::{Read, Write}, net::{TcpStream, ToSocketAddrs}, time::{Duration, Instant}};
const CREDENTIAL_SERVICE: &str = "GamingHub Minecraft Telemetry";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MinecraftPlayer { name: String, id: String }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MinecraftStatus { address: String, online: bool, latency_ms: u128, version: String, protocol: i64, motd: String, players_online: i64, players_max: i64, players: Vec<MinecraftPlayer> }

fn varint(mut value: i32) -> Vec<u8> { let mut out=Vec::new(); loop { let mut byte=(value&0x7f) as u8; value=((value as u32)>>7) as i32; if value!=0 {byte|=0x80} out.push(byte); if value==0{return out} } }
fn read_varint<R:Read>(reader:&mut R)->Result<i32,String>{let mut value=0i32;for position in 0..5{let mut byte=[0u8];reader.read_exact(&mut byte).map_err(|_|"Minecraft hat die Verbindung beendet.".to_string())?;value|=((byte[0]&0x7f)as i32)<<(7*position);if byte[0]&0x80==0{return Ok(value)}}Err("Ungültige Minecraft-Antwort.".into())}
fn mc_string(value:&str)->Vec<u8>{let mut out=varint(value.len() as i32);out.extend_from_slice(value.as_bytes());out}
fn packet(body:Vec<u8>)->Vec<u8>{let mut out=varint(body.len() as i32);out.extend(body);out}
fn parse_address(input:&str)->Result<(String,u16),String>{
    let input=input.trim(); if input.is_empty()||input.len()>253||input.contains("//")||input.chars().any(|c|c.is_whitespace()){return Err("Bitte eine gültige Serveradresse eingeben.".into())}
    let (host,port)=match input.rsplit_once(':'){Some((host,port)) if !host.contains(':')=>(host,port.parse::<u16>().map_err(|_|"Ungültiger Serverport.".to_string())?),_=>(input,25565)};
    if host.is_empty()||!host.chars().all(|c|c.is_ascii_alphanumeric()||matches!(c,'.'|'-'|'_')){return Err("Die Serveradresse enthält ungültige Zeichen.".into())} Ok((host.to_string(),port))
}
fn plain_text(value:&Value)->String{match value{Value::String(text)=>text.clone(),Value::Object(map)=>{let mut out=map.get("text").and_then(Value::as_str).unwrap_or("").to_string();if let Some(extra)=map.get("extra").and_then(Value::as_array){for part in extra{out.push_str(&plain_text(part))}}out},Value::Array(parts)=>parts.iter().map(plain_text).collect(),_=>String::new()}}
fn query(address:String)->Result<MinecraftStatus,String>{
    let (host,port)=parse_address(&address)?; let socket=(host.as_str(),port).to_socket_addrs().map_err(|_|"Serveradresse konnte nicht aufgelöst werden.".to_string())?.next().ok_or("Keine Serveradresse gefunden.")?;
    let started=Instant::now(); let mut stream=TcpStream::connect_timeout(&socket,Duration::from_secs(5)).map_err(|_|"Minecraft-Server nicht erreichbar.".to_string())?;stream.set_read_timeout(Some(Duration::from_secs(5))).map_err(|_|"Zeitlimit konnte nicht gesetzt werden.")?;
    let mut handshake=varint(760);handshake.extend(mc_string(&host));handshake.extend(port.to_be_bytes());handshake.extend(varint(1));let mut body=varint(0);body.extend(handshake);stream.write_all(&packet(body)).map_err(|_|"Handshake fehlgeschlagen.")?;stream.write_all(&[1,0]).map_err(|_|"Statusabfrage fehlgeschlagen.")?;
    let length=read_varint(&mut stream)?;if !(1..=1_048_576).contains(&length){return Err("Minecraft-Antwort ist zu groß.".into())}let packet_id=read_varint(&mut stream)?;if packet_id!=0{return Err("Unerwartete Minecraft-Antwort.".into())}let json_length=read_varint(&mut stream)?;if json_length<0||json_length>length||json_length>1_048_576{return Err("Ungültige Minecraft-Antwortgröße.".into())}let mut bytes=vec![0u8;json_length as usize];stream.read_exact(&mut bytes).map_err(|_|"Minecraft-Antwort war unvollständig.")?;
    let data:Value=serde_json::from_slice(&bytes).map_err(|_|"Minecraft lieferte ungültige Statusdaten.".to_string())?;let players=data.get("players").unwrap_or(&Value::Null);let sample=players.get("sample").and_then(Value::as_array).map(|items|items.iter().filter_map(|item|Some(MinecraftPlayer{name:item.get("name")?.as_str()?.to_string(),id:item.get("id").and_then(Value::as_str).unwrap_or("").to_string()})).collect()).unwrap_or_default();
    Ok(MinecraftStatus{address:format!("{host}:{port}"),online:true,latency_ms:started.elapsed().as_millis(),version:data.pointer("/version/name").and_then(Value::as_str).unwrap_or("Unbekannt").to_string(),protocol:data.pointer("/version/protocol").and_then(Value::as_i64).unwrap_or(0),motd:data.get("description").map(plain_text).unwrap_or_default(),players_online:players.get("online").and_then(Value::as_i64).unwrap_or(0),players_max:players.get("max").and_then(Value::as_i64).unwrap_or(0),players:sample})
}
#[tauri::command]
pub async fn minecraft_server_status(address:String)->Result<MinecraftStatus,String>{tauri::async_runtime::spawn_blocking(move||query(address)).await.map_err(|_|"Minecraft-Statusabfrage abgebrochen.".to_string())?}

fn credential_entry(server_id:&str)->Result<keyring::Entry,String>{
    if server_id.is_empty()||server_id.len()>64||!server_id.bytes().all(|byte|byte.is_ascii_alphanumeric()||byte==b'-'){return Err("Ungültige Server-ID.".into())}
    keyring::Entry::new(CREDENTIAL_SERVICE,server_id).map_err(|_|"Der sichere Windows-Anmeldespeicher ist nicht verfügbar.".into())
}
fn valid_token(token:&str)->bool{token.len()==48&&token.bytes().all(|byte|byte.is_ascii_hexdigit())}
#[tauri::command]
pub fn minecraft_save_telemetry_token(server_id:String,token:String)->Result<(),String>{
    let token=token.trim();if !valid_token(token){return Err("Der Telemetrie-Token muss 48 hexadezimale Zeichen enthalten.".into())}
    credential_entry(&server_id)?.set_password(token).map_err(|_|"Der Telemetrie-Token konnte nicht sicher gespeichert werden.".into())
}
#[tauri::command]
pub fn minecraft_forget_telemetry_token(server_id:String)->Result<(),String>{if let Ok(entry)=credential_entry(&server_id){let _=entry.delete_credential();}Ok(())}

#[tauri::command]
pub async fn minecraft_telemetry(address:String, port:u16, server_id:String)->Result<Value,String>{
    let (host,_)=parse_address(&address)?;
    let token=credential_entry(&server_id)?.get_password().map_err(|_|"Kein sicher gespeicherter Telemetrie-Token gefunden.".to_string())?;
    if port==0||!valid_token(&token){return Err("Telemetrie-Port oder Token ist ungültig.".into())}
    let client=reqwest::Client::builder().timeout(Duration::from_secs(5)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_|"Telemetrie konnte nicht initialisiert werden.")?;
    let mut response=client.get(format!("http://{host}:{port}/v1/status")).bearer_auth(token).send().await.map_err(|_|"Fabric-Telemetrie nicht erreichbar. Prüfe Mod, Bind-Adresse und Firewall.".to_string())?;
    if response.status().as_u16()==401{return Err("Telemetrie-Token ist ungültig.".into())}
    if !response.status().is_success(){return Err(format!("Fabric-Telemetrie meldet HTTP {}.",response.status().as_u16()))}
    let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.map_err(|_|"Telemetrie-Antwort wurde unterbrochen.")?{if bytes.len()+chunk.len()>1_048_576{return Err("Telemetrie-Antwort ist zu groß.".into())}bytes.extend_from_slice(&chunk)}
    let data:Value=serde_json::from_slice(&bytes).map_err(|_|"Fabric-Telemetrie lieferte ungültige Daten.")?;if data.get("schema").and_then(Value::as_i64)!=Some(1)||!data.get("players").is_some_and(Value::is_array){return Err("Nicht unterstützte Telemetrie-Version.".into())}Ok(data)
}

#[cfg(test)] mod tests{use super::*;#[test]fn address_validation(){assert_eq!(parse_address("play.example.net").unwrap().1,25565);assert_eq!(parse_address("127.0.0.1:25566").unwrap().1,25566);for bad in ["","https://server.test","host:abc","host name"]{assert!(parse_address(bad).is_err())}}#[test]fn token_validation(){assert!(valid_token(&"a".repeat(48)));assert!(!valid_token(&"x".repeat(48)));assert!(!valid_token("abcd"))}#[test]fn motd_text(){let value:Value=serde_json::json!({"text":"Hallo ","extra":[{"text":"Welt"}]});assert_eq!(plain_text(&value),"Hallo Welt")}}
