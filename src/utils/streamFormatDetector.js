/**
 * Stream Format Detector - Deterministic stream format detection
 * 
 * Performs intelligent stream format detection by:
 * 1. Analyzing HTTP headers (Content-Type, Content-Disposition)
 * 2. Inspecting the first 0-2KB of the stream content
 * 3. Detecting binary patterns and magic bytes
 * 
 * Eliminates "trial and error" approach by determining the correct
 * player library before attempting playback.
 */

import { httpFetch } from './httpClient';

/**
 * Stream format types with corresponding player libraries
 */
export const StreamFormat = {
    HLS: {
        format: 'hls',
        container: 'm3u8',
        lib: 'hls.js',
        mimeTypes: [
            'application/vnd.apple.mpegurl',
            'application/x-mpegurl',
            'audio/mpegurl',
            'audio/x-mpegurl'
        ]
    },
    DASH: {
        format: 'dash',
        container: 'mpd',
        lib: 'dash.js',
        mimeTypes: [
            'application/dash+xml'
        ]
    },
    MPEGTS: {
        format: 'mpegts',
        container: 'ts',
        lib: 'mpegts.js',
        mimeTypes: [
            'video/mp2t',
            'video/mpeg',
            'application/octet-stream' // Often used for TS
        ]
    },
    MP4: {
        format: 'mp4',
        container: 'mp4',
        lib: 'native',
        mimeTypes: [
            'video/mp4',
            'video/quicktime'
        ]
    },
    FLV: {
        format: 'flv',
        container: 'flv',
        lib: 'mpegts.js',
        mimeTypes: [
            'video/x-flv'
        ]
    },
    WEBM: {
        format: 'webm',
        container: 'webm',
        lib: 'native',
        mimeTypes: [
            'video/webm'
        ]
    },
    UNKNOWN: {
        format: 'unknown',
        container: 'unknown',
        lib: null,
        mimeTypes: []
    }
};

/**
 * Magic bytes and signature patterns for binary detection
 */
const BINARY_SIGNATURES = {
    // HLS M3U8 (text-based)
    HLS: [
        { pattern: '#EXTM3U', offset: 0, type: 'text' },
        { pattern: '#EXT-X-VERSION', offset: null, type: 'text' },
        { pattern: '#EXT-X-STREAM-INF', offset: null, type: 'text' }
    ],

    // DASH MPD (XML-based)
    DASH: [
        { pattern: '<?xml', offset: 0, type: 'text' },
        { pattern: '<MPD', offset: null, type: 'text' },
        { pattern: 'urn:mpeg:dash:schema:', offset: null, type: 'text' }
    ],

    // MPEG-TS (binary sync byte pattern: 0x47 every 188 bytes)
    MPEGTS: [
        { pattern: [0x47], offset: 0, type: 'binary' },
        { pattern: [0x47], offset: 188, type: 'binary' },
        { pattern: [0x47], offset: 376, type: 'binary' }
    ],

    // MP4/fMP4 (ftyp box)
    MP4: [
        { pattern: 'ftyp', offset: 4, type: 'text' },
        { pattern: 'mdat', offset: null, type: 'text' },
        { pattern: 'moov', offset: null, type: 'text' }
    ],

    // FLV (FLV signature)
    FLV: [
        { pattern: 'FLV', offset: 0, type: 'text' },
        { pattern: [0x46, 0x4C, 0x56], offset: 0, type: 'binary' }
    ],

    // WebM (EBML header)
    WEBM: [
        { pattern: [0x1A, 0x45, 0xDF, 0xA3], offset: 0, type: 'binary' }
    ]
};

/**
 * Detects stream format by analyzing HTTP headers
 * @param {Object} headers - Response headers from HEAD/GET request
 * @returns {Object|null} Detected format or null if inconclusive
 */
function detectFromHeaders(headers) {
    if (!headers) return null;

    // Normalize headers to lowercase keys
    const normalizedHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
        normalizedHeaders[key.toLowerCase()] = value.toLowerCase();
    }

    const contentType = normalizedHeaders['content-type'] || '';
    const contentDisposition = normalizedHeaders['content-disposition'] || '';

    // Check Content-Type against known MIME types
    for (const [formatKey, formatInfo] of Object.entries(StreamFormat)) {
        if (formatKey === 'UNKNOWN') continue;

        for (const mimeType of formatInfo.mimeTypes) {
            if (contentType.includes(mimeType.toLowerCase())) {
                console.log(`[StreamDetector] Detected ${formatInfo.format} from Content-Type: ${contentType}`);
                return formatInfo;
            }
        }
    }

    // Check Content-Disposition for file extensions
    if (contentDisposition) {
        if (contentDisposition.includes('.m3u8') || contentDisposition.includes('.m3u')) {
            return StreamFormat.HLS;
        }
        if (contentDisposition.includes('.mpd')) {
            return StreamFormat.DASH;
        }
        if (contentDisposition.includes('.ts')) {
            return StreamFormat.MPEGTS;
        }
        if (contentDisposition.includes('.mp4')) {
            return StreamFormat.MP4;
        }
        if (contentDisposition.includes('.flv')) {
            return StreamFormat.FLV;
        }
    }

    return null;
}

