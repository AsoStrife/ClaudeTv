/**
 * MpegtsAdapter - Adapter per stream MPEG-TS e FLV via mpegts.js
 * 
 * Supporta:
 * - MPEG-TS (.ts) live streams
 * - FLV (.flv) live streams
 * - HTTP-FLV
 */

import mpegts from 'mpegts.js'
import { BaseAdapter } from './BaseAdapter'

export class MpegtsAdapter extends BaseAdapter {
    constructor(config = {}, timeout = 15000, streamType = 'mpegts') {
        super(config, timeout)
        this.player = null
        this.streamType = streamType // 'mpegts' o 'flv'
    }

    get name() {
        return this.streamType === 'flv' ? 'flv' : 'mpegts'
    }

    isSupported() {
        return mpegts.isSupported()
    }

    async attach(videoElement, url) {
        if (!this.isSupported()) {
            console.warn('[MpegtsAdapter] mpegts.js not supported')
            return false
        }

        this.videoElement = videoElement
        this.url = url
        this.emit('buffering', { url })

        // Prova prima con il tipo specificato, poi con l'alternativo
        const success = await this.tryAttach(videoElement, url, this.streamType)

        if (!success && this.streamType === 'mpegts') {
            console.log('[MpegtsAdapter] MPEGTS failed, trying FLV...')
            return this.tryAttach(videoElement, url, 'flv')
        }

        return success
    }

    async tryAttach(videoElement, url, streamType) {
        return new Promise((resolve) => {
            let resolved = false

            const timeoutId = setTimeout(() => {
                if (!resolved && !this.isDestroyed) {
                    console.warn(`[MpegtsAdapter] Timeout for ${streamType}`)
                    this.destroyPlayer()
                    resolve(false)
                }
            }, this.timeout)

            try {
                // Distruggi player precedente se esiste
                this.destroyPlayer()

                const playerConfig = {
                    type: streamType,
                    isLive: true,
                    url: url,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }

                const mediaConfig = {
                    enableWorker: true,
                    enableStashBuffer: true,
                    stashInitialSize: 384,
                    autoCleanupSourceBuffer: true,
                    autoCleanupMaxBackwardDuration: 60,
                    autoCleanupMinBackwardDuration: 30,
                    liveBufferLatencyChasing: true,
                    liveBufferLatencyMaxLatency: 5,
                    liveBufferLatencyMinRemain: 1,
                    lazyLoad: false,
                    lazyLoadMaxDuration: 0,
                    deferLoadAfterSourceOpen: false,
                    ...this.config
                }

                this.player = mpegts.createPlayer(playerConfig, mediaConfig)
                this.player.attachMediaElement(videoElement)

                // Eventi
                this.player.on(mpegts.Events.ERROR, (errType, errDetail) => {
                    console.error(`[MpegtsAdapter] ${streamType} error:`, errType, errDetail)

                    if (!resolved) {
                        resolved = true
                        clearTimeout(timeoutId)
                        this.emit('error', {
                            message: this.getErrorMessage(errType, errDetail),
                            type: errType,
                            detail: errDetail
                        })
                        resolve(false)
                    }
                })

                this.player.on(mpegts.Events.LOADING_COMPLETE, () => {
                    console.log(`[MpegtsAdapter] ${streamType} loading complete`)
                })

                this.player.on(mpegts.Events.METADATA_ARRIVED, (metadata) => {
                    if (resolved || this.isDestroyed) return
                    resolved = true
                    clearTimeout(timeoutId)

                    console.log(`[MpegtsAdapter] ${streamType} metadata arrived:`, metadata)
                    this.emit('ready', { metadata })
                    this.tryPlay(videoElement)
                    resolve(true)
                })

                this.player.on(mpegts.Events.MEDIA_INFO, (mediaInfo) => {
                    console.log(`[MpegtsAdapter] ${streamType} media info:`, mediaInfo)

                    // Se non abbiamo già risolto con metadata, risolvi qui
                    if (!resolved && !this.isDestroyed) {
                        resolved = true
                        clearTimeout(timeoutId)
                        this.emit('ready', { mediaInfo })
                        this.tryPlay(videoElement)
                        resolve(true)
                    }
                })

                // Anche il video element può indicare successo
                const onVideoReady = () => {
                    if (!resolved && !this.isDestroyed) {
                        resolved = true
                        clearTimeout(timeoutId)
                        console.log(`[MpegtsAdapter] ${streamType} video ready`)
                        this.emit('ready', {})
                        this.tryPlay(videoElement)
                        resolve(true)
                    }
                }

                videoElement.addEventListener('loadeddata', onVideoReady, { once: true })
                videoElement.addEventListener('canplay', onVideoReady, { once: true })

                // Inizia caricamento
                this.player.load()

            } catch (err) {
                console.error(`[MpegtsAdapter] Failed to create ${streamType} player:`, err)
                clearTimeout(timeoutId)
                this.emit('error', { message: err.message })
                resolve(false)
            }
        })
    }

    destroyPlayer() {
        if (this.player) {
            try {
                this.player.pause()
                this.player.unload()
                this.player.detachMediaElement()
                this.player.destroy()
            } catch (err) {
                console.warn('[MpegtsAdapter] Error during player cleanup:', err)
            }
            this.player = null
        }
    }

    getErrorMessage(errType, errDetail) {
        if (errType === mpegts.ErrorTypes.NETWORK_ERROR) {
            return 'Errore di rete durante caricamento stream'
        }
        if (errType === mpegts.ErrorTypes.MEDIA_ERROR) {
            return 'Formato media non supportato o corrotto'
        }
        return `Errore stream: ${errDetail || errType}`
    }

    async destroy() {
        this.destroyPlayer()
        await super.destroy()
    }
}

export default MpegtsAdapter
