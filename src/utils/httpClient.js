/**
 * HTTP Client Utility - CORS-free wrapper for Tauri http_fetch command
 * 
 * This utility provides a fetch-like API that bypasses browser CORS restrictions
 * by routing all HTTP requests through Tauri's Rust backend.
 * 
 * All requests are executed by the Rust backend using reqwest, which is not
 * subject to browser CORS policies.
 */

/**
 * Lazy-load invoke function from Tauri API to avoid initialization issues
 */
async function getInvoke() {
    console.log('[httpClient] Checking Tauri availability...');
    console.log('[httpClient] window.__TAURI_INTERNALS__:', typeof window.__TAURI_INTERNALS__);
    
    // Check if we're in Tauri context
    if (!window.__TAURI_INTERNALS__) {
        const error = 'Tauri API not available. This app must be run with "npm run tauri:dev". Regular browser mode is not supported.';
        console.error('[httpClient]', error);
        throw new Error(error);
    }
    
    console.log('[httpClient] Tauri internals found, importing invoke...');
    
    // Import invoke dynamically to ensure Tauri is ready
    const { invoke } = await import('@tauri-apps/api/core');
    
    console.log('[httpClient] invoke imported:', typeof invoke);
    
    if (typeof invoke !== 'function') {
        const error = 'invoke is not a function after import';
        console.error('[httpClient]', error);
        throw new Error(error);
    }
    
    return invoke;
}

/**
 * Execute an HTTP request through Tauri's Rust backend
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {string} options.method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {Object} options.headers - Request headers as key-value pairs
 * @param {string|Object} options.body - Request body (will be JSON stringified if object)
 * @returns {Promise<Object>} Response object with body, status, and headers
 */
export async function httpFetch(url, options = {}) {
    console.log('[httpClient] httpFetch called with URL:', url);
    
    const invoke = await getInvoke();
    const {
        method = 'GET',
        headers = {},
        body = null
    } = options;

    // Convert headers object to array of tuples
    const headerArray = Object.entries(headers).map(([key, value]) => [key, String(value)]);

    // Stringify body if it's an object
    let bodyString = null;
    if (body) {
        if (typeof body === 'string') {
            bodyString = body;
        } else {
            bodyString = JSON.stringify(body);
            // Add Content-Type header if not present
            if (!headerArray.some(([key]) => key.toLowerCase() === 'content-type')) {
                headerArray.push(['Content-Type', 'application/json']);
            }
        }
    }

    try {
        console.log('[httpClient] Calling invoke with command: http_fetch');
        console.log('[httpClient] Parameters:', { url, method: method.toUpperCase(), hasHeaders: headerArray.length > 0, hasBody: !!bodyString });
        
        const response = await invoke('http_fetch', {
            url,
            method: method.toUpperCase(),
            headers: headerArray.length > 0 ? headerArray : null,
            body: bodyString
        });

        console.log('[httpClient] Response received, status:', response.status);
        return response;
    } catch (error) {
        console.error('[httpClient] Request failed:', error);
        throw new Error(`HTTP request failed: ${error}`);
    }
}

/**
 * Convenience method for GET requests
 */
export async function httpGet(url, headers = {}) {
    return httpFetch(url, { method: 'GET', headers });
}

/**
 * Convenience method for POST requests
 */
export async function httpPost(url, body, headers = {}) {
    return httpFetch(url, { method: 'POST', headers, body });
}

/**
 * Convenience method for PUT requests
 */
export async function httpPut(url, body, headers = {}) {
    return httpFetch(url, { method: 'PUT', headers, body });
}

/**
 * Convenience method for DELETE requests
 */
export async function httpDelete(url, headers = {}) {
    return httpFetch(url, { method: 'DELETE', headers });
}

/**
 * Fetch and parse JSON response
 */
export async function httpFetchJson(url, options = {}) {
    const response = await httpFetch(url, options);

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}: ${response.body}`);
    }

    try {
        return JSON.parse(response.body);
    } catch (error) {
        throw new Error(`Failed to parse JSON response: ${error.message}`);
    }
}

/**
 * Fetch text content
 */
export async function httpFetchText(url, options = {}) {
    const response = await httpFetch(url, options);

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}: ${response.body}`);
    }

    return response.body;
}
