/**
 * HTTP Client Quick Reference
 * 
 * CORS-free HTTP requests for ClaudeTV
 * All requests bypass browser CORS via Tauri Rust backend
 */

// ============================================
// IMPORT
// ============================================
import {
    httpFetch,      // Universal fetch
    httpGet,        // GET convenience
    httpPost,       // POST convenience
    httpPut,        // PUT convenience
    httpDelete,     // DELETE convenience
    httpFetchJson,  // Auto-parse JSON
    httpFetchText   // Get text content
} from '@/utils/httpClient';

// ============================================
// BASIC USAGE
// ============================================

// Simple GET
const response = await httpGet('https://api.example.com/data');
// response = { body: "...", status: 200, headers: {...} }

// Text content (M3U playlists, etc.)
const playlist = await httpFetchText('https://provider.com/playlist.m3u8');

// JSON data
const channels = await httpFetchJson('https://api.example.com/channels');

// ============================================
// WITH HEADERS
// ============================================

const response = await httpGet('https://api.example.com/data', {
    'Authorization': 'Bearer token123',
    'User-Agent': 'ClaudeTV/1.0'
});

// ============================================
// POST DATA
// ============================================

// JSON body (auto-stringified)
const response = await httpPost(
    'https://api.example.com/submit',
    { name: 'John', age: 30 },
    { 'Authorization': 'Bearer token' }
);

// Custom body
const response = await httpFetch('https://api.example.com/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'raw text data'
});

// ============================================
// ERROR HANDLING
// ============================================

try {
    const data = await httpFetchJson('https://api.example.com/data');
    console.log(data);
} catch (error) {
    console.error('Request failed:', error.message);
    // Error messages include context (HTTP status, parse errors, etc.)
}

// ============================================
// ADVANCED USAGE
// ============================================

// PUT request
await httpPut(
    'https://api.example.com/resource/123',
    { status: 'updated' },
    { 'Authorization': 'Bearer token' }
);

// DELETE request
await httpDelete('https://api.example.com/resource/123', {
    'Authorization': 'Bearer token'
});

// Full control
const response = await httpFetch('https://api.example.com/data', {
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value'
    },
    body: JSON.stringify({ patch: 'data' })
});

// Check status manually
if (response.status >= 200 && response.status < 300) {
    console.log('Success:', response.body);
} else {
    console.error('Error:', response.status);
}

// ============================================
// MIGRATION FROM fetch()
// ============================================

// OLD (CORS issues ❌)
const res = await fetch(url);
const text = await res.text();
const json = await res.json();

// NEW (CORS-free ✅)
const text = await httpFetchText(url);
const json = await httpFetchJson(url);

// ============================================
// NOTES
// ============================================

// ✅ No CORS errors - requests go through Rust backend
// ✅ 30-second timeout on all requests
// ✅ Works with any HTTP/HTTPS URL
// ✅ Supports all HTTP methods
// ✅ Automatic JSON stringification for objects
// ✅ Familiar fetch-like API
