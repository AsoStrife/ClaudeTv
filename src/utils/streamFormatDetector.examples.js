/**
 * Stream Format Detector - Usage Examples
 * 
 * Quick examples showing how to use the stream format detector
 * in different scenarios.
 */

import { detectStreamFormat } from './streamFormatDetector';

// ============================================================================
// Example 1: Basic Detection
// ============================================================================

async function example1_BasicDetection() {
    const url = 'https://example.com/live/stream.m3u8';

    const result = await detectStreamFormat(url);

    console.log('Format:', result.detectedFormat.format);        // "hls"
    console.log('Library:', result.detectedFormat.lib);          // "hls.js"
    console.log('Container:', result.detectedFormat.container);  // "m3u8"
    console.log('Confidence:', result.confidence);               // "high"
}

// ============================================================================
// Example 2: Using Detection Result to Load Player
// ============================================================================

async function example2_LoadPlayerDynamically(videoElement, streamUrl) {
    // Detect stream format
    const detection = await detectStreamFormat(streamUrl);

    // Load appropriate player based on detection
    switch (detection.detectedFormat.format) {
        case 'hls':
            // Load hls.js
            const Hls = (await import('hls.js')).default;
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(streamUrl);
                hls.attachMedia(videoElement);
            }
            break;

        case 'dash':
            // Load dash.js
            const dashjs = (await import('dashjs')).default;
            const player = dashjs.MediaPlayer().create();
            player.initialize(videoElement, streamUrl, true);
            break;

        case 'mpegts':
        case 'ts':
            // Load mpegts.js
            const mpegts = (await import('mpegts.js')).default;
            if (mpegts.isSupported()) {
                const player = mpegts.createPlayer({
                    type: 'mse',
                    isLive: true,
                    url: streamUrl
                });
                player.attachMediaElement(videoElement);
                player.load();
                player.play();
            }
            break;

        case 'mp4':
        case 'webm':
            // Use native HTML5 video
            videoElement.src = streamUrl;
            videoElement.play();
            break;

        default:
            console.error('Unknown format:', detection.detectedFormat.format);
    }
}

// ============================================================================
// Example 3: Fast Detection (Skip Content Inspection)
// ============================================================================

async function example3_FastDetection() {
    const url = 'https://example.com/stream.m3u8';

    // Only use URL patterns and HTTP headers (no binary inspection)
    const result = await detectStreamFormat(url, {
        skipContentInspection: true  // Faster, but less accurate
    });

    console.log('Format:', result.detectedFormat.format);
    console.log('Detection time: ~50-200ms (vs ~500ms with content inspection)');
}

// ============================================================================
// Example 4: Handling Detection Failures
// ============================================================================

async function example4_HandleFailures(videoElement, streamUrl) {
    try {
        const detection = await detectStreamFormat(streamUrl);

        if (detection.detectedFormat.format === 'unknown') {
            console.warn('Could not detect format, trying fallback...');

            // Fallback chain
            const formats = ['hls', 'dash', 'mpegts', 'native'];

            for (const format of formats) {
                try {
                    // Try each format until one works
                    await loadPlayer(videoElement, streamUrl, format);
                    console.log('Success with:', format);
                    return;
                } catch (err) {
                    console.log('Failed with:', format);
                }
            }

            throw new Error('All formats failed');
        } else {
            // Use detected format
            await loadPlayer(videoElement, streamUrl, detection.detectedFormat.format);
        }
    } catch (error) {
        console.error('Playback failed:', error);
    }
}

// ============================================================================
// Example 5: Batch Detection (Process Multiple Streams)
// ============================================================================

async function example5_BatchDetection() {
    const urls = [
        'https://example.com/stream1.m3u8',
        'https://example.com/stream2.mpd',
        'https://example.com/stream3.ts',
        'https://example.com/video.mp4'
    ];

    // Detect all in parallel
    const results = await Promise.all(
        urls.map(url => detectStreamFormat(url))
    );

    // Group by format
    const grouped = results.reduce((acc, result) => {
        const format = result.detectedFormat.format;
        if (!acc[format]) acc[format] = [];
        acc[format].push(result.url);
        return acc;
    }, {});

    console.log('HLS streams:', grouped.hls || []);
    console.log('DASH streams:', grouped.dash || []);
    console.log('MPEG-TS streams:', grouped.mpegts || []);
    console.log('MP4 videos:', grouped.mp4 || []);
}

// ============================================================================
// Example 6: Pre-check Before Loading Playlist
// ============================================================================

