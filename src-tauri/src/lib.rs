// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    body: String,
    status: u16,
    headers: std::collections::HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_binary: Option<bool>,
}

// ========================================
// VPN Types and Structures
// ========================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VpnType {
    WireGuard,
    OpenVPN,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VpnClientInfo {
    pub available: bool,
    pub path: Option<String>,
    pub vpn_type: VpnType,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DetectedVpnClients {
    pub wireguard: VpnClientInfo,
    pub openvpn: VpnClientInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VpnConfigInfo {
    pub vpn_type: VpnType,
    pub endpoint: Option<String>,
    pub dns: Option<String>,
    pub address: Option<String>,
    pub is_valid: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VpnStatus {
    Disconnected,
    Connecting,
    Connected,
    Disconnecting,
    Error,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VpnStatusInfo {
    pub status: VpnStatus,
    pub vpn_type: Option<VpnType>,
    pub tunnel_name: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to ClaudeTV!", name)
}

// ========================================
// VPN Detection Commands
// ========================================

/// Detect available VPN clients on the system
#[tauri::command]
fn detect_vpn_clients() -> DetectedVpnClients {
    log::info!("Detecting VPN clients...");
    
    // WireGuard detection (Windows paths)
    let wireguard_paths = vec![
        r"C:\Program Files\WireGuard\wireguard.exe",
        r"C:\Program Files (x86)\WireGuard\wireguard.exe",
    ];
    
    let wireguard_path = wireguard_paths.iter()
        .find(|p| std::path::Path::new(p).exists())
        .map(|s| s.to_string());
    
    // OpenVPN detection (Windows paths)
    let openvpn_paths = vec![
        r"C:\Program Files\OpenVPN\bin\openvpn.exe",
        r"C:\Program Files (x86)\OpenVPN\bin\openvpn.exe",
        r"C:\Program Files\OpenVPN Connect\ovpncli.exe",
    ];
    
    let openvpn_path = openvpn_paths.iter()
        .find(|p| std::path::Path::new(p).exists())
        .map(|s| s.to_string());
    
    log::info!("WireGuard found: {:?}, OpenVPN found: {:?}", wireguard_path, openvpn_path);
    
    DetectedVpnClients {
        wireguard: VpnClientInfo {
            available: wireguard_path.is_some(),
            path: wireguard_path,
            vpn_type: VpnType::WireGuard,
        },
        openvpn: VpnClientInfo {
            available: openvpn_path.is_some(),
            path: openvpn_path,
            vpn_type: VpnType::OpenVPN,
        },
    }
}

/// Parse a VPN configuration file and return its info
#[tauri::command]
fn parse_vpn_config(content: String) -> VpnConfigInfo {
    log::info!("Parsing VPN config ({} bytes)", content.len());
    
    // Detect VPN type
    let is_wireguard = content.contains("[Interface]") && content.contains("[Peer]");
    let is_openvpn = content.contains("client") && (content.contains("<ca>") || content.contains("remote "));
    
    if is_wireguard {
        parse_wireguard_config(&content)
    } else if is_openvpn {
        parse_openvpn_config(&content)
    } else {
        VpnConfigInfo {
            vpn_type: VpnType::WireGuard, // Default
            endpoint: None,
            dns: None,
            address: None,
            is_valid: false,
            error: Some("Unknown VPN configuration format. Expected WireGuard (.conf) or OpenVPN (.ovpn)".to_string()),
        }
    }
}

fn parse_wireguard_config(content: &str) -> VpnConfigInfo {
    let mut endpoint = None;
    let mut dns = None;
    let mut address = None;
    let mut has_private_key = false;
    let mut has_public_key = false;
    
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("Endpoint") {
            endpoint = line.split('=').nth(1).map(|s| s.trim().to_string());
        } else if line.starts_with("DNS") {
            dns = line.split('=').nth(1).map(|s| s.trim().to_string());
        } else if line.starts_with("Address") {
            address = line.split('=').nth(1).map(|s| s.trim().to_string());
        } else if line.starts_with("PrivateKey") {
            has_private_key = true;
        } else if line.starts_with("PublicKey") {
            has_public_key = true;
        }
    }
    
    let is_valid = has_private_key && has_public_key && endpoint.is_some();
    let error = if !is_valid {
        let mut missing = Vec::new();
        if !has_private_key { missing.push("PrivateKey"); }
        if !has_public_key { missing.push("PublicKey"); }
        if endpoint.is_none() { missing.push("Endpoint"); }
        Some(format!("Missing required fields: {}", missing.join(", ")))
    } else {
        None
    };
    
    VpnConfigInfo {
        vpn_type: VpnType::WireGuard,
        endpoint,
        dns,
        address,
        is_valid,
        error,
    }
}

fn parse_openvpn_config(content: &str) -> VpnConfigInfo {
    let mut endpoint = None;
    let mut dns = None;
    let mut has_ca = false;
    
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("remote ") {
            // Format: remote hostname port
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let host = parts[1];
                let port = parts.get(2).unwrap_or(&"1194");
                endpoint = Some(format!("{}:{}", host, port));
            }
        } else if line.starts_with("dhcp-option DNS") {
            dns = line.split_whitespace().last().map(|s| s.to_string());
        } else if line == "<ca>" || line.starts_with("ca ") {
            has_ca = true;
        }
    }
    
    let is_valid = endpoint.is_some() && has_ca;
    let error = if !is_valid {
        let mut missing = Vec::new();
        if endpoint.is_none() { missing.push("remote server"); }
        if !has_ca { missing.push("CA certificate"); }
        Some(format!("Missing required fields: {}", missing.join(", ")))
    } else {
        None
    };
    
    VpnConfigInfo {
        vpn_type: VpnType::OpenVPN,
        endpoint,
        dns,
        address: None,
        is_valid,
        error,
    }
}

/// Connect to VPN using the specified config file
#[tauri::command]
async fn connect_vpn(config_path: String, vpn_type: VpnType) -> Result<VpnStatusInfo, String> {
    log::info!("Connecting to VPN: {:?} with config: {}", vpn_type, config_path);
    
    match vpn_type {
        VpnType::WireGuard => connect_wireguard(&config_path).await,
        VpnType::OpenVPN => connect_openvpn(&config_path).await,
    }
}

async fn connect_wireguard(config_path: &str) -> Result<VpnStatusInfo, String> {
    // Extract tunnel name from config path
    let tunnel_name = std::path::Path::new(config_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("claudetv_vpn")
        .to_string();
    
    // WireGuard on Windows: wireguard.exe /installtunnelservice <config_path>
    let wireguard_path = r"C:\Program Files\WireGuard\wireguard.exe";
    
    if !std::path::Path::new(wireguard_path).exists() {
        return Err("WireGuard is not installed. Please install WireGuard from https://www.wireguard.com/install/".to_string());
    }
    
    // Use PowerShell Start-Process with -Verb RunAs to trigger UAC elevation
    // ArgumentList needs the full argument string including the config path
    let escaped_path = config_path.replace("'", "''").replace('"', r#"\""#);
    let ps_command = format!(
        r#"Start-Process -FilePath '{}' -ArgumentList '/installtunnelservice "{}"' -Verb RunAs -Wait -WindowStyle Hidden"#,
        wireguard_path,
        escaped_path
    );
    
    log::info!("Executing WireGuard with elevation: {}", ps_command);
    
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_command])
        .output()
        .map_err(|e| format!("Failed to start WireGuard: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        
        // Check if user cancelled UAC prompt
        if stderr.contains("canceled") || stderr.contains("cancelled") || stdout.contains("canceled") {
            return Err("Connection cancelled. Administrator privileges are required.".to_string());
        }
        
        // Check if tunnel already exists
        if stderr.contains("already exists") || stdout.contains("already exists") {
            log::info!("Tunnel already exists, checking status...");
        } else if !stderr.is_empty() {
            return Err(format!("WireGuard failed: {}", stderr));
        }
    }
    
    // Wait a moment for the service to start
    tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
    
    // Verify the tunnel is actually running
    let service_name = format!("WireGuardTunnel${}", tunnel_name);
    let check_output = Command::new("sc")
        .args(&["query", &service_name])
        .output();
    
    if let Ok(check) = check_output {
        let stdout = String::from_utf8_lossy(&check.stdout);
        if stdout.contains("RUNNING") {
            log::info!("WireGuard tunnel '{}' started successfully", tunnel_name);
            return Ok(VpnStatusInfo {
                status: VpnStatus::Connected,
                vpn_type: Some(VpnType::WireGuard),
                tunnel_name: Some(tunnel_name),
                error: None,
            });
        }
    }
    
    // If we get here, the tunnel might have started but we couldn't verify
    log::info!("WireGuard tunnel '{}' command completed", tunnel_name);
    
    Ok(VpnStatusInfo {
        status: VpnStatus::Connected,
        vpn_type: Some(VpnType::WireGuard),
        tunnel_name: Some(tunnel_name),
        error: None,
    })
}

async fn connect_openvpn(config_path: &str) -> Result<VpnStatusInfo, String> {
    let openvpn_path = r"C:\Program Files\OpenVPN\bin\openvpn.exe";
    
    if !std::path::Path::new(openvpn_path).exists() {
        return Err("OpenVPN is not installed. Please install OpenVPN from https://openvpn.net/community-downloads/".to_string());
    }
    
    // Use PowerShell Start-Process with -Verb RunAs to trigger UAC elevation
    let ps_command = format!(
        "Start-Process -FilePath '{}' -ArgumentList '--config', '{}' -Verb RunAs -WindowStyle Hidden",
        openvpn_path,
        config_path.replace("'", "''")
    );
    
    log::info!("Executing OpenVPN with elevation: {}", ps_command);
    
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_command])
        .output()
        .map_err(|e| format!("Failed to start OpenVPN: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("canceled") || stderr.contains("cancelled") {
            return Err("Connection cancelled. Administrator privileges are required.".to_string());
        }
        if !stderr.is_empty() {
            return Err(format!("OpenVPN failed: {}", stderr));
        }
    }
    
    // Wait a moment for OpenVPN to start
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    
    log::info!("OpenVPN started with config: {}", config_path);
    
    Ok(VpnStatusInfo {
        status: VpnStatus::Connected,
        vpn_type: Some(VpnType::OpenVPN),
        tunnel_name: Some("openvpn".to_string()),
        error: None,
    })
}

