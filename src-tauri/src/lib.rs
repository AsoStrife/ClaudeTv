// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    body: String,
    status: u16,
    headers: std::collections::HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_binary: Option<bool>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to ClaudeTV!", name)
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
            stop_stream_proxy
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