async function example6_PreCheckStream(streamUrl) {
    // Detect format before showing in UI
    const detection = await detectStreamFormat(streamUrl);

    // Validate stream is playable
    const playableFormats = ['hls', 'dash', 'mpegts', 'mp4', 'webm'];

    if (!playableFormats.includes(detection.detectedFormat.format)) {
        return {
            playable: false,
            reason: 'Unsupported format: ' + detection.detectedFormat.format
        };
    }

    // Check if we have the required library
    const libraryAvailable = await checkLibraryAvailable(detection.detectedFormat.lib);

    if (!libraryAvailable) {
        return {
            playable: false,
            reason: 'Required library not available: ' + detection.detectedFormat.lib
        };
    }

    return {
        playable: true,
        format: detection.detectedFormat.format,
        library: detection.detectedFormat.lib,
        confidence: detection.confidence
    };
}

async function checkLibraryAvailable(lib) {
    try {
        switch (lib) {
            case 'hls.js':
                await import('hls.js');
                return true;
            case 'dash.js':
                await import('dashjs');
                return true;
            case 'mpegts.js':
                await import('mpegts.js');
                return true;
            case 'native':
                return true; // Always available
            default:
                return false;
        }
    } catch {
        return false;
    }
}

// ============================================================================
// Example 7: Caching Results (Already Built-in)
// ============================================================================

async function example7_Caching() {
    const url = 'https://example.com/stream.m3u8';

    // First call: performs full detection (~500ms)
    const result1 = await detectStreamFormat(url);
    console.log('First detection:', result1.detectedFormat.format);

    // The streamHandler already caches results internally
    // Subsequent calls to the same URL will be instant

    // If you need manual caching:
    const cache = new Map();

    async function detectWithCache(url) {
        if (cache.has(url)) {
            return cache.get(url);
        }

        const result = await detectStreamFormat(url);
        cache.set(url, result);
        return result;
    }

    const cached = await detectWithCache(url);  // Instant on second call
}

// ============================================================================
// Example 8: Custom Sample Size for Detection
// ============================================================================

async function example8_CustomSampleSize() {
    const url = 'https://example.com/stream.ts';

    // For MPEG-TS, we need at least 564 bytes to check 3 sync bytes
    // Default is 2048 bytes, but you can customize:

    const result = await detectStreamFormat(url, {
        sampleSize: 4096  // Fetch 4KB instead of 2KB
    });

    console.log('Detected with larger sample:', result.detectedFormat.format);
}

// ============================================================================
// Example 9: Using with StreamHandler (Automatic)
// ============================================================================

async function example9_StreamHandler(videoElement, streamUrl) {
    // StreamHandler already uses detectStreamFormat internally
    // You don't need to call it manually

    import { streamHandler } from './streamHandler';

    // This will automatically:
    // 1. Detect stream format
    // 2. Load correct adapter
    // 3. Start playback
    await streamHandler.attach(videoElement, streamUrl);

    // Get info about what was detected
    const status = streamHandler.getStatus();
    console.log('Playing with adapter:', status.type);
}

// ============================================================================
// Example 10: Debugging Detection
// ============================================================================

async function example10_Debugging() {
    const url = 'https://example.com/stream.m3u8';

    const result = await detectStreamFormat(url);

    console.log('=== Detection Debug Info ===');
    console.log('URL:', result.url);
    console.log('Format:', result.detectedFormat.format);
    console.log('Container:', result.detectedFormat.container);
    console.log('Library:', result.detectedFormat.lib);
    console.log('Confidence:', result.confidence);
    console.log('Method:', result.detectionMethod);
    console.log('Status Code:', result.details.statusCode);
    console.log('Headers:', result.details.headers);
    console.log('Sample Size:', result.details.sampleSize);

    // Check for errors
    if (result.details.headError) {
        console.log('HEAD Error:', result.details.headError);
    }
    if (result.details.contentError) {
        console.log('Content Error:', result.details.contentError);
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function loadPlayer(videoElement, url, format) {
    // Implementation depends on your player adapters
    // See example2_LoadPlayerDynamically for reference
}

// ============================================================================
// Export Examples
// ============================================================================

export {
    example1_BasicDetection,
    example2_LoadPlayerDynamically,
    example3_FastDetection,
    example4_HandleFailures,
    example5_BatchDetection,
    example6_PreCheckStream,
    example7_Caching,
    example8_CustomSampleSize,
    example9_StreamHandler,
    example10_Debugging
};
