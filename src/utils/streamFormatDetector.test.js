/**
 * Stream Format Detector - Test Suite
 * 
 * This file contains examples and test cases for the stream format detector.
 * Use this to validate the detection system with real URLs.
 */

import { detectStreamFormat, detectMultipleStreams, StreamFormat } from '../utils/streamFormatDetector';

// ============================================================================
// Test URLs (Replace with your actual IPTV stream URLs)
// ============================================================================

const TEST_URLS = {
    // HLS Streams
    hls: [
        'https://example.com/live/stream.m3u8',
        'https://example.com/hls/master.m3u8',
        'http://example.com/live/index.m3u8',
    ],

    // DASH Streams
    dash: [
        'https://example.com/live/manifest.mpd',
        'https://example.com/stream.mpd',
    ],

    // MPEG-TS Streams
    mpegts: [
        'https://example.com/live/stream.ts',
        'http://example.com/mpegts/live',
    ],

    // Native MP4
    mp4: [
        'https://example.com/video.mp4',
    ],

    // FLV Streams
    flv: [
        'https://example.com/live/stream.flv',
    ],
};

// ============================================================================
// Test Functions
// ============================================================================

/**
 * Test single URL detection
 */
export async function testSingleDetection(url) {
    console.log('\n' + '='.repeat(80));
    console.log('Testing URL:', url);
    console.log('='.repeat(80));

    try {
        const result = await detectStreamFormat(url, {
            sampleSize: 2048,
            skipContentInspection: false
        });

        console.log('✅ Detection Result:');
        console.log('  Format:', result.detectedFormat.format);
        console.log('  Container:', result.detectedFormat.container);
        console.log('  Library:', result.detectedFormat.lib);
        console.log('  Confidence:', result.confidence);
        console.log('  Method:', result.detectionMethod);

        if (result.details.statusCode) {
            console.log('  Status Code:', result.details.statusCode);
        }

        if (result.details.headers) {
            const ct = result.details.headers['content-type'];
            if (ct) console.log('  Content-Type:', ct);
        }

        if (result.details.sampleSize) {
            console.log('  Sample Size:', result.details.sampleSize, 'bytes');
        }

        return result;
    } catch (error) {
        console.error('❌ Detection Failed:', error.message);
        throw error;
    }
}

/**
 * Test batch detection
 */
export async function testBatchDetection(urls) {
    console.log('\n' + '='.repeat(80));
    console.log('Testing Batch Detection');
    console.log('URLs:', urls.length);
    console.log('='.repeat(80));

    const startTime = Date.now();
    const results = await detectMultipleStreams(urls);
    const endTime = Date.now();

    console.log('\n✅ Batch Detection Complete');
    console.log('Total Time:', (endTime - startTime), 'ms');
    console.log('Average per URL:', Math.round((endTime - startTime) / urls.length), 'ms');

    results.forEach((result, index) => {
        console.log(`\n[${index + 1}] ${result.url}`);
        console.log('    Format:', result.detectedFormat.format);
        console.log('    Confidence:', result.confidence);
        console.log('    Method:', result.detectionMethod);
    });

    return results;
}

/**
 * Test detection performance (with timing)
 */
export async function testPerformance(url, iterations = 5) {
    console.log('\n' + '='.repeat(80));
    console.log('Performance Test');
    console.log('URL:', url);
    console.log('Iterations:', iterations);
    console.log('='.repeat(80));

    const times = [];

    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await detectStreamFormat(url);
        const end = Date.now();
        times.push(end - start);
        console.log(`Iteration ${i + 1}: ${end - start}ms`);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log('\n📊 Statistics:');
    console.log('  Average:', Math.round(avg), 'ms');
    console.log('  Min:', min, 'ms');
    console.log('  Max:', max, 'ms');

    return { avg, min, max, times };
}

/**
 * Test all formats
 */
