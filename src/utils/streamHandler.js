/**
 * StreamHandler - Gestore centralizzato per flussi video streaming
 * 
 * Gestisce automaticamente la selezione della libreria appropriata
 * (HLS, DASH, MPEGTS, Native, RTSP/RTMP) basandosi sull'URL e Content-Type.
 * 
 * Supporta:
 * - HLS (.m3u8, .m3u) via hls.js
 * - DASH (.mpd) via dash.js  
 * - MPEG-TS/FLV (.ts, .flv) via mpegts.js
 * - RTSP/RTMP (rtsp://, rtmp://) via Tauri sidecar (quando disponibile)
 * - Video nativi (.mp4, .webm, etc.) via HTML5 video
 */

import { httpFetch } from './httpClient';
import { HlsAdapter } from './adapters/HlsAdapter'
import { DashAdapter } from './adapters/DashAdapter'
import { MpegtsAdapter } from './adapters/MpegtsAdapter'
import { NativeAdapter } from './adapters/NativeAdapter'
import { RtspRtmpAdapter } from './adapters/RtspRtmpAdapter'

// Tipi di stream supportati
export const StreamType = {
    HLS: 'hls',
    DASH: 'dash',
    MPEGTS: 'mpegts',
    FLV: 'flv',
    RTSP: 'rtsp',
    RTMP: 'rtmp',
    NATIVE: 'native',
    UNKNOWN: 'unknown'
}

// Configurazione di default
const DEFAULT_CONFIG = {
    timeout: 15000,           // 15 secondi di timeout
    retryAttempts: 2,         // Numero di tentativi per adapter
    enableFallback: true,     // Abilita fallback chain
    enableContentTypeSniffing: true, // Prova HEAD request per Content-Type
    fallbackOrder: [          // Ordine di fallback
        StreamType.HLS,
        StreamType.DASH,
        StreamType.MPEGTS,
        StreamType.NATIVE
    ],
    // Configurazione specifica per HLS
    hls: {
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        liveDurationInfinity: true,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000
    },
    // Configurazione specifica per MPEGTS
    mpegts: {
        enableWorker: true,
        enableStashBuffer: true,
        stashInitialSize: 384,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 60,
        autoCleanupMinBackwardDuration: 30,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 5,
        liveBufferLatencyMinRemain: 1
    },
    // Configurazione specifica per DASH
    dash: {
        streaming: {
            lowLatencyEnabled: true,
            abr: {
                useDefaultABRRules: true
            }
        }
    }
}

/**
 * Classe principale StreamHandler
 */