/**
 * Converts base64 string to Uint8Array
 * @param {string} base64 - Base64 encoded string
 * @returns {Uint8Array} Decoded binary data
 */
function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Checks if binary data matches a pattern at given offset
 * @param {Uint8Array} data - Binary data to check
 * @param {Array|string} pattern - Pattern to match (array of bytes or string)
 * @param {number|null} offset - Offset to check (null = search anywhere)
 * @param {string} type - 'binary' or 'text'
 * @returns {boolean} True if pattern matches
 */
function matchesPattern(data, pattern, offset, type) {
    if (type === 'text') {
        // Convert Uint8Array to string for text matching
        const text = new TextDecoder('utf-8', { fatal: false }).decode(data);

        if (offset !== null) {
            const substr = text.substring(offset, offset + pattern.length);
            return substr === pattern;
        } else {
            return text.includes(pattern);
        }
    } else {
        // Binary pattern matching
        if (offset !== null) {
            if (offset + pattern.length > data.length) return false;

            for (let i = 0; i < pattern.length; i++) {
                if (data[offset + i] !== pattern[i]) {
                    return false;
                }
            }
            return true;
        } else {
            // Search for pattern anywhere in data
            for (let i = 0; i <= data.length - pattern.length; i++) {
                let match = true;
                for (let j = 0; j < pattern.length; j++) {
                    if (data[i + j] !== pattern[j]) {
                        match = false;
                        break;
                    }
                }
                if (match) return true;
            }
            return false;
        }
    }
}

/**
 * Detects stream format by analyzing binary content
 * @param {Uint8Array} data - Binary data (first 0-2KB of stream)
 * @returns {Object|null} Detected format or null if inconclusive
 */
function detectFromBinaryContent(data) {
    if (!data || data.length === 0) return null;

    // Try each format's signature patterns
    for (const [formatKey, signatures] of Object.entries(BINARY_SIGNATURES)) {
        let matchCount = 0;
        let requiredMatches = Math.min(2, signatures.length); // Need at least 2 matches for confidence

        for (const sig of signatures) {
            if (matchesPattern(data, sig.pattern, sig.offset, sig.type)) {
                matchCount++;
            }
        }

        if (matchCount >= requiredMatches) {
            const formatInfo = StreamFormat[formatKey];
            console.log(`[StreamDetector] Detected ${formatInfo.format} from binary content (${matchCount}/${signatures.length} patterns matched)`);
            return formatInfo;
        }
    }

    return null;
}

/**
 * Detects stream format from URL patterns
 * @param {string} url - Stream URL
 * @returns {Object|null} Detected format or null if inconclusive
 */
function detectFromUrl(url) {
    if (!url) return null;

    const lowerUrl = url.toLowerCase();

    // HLS
    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('.m3u') || lowerUrl.includes('/hls/')) {
        return StreamFormat.HLS;
    }

    // DASH
    if (lowerUrl.includes('.mpd') || lowerUrl.includes('manifest.mpd') || lowerUrl.includes('.isml/manifest')) {
        return StreamFormat.DASH;
    }

    // MPEG-TS
    if (lowerUrl.includes('.ts') || lowerUrl.includes('/ts/') || lowerUrl.includes('mpegts')) {
        return StreamFormat.MPEGTS;
    }

    // FLV
    if (lowerUrl.includes('.flv') || lowerUrl.includes('/flv/')) {
        return StreamFormat.FLV;
    }

    // MP4
    if (lowerUrl.includes('.mp4')) {
        return StreamFormat.MP4;
    }

    // WebM
    if (lowerUrl.includes('.webm')) {
        return StreamFormat.WEBM;
    }

    return null;
}

/**
 * Main detection function - performs comprehensive stream format detection
 * @param {string} url - Stream URL to detect
 * @param {Object} options - Detection options
 * @param {boolean} options.skipContentInspection - Skip binary content inspection
 * @param {number} options.sampleSize - Size of content sample to fetch (default: 2048 bytes)
 * @returns {Promise<Object>} Detected format information
 */