export async function testAllFormats() {
    console.log('\n' + '='.repeat(80));
    console.log('Testing All Formats');
    console.log('='.repeat(80));

    const results = {
        hls: [],
        dash: [],
        mpegts: [],
        mp4: [],
        flv: [],
        failed: []
    };

    for (const [format, urls] of Object.entries(TEST_URLS)) {
        console.log(`\nTesting ${format.toUpperCase()} streams...`);

        for (const url of urls) {
            try {
                const result = await detectStreamFormat(url);
                results[format].push({
                    url,
                    detected: result.detectedFormat.format,
                    confidence: result.confidence,
                    correct: result.detectedFormat.format === format ||
                        (format === 'mpegts' && result.detectedFormat.format === 'ts')
                });

                const status = results[format][results[format].length - 1].correct ? '✅' : '❌';
                console.log(`  ${status} ${url} → ${result.detectedFormat.format}`);
            } catch (error) {
                results.failed.push({ url, error: error.message });
                console.log(`  ❌ ${url} → FAILED: ${error.message}`);
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('Summary');
    console.log('='.repeat(80));

    let totalTests = 0;
    let totalCorrect = 0;

    for (const [format, tests] of Object.entries(results)) {
        if (format === 'failed') continue;

        const correct = tests.filter(t => t.correct).length;
        const total = tests.length;
        totalTests += total;
        totalCorrect += correct;

        console.log(`${format.toUpperCase()}: ${correct}/${total} correct`);
    }

    console.log(`\nTotal: ${totalCorrect}/${totalTests} correct (${Math.round(totalCorrect / totalTests * 100)}%)`);
    console.log(`Failed: ${results.failed.length}`);

    return results;
}

/**
 * Test URL-only detection (no network)
 */
export async function testUrlOnlyDetection(url) {
    console.log('\n' + '='.repeat(80));
    console.log('Testing URL-Only Detection (No Network)');
    console.log('URL:', url);
    console.log('='.repeat(80));

    const result = await detectStreamFormat(url, {
        skipContentInspection: true  // Skip network requests
    });

    console.log('Format:', result.detectedFormat.format);
    console.log('Confidence:', result.confidence);
    console.log('Method:', result.detectionMethod);

    return result;
}

/**
 * Compare old vs new detection
 */
export async function compareDetectionMethods(url) {
    console.log('\n' + '='.repeat(80));
    console.log('Comparing Detection Methods');
    console.log('URL:', url);
    console.log('='.repeat(80));

    // New method (full detection)
    const start1 = Date.now();
    const newResult = await detectStreamFormat(url);
    const time1 = Date.now() - start1;

    console.log('\n✅ New Detection (Deterministic):');
    console.log('  Format:', newResult.detectedFormat.format);
    console.log('  Confidence:', newResult.confidence);
    console.log('  Time:', time1, 'ms');

    // Simulated old method (URL + HEAD only)
    const start2 = Date.now();
    const oldResult = await detectStreamFormat(url, { skipContentInspection: true });
    const time2 = Date.now() - start2;

    console.log('\n🔄 Old Detection (URL + Headers):');
    console.log('  Format:', oldResult.detectedFormat.format);
    console.log('  Confidence:', oldResult.confidence);
    console.log('  Time:', time2, 'ms');

    console.log('\n📊 Comparison:');
    console.log('  Time Difference:', (time1 - time2), 'ms');
    console.log('  Agreement:', newResult.detectedFormat.format === oldResult.detectedFormat.format ? 'Yes' : 'No');

    return { newResult, oldResult, time1, time2 };
}

// ============================================================================
// Example Usage
// ============================================================================

/**
 * Run all tests
 */
export async function runAllTests() {
    console.log('🚀 Starting Stream Format Detector Tests\n');

    // Test single detection
    await testSingleDetection('https://example.com/stream.m3u8');

    // Test batch detection
    await testBatchDetection([
        'https://example.com/stream1.m3u8',
        'https://example.com/stream2.mpd',
        'https://example.com/stream3.ts',
    ]);

    // Test performance
    await testPerformance('https://example.com/stream.m3u8', 3);

    // Test all formats
    await testAllFormats();

    console.log('\n✅ All tests complete!');
}

// Export for manual testing in console
export default {
    testSingleDetection,
    testBatchDetection,
    testPerformance,
    testAllFormats,
    testUrlOnlyDetection,
    compareDetectionMethods,
    runAllTests,
    TEST_URLS
};
