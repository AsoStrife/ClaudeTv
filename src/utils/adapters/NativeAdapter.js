/**
 * NativeAdapter - Adapter per video HTML5 nativi
 * 
 * Supporta:
 * - MP4, WebM, OGG
 * - HLS nativo (Safari)
 * - Qualsiasi formato supportato dal browser
 */

import { BaseAdapter } from './BaseAdapter'

export class NativeAdapter extends BaseAdapter {
    constructor(config = {}, timeout = 15000) {
        super(config, timeout)
        this.cleanupFunctions = []
    }

    get name() {
        return 'native'
    }

    isSupported() {
        return true // HTML5 video è sempre supportato
    }

    async attach(videoElement, url) {
        this.videoElement = videoElement
        this.url = url
        this.emit('buffering', { url })

        return new Promise((resolve) => {
            let resolved = false

            const timeoutId = setTimeout(() => {
                if (!resolved && !this.isDestroyed) {
                    console.warn('[NativeAdapter] Timeout loading video')
                    cleanup()
                    this.emit('error', { message: 'Timeout caricamento video' })
                    resolve(false)
                }
            }, this.timeout)

            const onReady = () => {
                if (resolved || this.isDestroyed) return
                resolved = true
                clearTimeout(timeoutId)
                cleanup()

                console.log('[NativeAdapter] Video ready')
                this.emit('ready', {})
                this.tryPlay(videoElement)
                resolve(true)
            }

            const onError = () => {
                if (resolved || this.isDestroyed) return
                resolved = true
                clearTimeout(timeoutId)
                cleanup()

                const errorDetails = videoElement.error ? {
                    code: videoElement.error.code,
                    message: videoElement.error.message
                } : null

                console.error('[NativeAdapter] Video error:', errorDetails)

                this.emit('error', {
                    message: this.getErrorMessage(videoElement.error),
                    details: errorDetails
                })
                resolve(false)
            }

            const cleanup = () => {
                videoElement.removeEventListener('loadeddata', onReady)
                videoElement.removeEventListener('canplay', onReady)
                videoElement.removeEventListener('error', onError)
            }

            // Salva cleanup per destroy
            this.cleanupFunctions.push(cleanup)

            videoElement.addEventListener('loadeddata', onReady, { once: true })
            videoElement.addEventListener('canplay', onReady, { once: true })
            videoElement.addEventListener('error', onError, { once: true })

            // Rimuovi src precedente e carica nuovo
            videoElement.removeAttribute('src')
            videoElement.src = url
            videoElement.load()
        })
    }

    getErrorMessage(error) {
        if (!error) return 'Errore sconosciuto nel caricamento video'

        switch (error.code) {
            case 1: // MEDIA_ERR_ABORTED
                return 'Caricamento video interrotto'
            case 2: // MEDIA_ERR_NETWORK
                return 'Errore di rete durante il caricamento'
            case 3: // MEDIA_ERR_DECODE
                return 'Errore di decodifica video'
            case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
                return 'Formato video non supportato'
            default:
                return error.message || 'Errore nel caricamento video'
        }
    }

    async destroy() {
        // Esegui tutte le funzioni di cleanup
        this.cleanupFunctions.forEach(fn => {
            try {
                fn()
            } catch (err) {
                // Ignora errori di cleanup
            }
        })
        this.cleanupFunctions = []

        // Pulisci video element
        if (this.videoElement) {
            this.videoElement.removeAttribute('src')
            this.videoElement.load()
        }

        await super.destroy()
    }
}

export default NativeAdapter