/// Disconnect from VPN
#[tauri::command]
async fn disconnect_vpn(tunnel_name: String, vpn_type: VpnType) -> Result<VpnStatusInfo, String> {
    log::info!("Disconnecting VPN: {:?}, tunnel: {}", vpn_type, tunnel_name);
    
    match vpn_type {
        VpnType::WireGuard => disconnect_wireguard(&tunnel_name).await,
        VpnType::OpenVPN => disconnect_openvpn().await,
    }
}

async fn disconnect_wireguard(tunnel_name: &str) -> Result<VpnStatusInfo, String> {
    let wireguard_path = r"C:\Program Files\WireGuard\wireguard.exe";
    
    // Use PowerShell Start-Process with -Verb RunAs to trigger UAC elevation
    let ps_command = format!(
        r#"Start-Process -FilePath '{}' -ArgumentList '/uninstalltunnelservice "{}"' -Verb RunAs -Wait -WindowStyle Hidden"#,
        wireguard_path,
        tunnel_name
    );
    
    log::info!("Disconnecting WireGuard with elevation: {}", ps_command);
    
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_command])
        .output()
        .map_err(|e| format!("Failed to stop WireGuard: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.is_empty() && !stderr.contains("canceled") {
            log::warn!("WireGuard disconnect warning: {}", stderr);
        }
    }
    
    log::info!("WireGuard tunnel '{}' disconnected", tunnel_name);
    
    Ok(VpnStatusInfo {
        status: VpnStatus::Disconnected,
        vpn_type: None,
        tunnel_name: None,
        error: None,
    })
}