export class StreamHandler {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config }
        this.currentAdapter = null
        this.currentType = StreamType.UNKNOWN
        this.videoElement = null
        this.url = null
        this.eventHandlers = new Map()
        this.streamCache = new Map() // Cache URL -> tipo funzionante
    }

    /**
     * Aggiorna la configurazione
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig }
    }

    /**
     * Registra un event handler
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, [])
        }
        this.eventHandlers.get(event).push(handler)
        return this
    }

    /**
     * Rimuove un event handler
     */
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event)
            const index = handlers.indexOf(handler)
            if (index > -1) {
                handlers.splice(index, 1)
            }
        }
        return this
    }

    /**
     * Emette un evento
     */
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data))
        }
    }

    /**
     * Rileva il tipo di stream dall'URL
     */
    detectTypeFromUrl(url) {
        if (!url) return StreamType.UNKNOWN

        const lowerUrl = url.toLowerCase()

        // RTSP/RTMP - protocolli speciali
        if (lowerUrl.startsWith('rtsp://')) return StreamType.RTSP
        if (lowerUrl.startsWith('rtmp://')) return StreamType.RTMP

        // DASH
        if (lowerUrl.includes('.mpd') ||
            lowerUrl.includes('manifest.mpd') ||
            lowerUrl.includes('.isml/manifest')) {
            return StreamType.DASH
        }

        // HLS esplicito
        if (lowerUrl.includes('.m3u8') || lowerUrl.includes('.m3u')) {
            return StreamType.HLS
        }

        // MPEGTS/FLV
        if (lowerUrl.includes('.ts') ||
            lowerUrl.includes('/ts/') ||
            lowerUrl.includes('mpegts')) {
            return StreamType.MPEGTS
        }

        if (lowerUrl.includes('.flv') || lowerUrl.includes('/flv/')) {
            return StreamType.FLV
        }

        // Video nativi
        const nativeExtensions = /\.(mp4|mkv|avi|mov|wmv|webm)(\?|$)/i
        if (nativeExtensions.test(url)) {
            return StreamType.NATIVE
        }

        return StreamType.UNKNOWN
    }

    /**
     * Tenta di rilevare il tipo via Content-Type (HEAD request)
     */
    async detectTypeFromContentType(url) {
        if (!this.config.enableContentTypeSniffing) {
            return StreamType.UNKNOWN
        }

        try {
            // Use Tauri HTTP client to bypass CORS
            const response = await httpFetch(url, { method: 'HEAD' });

            if (response.status < 200 || response.status >= 300) {
                return StreamType.UNKNOWN;
            }

            const contentType = response.headers['content-type']?.toLowerCase() || '';

            if (contentType.includes('application/vnd.apple.mpegurl') ||
                contentType.includes('application/x-mpegurl')) {
                return StreamType.HLS
            }

            if (contentType.includes('application/dash+xml')) {
                return StreamType.DASH
            }

            if (contentType.includes('video/mp2t') ||
                contentType.includes('video/mpeg')) {
                return StreamType.MPEGTS
            }

            if (contentType.includes('video/x-flv')) {
                return StreamType.FLV
            }

            if (contentType.includes('video/mp4')) {
                return StreamType.NATIVE
            }

        } catch (err) {
            console.log('[StreamHandler] Content-Type detection failed:', err.message)
        }

        return StreamType.UNKNOWN
    }

    /**
     * Rileva il tipo di stream (combinando URL e Content-Type)
     */
    async detectStreamType(url) {
        // 1. Controlla cache
        if (this.streamCache.has(url)) {
            const cached = this.streamCache.get(url)
            console.log(`[StreamHandler] Using cached type for ${url}: ${cached}`)
            return cached
        }

        // 2. Rileva da URL
        let detectedType = this.detectTypeFromUrl(url)

        if (detectedType !== StreamType.UNKNOWN) {
            console.log(`[StreamHandler] Detected type from URL: ${detectedType}`)
            return detectedType
        }

        // 3. Se sconosciuto, prova Content-Type
        detectedType = await this.detectTypeFromContentType(url)

        if (detectedType !== StreamType.UNKNOWN) {
            console.log(`[StreamHandler] Detected type from Content-Type: ${detectedType}`)
            return detectedType
        }

        console.log('[StreamHandler] Could not detect type, will try fallback chain')
        return StreamType.UNKNOWN
    }

    /**
     * Crea l'adapter appropriato per il tipo di stream
     */
    createAdapter(type) {
        switch (type) {
            case StreamType.HLS:
                return new HlsAdapter(this.config.hls, this.config.timeout)
            case StreamType.DASH:
                return new DashAdapter(this.config.dash, this.config.timeout)
            case StreamType.MPEGTS:
            case StreamType.FLV:
                return new MpegtsAdapter(this.config.mpegts, this.config.timeout, type === StreamType.FLV ? 'flv' : 'mpegts')
            case StreamType.RTSP:
            case StreamType.RTMP:
                return new RtspRtmpAdapter(this.config.timeout)
            case StreamType.NATIVE:
            default:
                return new NativeAdapter(this.config.timeout)
        }
    }

    /**
     * Costruisce la fallback chain basata sul tipo rilevato
     */
    buildFallbackChain(detectedType) {
        const chain = []

        // Se abbiamo rilevato un tipo, mettilo per primo
        if (detectedType !== StreamType.UNKNOWN) {
            chain.push(detectedType)
        }

        // Aggiungi il resto della fallback order, evitando duplicati
        for (const type of this.config.fallbackOrder) {
            if (!chain.includes(type)) {
                chain.push(type)
            }
        }

        // Aggiungi NATIVE alla fine se non presente
        if (!chain.includes(StreamType.NATIVE)) {
            chain.push(StreamType.NATIVE)
        }

        return chain
    }

    /**
     * Attacca uno stream al video element
     */
    async attach(videoElement, url) {
        if (!videoElement || !url) {
            throw new Error('Video element and URL are required')
        }

        console.log('='.repeat(60))
        console.log('[StreamHandler] Attaching stream')
        console.log('URL:', url)
        console.log('='.repeat(60))

        // Pulisci stato precedente
        await this.destroy()

        this.videoElement = videoElement
        this.url = url

        // Emetti evento di inizio caricamento
        this.emit('loading', { url })

        // Rileva tipo stream
        const detectedType = await this.detectStreamType(url)

        // Costruisci fallback chain
        const fallbackChain = this.buildFallbackChain(detectedType)
        console.log('[StreamHandler] Fallback chain:', fallbackChain)

        // Prova ogni adapter nella chain
        for (const type of fallbackChain) {
            if (!this.config.enableFallback && type !== fallbackChain[0]) {
                break // Se fallback disabilitato, prova solo il primo
            }

            console.log(`[StreamHandler] Trying adapter: ${type}`)

            try {
                const adapter = this.createAdapter(type)

                // Propaga eventi dall'adapter
                adapter.on('ready', (data) => this.emit('ready', { ...data, type }))
                adapter.on('error', (data) => this.emit('adapterError', { ...data, type }))
                adapter.on('buffering', (data) => this.emit('buffering', { ...data, type }))

                const success = await adapter.attach(videoElement, url)

                if (success) {
                    this.currentAdapter = adapter
                    this.currentType = type

                    // Salva in cache
                    this.streamCache.set(url, type)

                    console.log(`[StreamHandler] Success with adapter: ${type}`)
                    this.emit('success', { type, url })
                    return true
                }
            } catch (err) {
                console.warn(`[StreamHandler] Adapter ${type} failed:`, err.message)
            }
        }

        // Tutti i tentativi falliti
        console.error('[StreamHandler] All adapters failed')
        this.emit('error', { message: 'Impossibile riprodurre lo stream. Tutti i formati provati sono falliti.', url })
        return false
    }

    /**
     * Distrugge l'adapter corrente e pulisce lo stato
     */
    async destroy() {
        if (this.currentAdapter) {
            await this.currentAdapter.destroy()
            this.currentAdapter = null
        }
        this.currentType = StreamType.UNKNOWN
        this.videoElement = null
        this.url = null
    }

    /**
     * Ritorna il tipo di stream corrente
     */
    getType() {
        return this.currentType
    }

    /**
     * Ritorna informazioni sullo stato corrente
     */
    getStatus() {
        return {
            url: this.url,
            type: this.currentType,
            isAttached: this.currentAdapter !== null,
            config: this.config
        }
    }

    /**
     * Riprova il caricamento dello stream corrente
     */
    async retry() {
        if (this.url && this.videoElement) {
            // Rimuovi dalla cache per forzare nuova detection
            this.streamCache.delete(this.url)
            return this.attach(this.videoElement, this.url)
        }
        return false
    }

    /**
     * Pulisce la cache dei tipi di stream
     */
    clearCache() {
        this.streamCache.clear()
    }

    /**
     * Rimuove una entry specifica dalla cache
     */
    removeFromCache(url) {
        this.streamCache.delete(url)
    }
}

// Esporta istanza singleton per uso globale
export const streamHandler = new StreamHandler()

export default StreamHandler
