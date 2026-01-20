/**
 * BaseAdapter - Classe base per tutti gli adapter di streaming
 * 
 * Fornisce interfaccia comune e gestione eventi standardizzata
 */

export class BaseAdapter {
    constructor(config = {}, timeout = 15000) {
        this.config = config
        this.timeout = timeout
        this.videoElement = null
        this.url = null
        this.eventHandlers = new Map()
        this.isDestroyed = false
    }

    /**
     * Nome dell'adapter (da sovrascrivere)
     */
    get name() {
        return 'base'
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
    emit(event, data = {}) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler({ adapter: this.name, ...data })
                } catch (err) {
                    console.error(`[${this.name}Adapter] Event handler error:`, err)
                }
            })
        }
    }

    /**
     * Verifica se l'adapter è supportato nel browser corrente
     */
    isSupported() {
        return true
    }

    /**
     * Attacca lo stream al video element (da sovrascrivere)
     * @returns {Promise<boolean>} true se successo, false se fallimento
     */
    async attach(videoElement, url) {
        throw new Error('attach() must be implemented by subclass')
    }

    /**
     * Distrugge l'adapter e pulisce le risorse (da sovrascrivere)
     */
    async destroy() {
        this.isDestroyed = true
        this.videoElement = null
        this.url = null
        this.eventHandlers.clear()
    }

    /**
     * Crea una Promise con timeout
     */
    withTimeout(promise, timeoutMs = this.timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout after ${timeoutMs}ms`))
            }, timeoutMs)

            promise
                .then(result => {
                    clearTimeout(timer)
                    resolve(result)
                })
                .catch(err => {
                    clearTimeout(timer)
                    reject(err)
                })
        })
    }

    /**
     * Aspetta che il video sia pronto per la riproduzione
     */
    waitForVideoReady(videoElement, timeoutMs = this.timeout) {
        return new Promise((resolve, reject) => {
            if (this.isDestroyed) {
                reject(new Error('Adapter destroyed'))
                return
            }

            const timer = setTimeout(() => {
                cleanup()
                reject(new Error(`Video ready timeout after ${timeoutMs}ms`))
            }, timeoutMs)

            const onReady = () => {
                cleanup()
                resolve(true)
            }

            const onError = (e) => {
                cleanup()
                reject(new Error(videoElement.error?.message || 'Video error'))
            }

            const cleanup = () => {
                clearTimeout(timer)
                videoElement.removeEventListener('loadeddata', onReady)
                videoElement.removeEventListener('canplay', onReady)
                videoElement.removeEventListener('error', onError)
            }

            videoElement.addEventListener('loadeddata', onReady, { once: true })
            videoElement.addEventListener('canplay', onReady, { once: true })
            videoElement.addEventListener('error', onError, { once: true })
        })
    }

    /**
     * Tenta il play del video con gestione errori
     */
    async tryPlay(videoElement) {
        try {
            await videoElement.play()
            return true
        } catch (err) {
            console.warn(`[${this.name}Adapter] Autoplay blocked:`, err.message)
            return false
        }
    }
}

export default BaseAdapter
