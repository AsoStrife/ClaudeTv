# ClaudeTV — Modern IPTV Desktop App

ClaudeTV is a modern, cross‑platform IPTV desktop application built with Vue 3, Vite, Tailwind CSS, and Tauri. It plays HLS, DASH, MPEG‑TS/FLV, and native video formats, and includes an automatic adapter system to choose the right player for each stream. All network requests are routed through the Rust backend to eliminate CORS issues.

This project was created via “vibe coding” with Claude 4.5, hence the name ClaudeTV.

## Overview

- Modern IPTV app with playlist parsing (M3U) and channel grouping
- Automatic stream type detection (URL/content-type) and fallback chain
- Adapters for `hls.js`, `dash.js`, `mpegts.js`, native HTML5, and RTSP/RTMP (via Tauri sidecar when available)
- CORS-free HTTP pipeline using a Tauri command bridge
- Persistent state for playlists and preferences via Pinia + VueUse
- Desktop packaging and system capabilities through Tauri

## How It Works

- Playlist loading: The IPTV playlist (M3U) is fetched via the Rust backend and parsed into channels and categories. See [src/utils/m3uParser.js](src/utils/m3uParser.js) and [src/stores/iptv.js](src/stores/iptv.js).
- Stream handling: `StreamHandler` detects the stream type from the URL and, optionally, via a HEAD request to sniff `Content-Type`. It builds a fallback chain and tries adapters until one succeeds. See [src/utils/streamHandler.js](src/utils/streamHandler.js) and [src/utils/adapters/index.js](src/utils/adapters/index.js).
- CORS solution: The frontend never uses `fetch()` directly. Instead, it calls a Tauri command (`http_fetch`) implemented in Rust (`reqwest` + `tokio`). This bypasses browser CORS entirely. See [CORS_SOLUTION.md](CORS_SOLUTION.md) for full details.
- Desktop runtime: Tauri hosts the web UI, provides system capabilities (FS, shell, logging), and bundles the app as a native executable.

## Key Features

- Stream support: HLS (.m3u8/.m3u), DASH (.mpd), MPEG‑TS/FLV (.ts/.flv), RTSP/RTMP, MP4/WebM
- Automatic adapter selection with retries and fallbacks
- Content-type sniffing via HEAD requests (through Rust proxy)
- Channel search and grouping by category
- Persistent playlists and stream-type cache
- DevTools and robust logging for easier debugging

## Libraries Used

JavaScript / Web:
- Vue 3 (`vue`)
- Vue Router (`vue-router`)
- Pinia (`pinia`)
- VueUse (`@vueuse/core`)
- Vite (`vite`) + Vue plugin (`@vitejs/plugin-vue`)
- Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/postcss`, `postcss`, `autoprefixer`)
- Vue Devtools plugin (`vite-plugin-vue-devtools`)
- Tauri JavaScript API (`@tauri-apps/api`)
- Streaming libraries: `hls.js`, `dashjs`, `mpegts.js`

Rust / Tauri:
- `tauri`
- `tauri-build`
- Plugins: `tauri-plugin-log`, `tauri-plugin-shell`, `tauri-plugin-fs`
- `reqwest` (HTTP client)
- `tokio` (async runtime)
- `serde`, `serde_json`

## Project Structure

- UI: [src/App.vue](src/App.vue), [src/components/ChannelSidebar.vue](src/components/ChannelSidebar.vue), [src/components/VideoPlayer.vue](src/components/VideoPlayer.vue)
- Routing: [src/router/index.js](src/router/index.js)
- State: [src/stores/iptv.js](src/stores/iptv.js), [src/stores/ui.js](src/stores/ui.js)
- Streaming core: [src/utils/streamHandler.js](src/utils/streamHandler.js), adapters in [src/utils/adapters/](src/utils/adapters)
- HTTP client: [src/utils/httpClient.js](src/utils/httpClient.js) (bridges to Tauri `http_fetch`)
- Tauri (Rust): [src-tauri/src/lib.rs](src-tauri/src/lib.rs), [src-tauri/src/main.rs](src-tauri/src/main.rs), [src-tauri/Cargo.toml](src-tauri/Cargo.toml), [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json)

## Prerequisites

- Node.js v20.19+ or v22.12+ (see engines in [package.json](package.json))
- Rust toolchain and Tauri prerequisites for your OS (Windows requires Visual Studio Build Tools + `cargo`)

See Tauri’s official setup guide if needed.

## Setup

```bash
npm install
```

## Development

The CORS-free HTTP bridge relies on Tauri, so use the Tauri dev command for a desktop window:

```bash
npm run tauri:dev
```

Web-only `npm run dev` is available but does not support the CORS-free HTTP flow. Most features (playlist loading, content-type sniffing) expect Tauri.

## Build

Build the web assets:

```bash
npm run build
```

Package as a desktop app (Tauri):

```bash
npm run tauri:build
```

## Usage

1. Launch the app with `npm run tauri:dev`.
2. Add your IPTV playlist URL (M3U). If your provider uses parameters (username, password, type, output), the app can append them for you.
3. Browse categories and select a channel. The app detects the stream type and attaches the right adapter.
4. Use search to filter channels; playlists and preferences persist between sessions.

## CORS Architecture

ClaudeTV implements a Tauri command (`http_fetch`) that proxies all HTTP requests via Rust (`reqwest` + `tokio`). This design:
- Eliminates browser CORS errors completely
- Allows HEAD requests for safe content-type sniffing
- Centralizes timeouts, headers, and error handling

Read more in [CORS_SOLUTION.md](CORS_SOLUTION.md).

## Debugging

DevTools are enabled. To open them, right‑click in the window and choose “Inspect,” or use the standard shortcuts (e.g., `Ctrl+Shift+I`). The app logs helpful messages from both JS and Rust, including the HTTP bridge lifecycle.

For step‑by‑step troubleshooting and manual Tauri command testing, see [DEBUG_GUIDE.md](DEBUG_GUIDE.md).

## Notes & Security

- This app is designed for desktop execution via Tauri; running in a plain browser tab is not supported for network operations.
- Prefer storing sensitive credentials in the Rust side when integrating external APIs.
- You may add domain allowlists, rate limiting, and caching in the Rust command for extra safety/performance.

## Credits

- Built as a modern IPTV app via vibe coding with Claude 4.5 — hence “ClaudeTV.”

