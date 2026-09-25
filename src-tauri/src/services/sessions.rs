use super::monitor::{timestamp, Telemetry};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::{Child, Command},
    time::Instant,
};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub game_id: String,
    pub name: String,
    pub path: String,
    pub started_at: u64,
    pub updated_at: u64,
    pub ended_at: Option<u64>,
    pub duration_seconds: u64,
    pub status: String,
    pub exit_code: Option<i32>,
    pub samples: u64,
    pub cpu_sum: f64,
    pub cpu_peak: f32,
    pub gpu_samples: u64,
    pub gpu_sum: u64,
    pub gpu_peak: Option<u32>,
    pub ram_peak: u64,
}
struct Running {
    child: Child,
    clock: Instant,
}
pub struct Sessions {
    pub records: Vec<Session>,
    running: HashMap<String, Running>,
    file: PathBuf,
    pub error: Option<String>,
    dirty: bool,
}
pub fn executable(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path.trim());
    if !path.is_absolute()
        || !path
            .extension()
            .is_some_and(|v| v.eq_ignore_ascii_case("exe"))
    {
        return Err("Bitte eine absolute .exe-Datei auswählen. Verknüpfungen und Skripte werden nicht ausgeführt.".into());
    }
    let path = path
        .canonicalize()
        .map_err(|_| "Die Programmdatei wurde nicht gefunden.".to_string())?;
    if !path.is_file() {
        return Err("Der Pfad ist keine Datei.".into());
    }
    Ok(path)
}
impl Sessions {
    pub fn load(file: PathBuf) -> Self {
        let (mut records, error): (Vec<Session>, Option<String>) = match fs::read(&file) {
            Ok(bytes) => match serde_json::from_slice(&bytes) {
                Ok(v) => (v, None),
                Err(e) => (
                    vec![],
                    Some(format!(
                        "Sessiondatei ist nicht lesbar; sie wird nicht überschrieben: {e}"
                    )),
                ),
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (vec![], None),
            Err(e) => (vec![], Some(e.to_string())),
        };
        let mut recovered = false;
        for s in &mut records {
            if s.status == "running" {
                s.status = "interrupted".into();
                s.ended_at = Some(s.updated_at);
                recovered = true;
            }
        }
        let mut result = Self {
            records,
            running: HashMap::new(),
            file,
            error,
            dirty: recovered,
        };
        if recovered {
            result.persist();
        }
        result
    }
    pub fn persist(&mut self) {
        if !self.dirty {
            return;
        } // Keep malformed source files intact until repaired externally.
        let result = (|| -> Result<(), String> {
            if let Some(parent) = self.file.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let temp = self.file.with_extension("json.tmp");
            let bytes = serde_json::to_vec_pretty(&self.records).map_err(|e| e.to_string())?;
            use std::io::Write;
            let mut output = fs::File::create(&temp).map_err(|e| e.to_string())?;
            output.write_all(&bytes).map_err(|e| e.to_string())?;
            output.sync_all().map_err(|e| e.to_string())?;
            drop(output);
            fs::rename(&temp, &self.file).map_err(|e| e.to_string())?;
            Ok(())
        })();
        match result {
            Ok(()) => {
                self.error = None;
                self.dirty = false
            }
            Err(e) => {
                self.error = Some(format!(
                    "Sessionverlauf konnte nicht gespeichert werden: {e}"
                ))
            }
        }
    }
    pub fn launch(
        &mut self,
        game_id: String,
        name: String,
        path: String,
    ) -> Result<String, String> {
        if self.error.is_some() {
            return Err(self.error.clone().unwrap());
        }
        if game_id.is_empty() || name.trim().is_empty() || name.len() > 320 {
            return Err("Ungültiger Spieleintrag.".into());
        }
        let exe = executable(&path)?;
        let normalized = exe.to_string_lossy().to_string();
        if self.records.iter().any(|s| {
            s.status == "running"
                && (s.game_id == game_id || s.path.eq_ignore_ascii_case(&normalized))
        }) {
            return Err("Für dieses Programm läuft bereits eine Session.".into());
        }
        // Deliberately no shell or command-string interpolation. The selected file is the executable.
        let child = Command::new(&exe)
            .current_dir(exe.parent().unwrap())
            .spawn()
            .map_err(|e| format!("Programmstart fehlgeschlagen: {e}"))?;
        let now = timestamp();
        let id = format!("{now}-{}-{}", child.id(), self.records.len());
        self.running.insert(
            id.clone(),
            Running {
                child,
                clock: Instant::now(),
            },
        );
        self.records.push(Session {
            id: id.clone(),
            game_id,
            name: name.trim().into(),
            path: normalized,
            started_at: now,
            updated_at: now,
            ended_at: None,
            duration_seconds: 0,
            status: "running".into(),
            exit_code: None,
            samples: 0,
            cpu_sum: 0.0,
            cpu_peak: 0.0,
            gpu_samples: 0,
            gpu_sum: 0,
            gpu_peak: None,
            ram_peak: 0,
        });
        self.dirty = true;
        self.persist();
        Ok(id)
    }
    pub fn tick(&mut self, data: &Telemetry) {
        let mut completed = vec![];
        for s in self.records.iter_mut().filter(|s| s.status == "running") {
            if let Some(run) = self.running.get_mut(&s.id) {
                s.updated_at = timestamp();
                s.duration_seconds = run.clock.elapsed().as_secs();
                s.samples += 1;
                s.cpu_sum += data.cpu as f64;
                s.cpu_peak = s.cpu_peak.max(data.cpu);
                s.ram_peak = s.ram_peak.max(data.ram_used);
                if let Some(gpu) = data.gpu {
                    s.gpu_samples += 1;
                    s.gpu_sum += gpu as u64;
                    s.gpu_peak = Some(s.gpu_peak.unwrap_or(0).max(gpu));
                }
                match run.child.try_wait() {
                    Ok(Some(status)) => {
                        s.ended_at = Some(s.updated_at);
                        s.exit_code = status.code();
                        s.status = if status.success() {
                            "completed"
                        } else {
                            "exited_with_error"
                        }
                        .into();
                        completed.push(s.id.clone())
                    }
                    Ok(None) => {}
                    Err(_) => {
                        s.ended_at = Some(s.updated_at);
                        s.status = "tracking_lost".into();
                        completed.push(s.id.clone());
                    }
                }
                self.dirty = true;
            }
        }
        for id in completed {
            self.running.remove(&id);
        } // Completed child handles have already been reaped.
    }
    pub fn finish(&mut self, id: &str) -> Result<(), String> {
        let s = self
            .records
            .iter_mut()
            .find(|s| s.id == id && s.status == "running")
            .ok_or("Keine aktive Session gefunden.")?;
        s.status = "manual".into();
        s.updated_at = timestamp();
        s.ended_at = Some(s.updated_at);
        if let Some(mut run) = self.running.remove(id) {
            s.duration_seconds = run.clock.elapsed().as_secs();
            std::thread::spawn(move || {
                let _ = run.child.wait();
            });
        }
        self.dirty = true;
        self.persist();
        Ok(()) // Stop tracking only. Never terminate the user's game.
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_scripts_and_relative_paths() {
        assert!(executable("game.exe").is_err());
        assert!(executable("C:\\test.cmd").is_err());
        assert!(executable("C:\\missing-game-92837.exe").is_err());
    }
    #[test]
    fn corrupt_history_is_preserved() {
        let dir = std::env::temp_dir().join(format!("gaminghub-corrupt-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("sessions.json");
        fs::write(&file, b"broken").unwrap();
        let mut sessions = Sessions::load(file.clone());
        assert!(sessions
            .launch("a".into(), "A".into(), "C:\\a.exe".into())
            .is_err());
        assert_eq!(fs::read(&file).unwrap(), b"broken");
        fs::remove_file(file).unwrap();
        fs::remove_dir(dir).unwrap();
    }
    #[test]
    #[ignore = "launches a dedicated local test fixture"]
    fn launch_track_and_reload() {
        let exe = std::env::var("GAMINGHUB_TEST_EXE").expect("test fixture required");
        let dir =
            std::env::temp_dir().join(format!("gaminghub-session-test-{}", std::process::id()));
        let file = dir.join("sessions.json");
        let mut sessions = Sessions::load(file.clone());
        sessions
            .launch("fixture".into(), "Fixture".into(), exe.clone())
            .unwrap();
        assert!(sessions
            .launch("fixture".into(), "Fixture".into(), exe)
            .is_err());
        std::thread::sleep(std::time::Duration::from_secs(3));
        sessions.tick(&Telemetry {
            cpu: 25.0,
            gpu: Some(40),
            ram_used: 100,
            ..Default::default()
        });
        sessions.persist();
        let restored = Sessions::load(file.clone());
        assert_eq!(restored.records[0].status, "completed");
        assert!(restored.records[0].duration_seconds >= 2);
        assert_eq!(restored.records[0].gpu_peak, Some(40));
        fs::remove_file(file).unwrap();
        fs::remove_dir(dir).unwrap();
    }
}
