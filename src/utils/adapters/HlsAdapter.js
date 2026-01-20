/**
 * HlsAdapter - Adapter per stream HLS via hls.js
 * 
 * Supporta:
 * - .m3u8 / .m3u manifest
 * - HLS live e VOD
 * - Adaptive bitrate
 */

import Hls from 'hls.js'
import { BaseAdapter } from './BaseAdapter'

export class HlsAdapter extends BaseAdapter {
    constructor(config = {}, timeout = 15000) {
        super(config, timeout)
        this.hls = null
    }

    get name() {
        return 'hls'
    }

    isSupported() {
        return Hls.isSupported()
    }

    async attach(videoElement, url) {
        if (!this.isSupported()) {
            // Safari può riprodurre HLS nativamente
            if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                console.log('[HlsAdapter] Using native HLS (Safari)')
                return this.attachNative(videoElement, url)
            }
            console.warn('[HlsAdapter] HLS.js not supported')
            return false
        }

        this.videoElement = videoElement
        this.url = url
        this.emit('buffering', { url })

        return new Promise((resolve) => {
            const hlsConfig = {
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
                fragLoadingRetryDelay: 1000,
                xhrSetup: (xhr, url) => {
                    xhr.withCredentials = false
                },
                ...this.config
            }

            this.hls = new Hls(hlsConfig)

            let resolved = false
            const timeoutId = setTimeout(() => {
                if (!resolved && !this.isDestroyed) {
                    console.warn('[HlsAdapter] Timeout waiting for manifest')
                    this.emit('error', { message: 'Timeout caricamento manifest HLS' })
                    resolve(false)
                }
            }, this.timeout)

            // Manifest parsed con successo
            this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                if (resolved || this.isDestroyed) return
                resolved = true
                clearTimeout(timeoutId)

                console.log('[HlsAdapter] Manifest parsed, levels:', data.levels?.length)
                this.emit('ready', { levels: data.levels?.length })

                this.tryPlay(videoElement)
                resolve(true)
            })

            // Gestione errori
            this.hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('[HlsAdapter] Error:', {
                    type: data.type,
                    details: data.details,
                    fatal: data.fatal
                })

                if (data.fatal) {
                    if (resolved) {
                        // Errore dopo connessione riuscita
                        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                            console.log('[HlsAdapter] Attempting media error recovery')
                            this.hls.recoverMediaError()
                            return
                        }
                    }

                    if (!resolved) {
                        resolved = true
                        clearTimeout(timeoutId)
                    }

                    this.emit('error', {
                        message: this.getErrorMessage(data),
                        details: data.details,
                        fatal: true
                    })

                    if (!resolved) {
                        resolve(false)
                    }
                }
            })

            // Carica e attacca
            this.hls.loadSource(url)
            this.hls.attachMedia(videoElement)
        })
    }

    /**
     * Fallback per Safari con HLS nativo
     */
    async attachNative(videoElement, url) {
        this.videoElement = videoElement
        this.url = url

        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                if (!this.isDestroyed) {
                    this.emit('error', { message: 'Timeout caricamento HLS nativo' })
                    resolve(false)
                }
            }, this.timeout)

            const onReady = () => {
                clearTimeout(timeoutId)
                cleanup()
                this.emit('ready', {})
                this.tryPlay(videoElement)
                resolve(true)
            }

            const onError = () => {
                clearTimeout(timeoutId)
                cleanup()
                this.emit('error', { message: videoElement.error?.message || 'Errore HLS nativo' })
                resolve(false)
            }

            const cleanup = () => {
                videoElement.removeEventListener('loadeddata', onReady)
                videoElement.removeEventListener('canplay', onReady)
                videoElement.removeEventListener('error', onError)
            }

            videoElement.addEventListener('loadeddata', onReady, { once: true })
            videoElement.addEventListener('canplay', onReady, { once: true })
            videoElement.addEventListener('error', onError, { once: true })

            videoElement.src = url
            videoElement.load()
        })
    }

    getErrorMessage(data) {
        switch (data.details) {
            case 'manifestParsingError':
            case 'manifestLoadError':
                return 'Errore caricamento manifest HLS'
            case 'levelLoadError':
                return 'Errore caricamento livello qualità'
            case 'fragLoadError':
                return 'Errore caricamento segmento video'
            default:
                return `Errore HLS: ${data.details || data.type}`
        }
    }

    async destroy() {
        if (this.hls) {
            this.hls.destroy()
            this.hls = null
        }
        await super.destroy()
    }
}

export default HlsAdapter