async fn disconnect_openvpn() -> Result<VpnStatusInfo, String> {
    // Kill OpenVPN process on Windows - use elevation for admin-started processes
    let ps_command = "Stop-Process -Name 'openvpn' -Force -ErrorAction SilentlyContinue";
    
    let output = Command::new("powershell")
        .args(&["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_command])
        .output()
        .map_err(|e| format!("Failed to stop OpenVPN: {}", e))?;
    
    if !output.status.success() {
        log::warn!("OpenVPN may not have been running");
    }
    
    log::info!("OpenVPN disconnected");
    
    Ok(VpnStatusInfo {
        status: VpnStatus::Disconnected,
        vpn_type: None,
        tunnel_name: None,
        error: None,
    })
}

/// Get current VPN status
#[tauri::command]
fn get_vpn_status(tunnel_name: Option<String>, vpn_type: Option<VpnType>) -> VpnStatusInfo {
    log::info!("Checking VPN status for tunnel: {:?}", tunnel_name);
    
    // Check WireGuard status
    if let Some(ref name) = tunnel_name {
        if vpn_type == Some(VpnType::WireGuard) || vpn_type.is_none() {
            let service_name = format!("WireGuardTunnel${}", name);
            let output = Command::new("sc")
                .args(&["query", &service_name])
                .output();
            
            if let Ok(output) = output {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if stdout.contains("RUNNING") {
                    return VpnStatusInfo {
                        status: VpnStatus::Connected,
                        vpn_type: Some(VpnType::WireGuard),
                        tunnel_name: Some(name.clone()),
                        error: None,
                    };
                }
            }
        }
    }
    
    // Check OpenVPN status (check if process is running)
    if vpn_type == Some(VpnType::OpenVPN) || vpn_type.is_none() {
        let output = Command::new("tasklist")
            .args(&["/FI", "IMAGENAME eq openvpn.exe"])
            .output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("openvpn.exe") {
                return VpnStatusInfo {
                    status: VpnStatus::Connected,
                    vpn_type: Some(VpnType::OpenVPN),
                    tunnel_name: Some("openvpn".to_string()),
                    error: None,
                };
            }
        }
    }
    
    VpnStatusInfo {
        status: VpnStatus::Disconnected,
        vpn_type: None,
        tunnel_name: None,
        error: None,
    }
}

/// Universal HTTP fetch command to bypass CORS
/// This command acts as a proxy between the frontend and remote APIs
#[tauri::command]
async fn http_fetch(
    url: String,
    method: Option<String>,
    headers: Option<Vec<(String, String)>>,
    body: Option<String>,
) -> Result<HttpResponse, String> {
    log::info!("Fetching URL: {}", url);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let method = method.unwrap_or_else(|| "GET".to_string());
    let mut request = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        "HEAD" => client.head(&url),
        _ => return Err(format!("Unsupported HTTP method: {}", method)),
    };

    // Add custom headers
    if let Some(headers) = headers {
        for (key, value) in headers {
            request = request.header(key, value);
        }
    }

    // Add body for POST/PUT/PATCH
    if let Some(body) = body {
        request = request.body(body);
    }

    // Execute request
    let response = request.send().await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status().as_u16();
    
    // Extract headers
    let mut response_headers = std::collections::HashMap::new();
    for (key, value) in response.headers().iter() {
        if let Ok(value_str) = value.to_str() {
            response_headers.insert(key.to_string(), value_str.to_string());
        }
    }

    // Get response body as bytes
    let bytes = response.bytes().await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // Determine if content is binary or text
    let content_type = response_headers.get("content-type")
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    
    // Consider text formats (JSON, XML, plain text, M3U playlists)
    let is_text = content_type.contains("json") ||
                  content_type.contains("xml") ||
                  content_type.contains("text/") ||
                  content_type.contains("mpegurl") ||
                  content_type.contains("x-mpegurl") ||
                  content_type.contains("m3u");
    
    // Consider binary formats (video, audio, images, etc.)
    let is_binary = !is_text && (
                    content_type.contains("video/") ||
                    content_type.contains("audio/") ||
                    content_type.contains("image/") ||
                    content_type.contains("octet-stream"));
    
    // For binary data or when we can't decode as UTF-8, use base64 encoding
    let body = if is_binary || std::str::from_utf8(&bytes).is_err() {
        general_purpose::STANDARD.encode(&bytes)
    } else {
        String::from_utf8_lossy(&bytes).to_string()
    };

    log::info!("Request completed with status: {}, binary: {}, size: {} bytes", status, is_binary, bytes.len());

    Ok(HttpResponse {
        body,
        status,
        headers: response_headers,
        is_binary: Some(is_binary),
    })
}

/// Placeholder command for starting RTSP/RTMP proxy
/// This will be implemented when MediaMTX/FFmpeg sidecar is added
#[tauri::command]
async fn start_stream_proxy(
    source_url: String,
    output_port: u16,
    protocol: String,
) -> Result<serde_json::Value, String> {
    log::info!(
        "Starting {} proxy for {} on port {}",
        protocol,
        source_url,
        output_port
    );
    
    // TODO: Implement MediaMTX/FFmpeg sidecar launch
    // For now, return a placeholder response
    Ok(serde_json::json!({
        "hlsUrl": format!("http://localhost:{}/stream/index.m3u8", output_port),
        "status": "pending_implementation"
    }))
}

/// Placeholder command for stopping RTSP/RTMP proxy
#[tauri::command]
async fn stop_stream_proxy(source_url: String) -> Result<(), String> {
    log::info!("Stopping proxy for {}", source_url);
    // TODO: Implement proxy stop
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            
            // Log app start
            log::info!("ClaudeTV started successfully!");
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            http_fetch,
            start_stream_proxy,
            stop_stream_proxy,
            detect_vpn_clients,
            parse_vpn_config,
            connect_vpn,
            disconnect_vpn,
            get_vpn_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
