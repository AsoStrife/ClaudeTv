// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    body: String,
    status: u16,
    headers: std::collections::HashMap<String, String>,
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

    // Get response body as text
    let body = response.text().await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    log::info!("Request completed with status: {}", status);

    Ok(HttpResponse {
        body,
        status,
        headers: response_headers,
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
