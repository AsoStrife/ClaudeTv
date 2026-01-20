/**
 * DashAdapter - Adapter per stream DASH via dash.js
 * 
 * Supporta:
 * - .mpd manifest (MPEG-DASH)
 * - Adaptive bitrate streaming
 * - DRM (se configurato)
 */

import * as dashjs from 'dashjs'
import { BaseAdapter } from './BaseAdapter'

export class DashAdapter extends BaseAdapter {
    constructor(config = {}, timeout = 15000) {
        super(config, timeout)
        this.player = null
    }

    get name() {
        return 'dash'
    }

    isSupported() {
        // DASH.js richiede MSE (Media Source Extensions)
        return typeof window !== 'undefined' &&
            'MediaSource' in window &&
            MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"')
    }

    async attach(videoElement, url) {
        if (!this.isSupported()) {
            console.warn('[DashAdapter] DASH not supported (MSE unavailable)')
            return false
        }

        this.videoElement = videoElement
        this.url = url
        this.emit('buffering', { url })

        return new Promise((resolve) => {
            let resolved = false

            const timeoutId = setTimeout(() => {
                if (!resolved && !this.isDestroyed) {
                    console.warn('[DashAdapter] Timeout waiting for manifest')
                    this.emit('error', { message: 'Timeout caricamento manifest DASH' })
                    resolve(false)
                }
            }, this.timeout)

            try {
                this.player = dashjs.MediaPlayer().create()

                // Configura le impostazioni
                if (this.config.streaming) {
                    this.player.updateSettings(this.config)
                }

                // Eventi DASH
                this.player.on('manifestLoaded', () => {
                    if (resolved || this.isDestroyed) return
                    console.log('[DashAdapter] Manifest loaded')
                })

                this.player.on('streamInitialized', () => {
                    if (resolved || this.isDestroyed) return
                    resolved = true
                    clearTimeout(timeoutId)

                    console.log('[DashAdapter] Stream initialized')
                    this.emit('ready', {})
                    resolve(true)
                })

                this.player.on('playbackStarted', () => {
                    console.log('[DashAdapter] Playback started')
                })

                this.player.on('error', (e) => {
                    console.error('[DashAdapter] Error:', e)

                    // Errori di download manifest sono fatali per la connessione iniziale
                    if (e.error === 'download' ||
                        e.error?.code === 'DOWNLOAD_ERROR_ID_MANIFEST' ||
                        e.error?.message?.includes('manifest')) {

                        if (!resolved) {
                            resolved = true
                            clearTimeout(timeoutId)
                            this.emit('error', {
                                message: 'Errore caricamento manifest DASH',
                                details: e.error
                            })
                            resolve(false)
                        }
                        return
                    }

                    this.emit('error', {
                        message: `Errore DASH: ${e.error?.message || e.error || 'Sconosciuto'}`,
                        details: e
                    })

                    // Se non ancora risolto, fallisci
                    if (!resolved) {
                        resolved = true
                        clearTimeout(timeoutId)
                        resolve(false)
                    }
                })

                // Inizializza il player (autoplay = true)
                this.player.initialize(videoElement, url, true)

            } catch (err) {
                console.error('[DashAdapter] Initialization error:', err)
                clearTimeout(timeoutId)
                this.emit('error', { message: err.message })
                resolve(false)
            }
        })
    }

    async destroy() {
        if (this.player) {
            try {
                this.player.reset()
            } catch (err) {
                console.warn('[DashAdapter] Error during reset:', err)
            }
            this.player = null
        }
        await super.destroy()
    }

    /**
     * Cambia qualità manualmente
     */
    setQuality(qualityIndex) {
        if (this.player) {
            this.player.setQualityFor('video', qualityIndex)
        }
    }

    /**
     * Ottieni le qualità disponibili
     */
    getQualities() {
        if (this.player) {
            return this.player.getBitrateInfoListFor('video')
        }
        return []
    }
}

export default DashAdapter