export async function detectStreamFormat(url, options = {}) {
    const {
        skipContentInspection = false,
        sampleSize = 2048
    } = options;

    console.log('='.repeat(60));
    console.log('[StreamDetector] Starting detection for:', url);
    console.log('='.repeat(60));

    const result = {
        url,
        detectedFormat: null,
        confidence: 'none', // none, low, medium, high
        detectionMethod: null, // url, headers, content
        details: {}
    };

    // Step 1: Try URL pattern detection (fastest)
    const urlFormat = detectFromUrl(url);
    if (urlFormat) {
        result.detectedFormat = urlFormat;
        result.confidence = 'medium';
        result.detectionMethod = 'url';
        console.log(`[StreamDetector] URL pattern match: ${urlFormat.format}`);
    }

    // Step 2: Perform HEAD request to check headers
    try {
        console.log('[StreamDetector] Fetching headers...');
        const headResponse = await httpFetch(url, {
            method: 'HEAD',
            headers: { 'Range': `bytes=0-${sampleSize - 1}` }
        });

        result.details.statusCode = headResponse.status;
        result.details.headers = headResponse.headers;

        if (headResponse.status >= 200 && headResponse.status < 300) {
            const headerFormat = detectFromHeaders(headResponse.headers);

            if (headerFormat) {
                // Header detection is more reliable than URL
                result.detectedFormat = headerFormat;
                result.confidence = 'high';
                result.detectionMethod = 'headers';
                console.log(`[StreamDetector] Header match: ${headerFormat.format}`);

                // If headers are conclusive and we trust them, return early
                const contentType = headResponse.headers['content-type']?.toLowerCase() || '';
                if (contentType.includes('mpegurl') ||
                    contentType.includes('dash+xml') ||
                    contentType.includes('mp2t') ||
                    contentType.includes('x-flv')) {
                    console.log('[StreamDetector] High confidence from headers, skipping content inspection');
                    return result;
                }
            }
        }
    } catch (err) {
        console.warn('[StreamDetector] HEAD request failed:', err.message);
        result.details.headError = err.message;
    }

    // Step 3: If still uncertain or forced, inspect binary content
    if ((!result.detectedFormat || result.confidence !== 'high') && !skipContentInspection) {
        try {
            console.log(`[StreamDetector] Fetching content sample (${sampleSize} bytes)...`);
            const getResponse = await httpFetch(url, {
                method: 'GET',
                headers: { 'Range': `bytes=0-${sampleSize - 1}` }
            });

            if (getResponse.status >= 200 && getResponse.status < 300 && getResponse.body) {
                // The body might be base64 encoded if binary
                let binaryData;

                try {
                    // Try to parse as base64 first (for binary data)
                    binaryData = base64ToUint8Array(getResponse.body);
                } catch (e) {
                    // If not base64, treat as text and convert
                    const encoder = new TextEncoder();
                    binaryData = encoder.encode(getResponse.body);
                }

                result.details.sampleSize = binaryData.length;
                console.log(`[StreamDetector] Analyzing ${binaryData.length} bytes of content...`);

                const contentFormat = detectFromBinaryContent(binaryData);

                if (contentFormat) {
                    // Content inspection is the most reliable
                    result.detectedFormat = contentFormat;
                    result.confidence = 'high';
                    result.detectionMethod = 'content';
                    console.log(`[StreamDetector] Content inspection match: ${contentFormat.format}`);
                }
            }
        } catch (err) {
            console.warn('[StreamDetector] Content inspection failed:', err.message);
            result.details.contentError = err.message;
        }
    }

    // Fallback
    if (!result.detectedFormat) {
        result.detectedFormat = StreamFormat.UNKNOWN;
        result.confidence = 'none';
        console.warn('[StreamDetector] Could not detect format, returning UNKNOWN');
    }

    console.log('='.repeat(60));
    console.log('[StreamDetector] Detection complete');
    console.log('Format:', result.detectedFormat.format);
    console.log('Container:', result.detectedFormat.container);
    console.log('Library:', result.detectedFormat.lib);
    console.log('Confidence:', result.confidence);
    console.log('Method:', result.detectionMethod);
    console.log('='.repeat(60));

    return result;
}

/**
 * Batch detection for multiple URLs
 * @param {Array<string>} urls - Array of stream URLs
 * @param {Object} options - Detection options
 * @returns {Promise<Array<Object>>} Array of detection results
 */
export async function detectMultipleStreams(urls, options = {}) {
    const results = await Promise.all(
        urls.map(url => detectStreamFormat(url, options))
    );
    return results;
}

export default {
    detectStreamFormat,
    detectMultipleStreams,
    StreamFormat
};
