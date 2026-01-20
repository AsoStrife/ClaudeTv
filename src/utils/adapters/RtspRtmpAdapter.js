/**
 * RtspRtmpAdapter - Adapter per stream RTSP/RTMP
 * 
 * Richiede Tauri v2 con MediaMTX o FFmpeg come sidecar
 * per convertire RTSP/RTMP in HLS riproducibile dal browser.
 * 
 * Supporta:
 * - RTSP (rtsp://)
 * - RTMP (rtmp://)
 * 
 * Funzionamento:
 * 1. Chiama comando Tauri per avviare proxy MediaMTX/FFmpeg
 * 2. Il sidecar converte RTSP/RTMP -> HLS
 * 3. Restituisce URL HLS locale (http://localhost:PORT/stream.m3u8)
 * 4. HlsAdapter riproduce lo stream HLS
 */

import { BaseAdapter } from './BaseAdapter'
import { HlsAdapter } from './HlsAdapter'

// Stato globale per tracciare i proxy attivi
const activeProxies = new Map()
let proxyPort = 8888

/**
 * Helper per caricare Tauri dinamicamente (solo se disponibile)
 * Usa un pattern che Vite/Rollup può ignorare durante la build
 */
async function loadTauriInvoke() {
    try {
        // Verifica se siamo in ambiente Tauri
        if (typeof window !== 'undefined' && window.__TAURI__) {
            // Import dinamico con variabile per evitare analisi statica di Rollup
            const moduleName = '@tauri-apps/api/core'
            const tauriModule = await (Function('moduleName', 'return import(moduleName)')(moduleName))
            return tauriModule.invoke
        }
    } catch (err) {
        console.log('[RtspRtmpAdapter] Tauri module not available:', err.message)
    }
    return null
}

export class RtspRtmpAdapter extends BaseAdapter {
    constructor(config = {}, timeout = 15000) {
        super(config, timeout)
        this.proxyUrl = null
        this.hlsAdapter = null
        this.tauriAvailable = false
        this.proxyStarted = false
        this.invoke = null
    }

    get name() {
        return 'rtsp-rtmp'
    }

    /**
     * Verifica se Tauri è disponibile
     */
    async checkTauriAvailable() {
        this.invoke = await loadTauriInvoke()
        this.tauriAvailable = this.invoke !== null
        return this.tauriAvailable
    }

    isSupported() {
        // RTSP/RTMP richiedono Tauri, ma ritorniamo true per permettere
        // il tentativo - fallirà con errore esplicito se Tauri non c'è
        return true
    }

    /**
     * Determina il tipo di stream dall'URL
     */
    getStreamProtocol(url) {
        if (url.toLowerCase().startsWith('rtsp://')) return 'rtsp'
        if (url.toLowerCase().startsWith('rtmp://')) return 'rtmp'
        return null
    }

    async attach(videoElement, url) {
        this.videoElement = videoElement
        this.url = url
        this.emit('buffering', { url })

        const protocol = this.getStreamProtocol(url)
        if (!protocol) {
            this.emit('error', { message: 'URL non è RTSP o RTMP' })
            return false
        }

        // Verifica se Tauri è disponibile
        await this.checkTauriAvailable()

        if (!this.tauriAvailable) {
            console.warn('[RtspRtmpAdapter] Tauri not available - RTSP/RTMP requires desktop app')
            this.emit('error', {
                message: `Stream ${protocol.toUpperCase()} non supportato nella versione web. Usa l'app desktop.`,
                requiresDesktop: true
            })
            return false
        }

        try {
            // Avvia il proxy via Tauri
            const localHlsUrl = await this.startProxy(url, protocol)

            if (!localHlsUrl) {
                this.emit('error', { message: 'Impossibile avviare proxy stream' })
                return false
            }

            this.proxyUrl = localHlsUrl
            this.proxyStarted = true

            // Usa HlsAdapter per riprodurre lo stream convertito
            this.hlsAdapter = new HlsAdapter(this.config, this.timeout)

            // Propaga eventi
            this.hlsAdapter.on('ready', (data) => this.emit('ready', data))
            this.hlsAdapter.on('error', (data) => this.emit('error', data))
            this.hlsAdapter.on('buffering', (data) => this.emit('buffering', data))

            return await this.hlsAdapter.attach(videoElement, localHlsUrl)

        } catch (err) {
            console.error('[RtspRtmpAdapter] Error:', err)
            this.emit('error', { message: err.message || 'Errore avvio proxy RTSP/RTMP' })
            return false
        }
    }

    /**
     * Avvia il proxy MediaMTX/FFmpeg via Tauri
     */
    async startProxy(sourceUrl, protocol) {
        if (!this.invoke) {
            throw new Error('Tauri invoke not available')
        }

        // Controlla se c'è già un proxy per questo URL
        if (activeProxies.has(sourceUrl)) {
            const existing = activeProxies.get(sourceUrl)
            console.log(`[RtspRtmpAdapter] Reusing existing proxy on port ${existing.port}`)
            return existing.hlsUrl
        }

        // Ottieni una porta libera
        const port = proxyPort++
        if (proxyPort > 8999) proxyPort = 8888

        console.log(`[RtspRtmpAdapter] Starting ${protocol} proxy on port ${port}`)
        console.log(`[RtspRtmpAdapter] Source: ${sourceUrl}`)

        try {
            // Chiama comando Tauri per avviare il proxy
            const result = await this.invoke('start_stream_proxy', {
                sourceUrl: sourceUrl,
                outputPort: port,
                protocol: protocol
            })

            const hlsUrl = result?.hlsUrl || `http://localhost:${port}/stream/index.m3u8`

            // Salva proxy attivo
            activeProxies.set(sourceUrl, {
                port: port,
                hlsUrl: hlsUrl,
                protocol: protocol
            })

            console.log(`[RtspRtmpAdapter] Proxy started, HLS URL: ${hlsUrl}`)
            return hlsUrl

        } catch (err) {
            console.error('[RtspRtmpAdapter] Failed to start proxy:', err)
            throw new Error(`Impossibile avviare proxy ${protocol}: ${err.message}`)
        }
    }

    /**
     * Ferma il proxy
     */
    async stopProxy() {
        if (!this.proxyStarted || !this.url || !this.invoke) return

        try {
            // Rimuovi dalla mappa
            activeProxies.delete(this.url)

            // Chiama Tauri per fermare il proxy
            await this.invoke('stop_stream_proxy', {
                sourceUrl: this.url
            })

            console.log('[RtspRtmpAdapter] Proxy stopped')
        } catch (err) {
            console.warn('[RtspRtmpAdapter] Error stopping proxy:', err)
        }

        this.proxyStarted = false
    }

    async destroy() {
        // Distruggi HLS adapter interno
        if (this.hlsAdapter) {
            await this.hlsAdapter.destroy()
            this.hlsAdapter = null
        }

        // Ferma il proxy
        await this.stopProxy()

        this.proxyUrl = null
        this.invoke = null
        await super.destroy()
    }
}

/**
 * Ferma tutti i proxy attivi (da chiamare alla chiusura app)
 */
export async function stopAllProxies() {
    const invoke = await loadTauriInvoke()
    if (!invoke) return

    for (const [url, proxy] of activeProxies) {
        try {
            await invoke('stop_stream_proxy', { sourceUrl: url })
        } catch (err) {
            console.warn('Error stopping proxy:', err)
        }
    }
    activeProxies.clear()
}

export default RtspRtmpAdapter
