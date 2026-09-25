use nvml_wrapper::{enum_wrappers::device::TemperatureSensor, Nvml};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::System;

pub fn timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
#[derive(Clone, Default, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Telemetry {
    pub timestamp: u64,
    pub cpu: f32,
    pub cpu_name: String,
    pub ram_used: u64,
    pub ram_total: u64,
    pub gpu: Option<u32>,
    pub gpu_name: Option<String>,
    pub gpu_temperature: Option<u32>,
    pub vram_used: Option<u64>,
    pub vram_total: Option<u64>,
    pub gpu_error: Option<String>,
}
pub struct Monitor {
    system: System,
    nvml: Result<Nvml, String>,
}
impl Monitor {
    pub fn new() -> Self {
        let mut system = System::new();
        system.refresh_cpu_all();
        system.refresh_memory();
        // Use the driver's trusted system location, never a DLL beside a downloaded game.
        let dll = std::path::PathBuf::from(
            std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()),
        )
        .join("System32\\nvml.dll");
        let nvml = Nvml::builder()
            .lib_path(dll.as_os_str())
            .init()
            .map_err(|e| e.to_string());
        Self { system, nvml }
    }
    pub fn sample(&mut self) -> Telemetry {
        self.system.refresh_cpu_usage();
        self.system.refresh_memory();
        let mut data = Telemetry {
            timestamp: timestamp(),
            cpu: self.system.global_cpu_usage(),
            cpu_name: self
                .system
                .cpus()
                .first()
                .map(|c| c.brand().to_string())
                .unwrap_or_default(),
            ram_used: self.system.used_memory(),
            ram_total: self.system.total_memory(),
            ..Default::default()
        };
        match &self.nvml {
            Ok(nvml) => match nvml.device_by_index(0) {
                Ok(device) => {
                    data.gpu_name = device.name().ok();
                    match device.utilization_rates() {
                        Ok(r) => data.gpu = Some(r.gpu),
                        Err(e) => data.gpu_error = Some(e.to_string()),
                    };
                    data.gpu_temperature = device.temperature(TemperatureSensor::Gpu).ok();
                    if let Ok(mem) = device.memory_info() {
                        data.vram_used = Some(mem.used);
                        data.vram_total = Some(mem.total);
                    }
                }
                Err(e) => data.gpu_error = Some(e.to_string()),
            },
            Err(e) => data.gpu_error = Some(e.clone()),
        };
        data
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "reads the host hardware"]
    fn real_hardware_sample() {
        let mut monitor = Monitor::new();
        std::thread::sleep(std::time::Duration::from_secs(1));
        let data = monitor.sample();
        println!("{}", serde_json::to_string(&data).unwrap());
        assert!(data.ram_total > 0);
        assert!((0.0..=100.0).contains(&data.cpu));
        assert!(data.gpu.is_some(), "GPU: {:?}", data.gpu_error);
    }
}
