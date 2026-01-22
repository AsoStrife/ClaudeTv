<template>
    <div class="relative w-full h-full bg-black flex items-center justify-center">
        <!-- Video Element -->
        <video ref="videoRef" class="w-full h-full" controls autoplay playsinline />

        <!-- Error Overlay -->
        <div v-if="playerError" class="absolute inset-0 flex items-center justify-center bg-black/80">
            <div class="text-center p-6 max-w-md">
                <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 class="text-xl font-bold text-white mb-2">Errore di riproduzione</h3>
                <p class="text-gray-400 text-sm mb-4">{{ playerError }}</p>
                <div class="flex gap-3 justify-center">
                    <button @click="retry"
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                        Riprova
                    </button>
                    <button @click="retryFresh"
                        class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm">
                        Riprova (forza)
                    </button>
                </div>
            </div>
        </div>

        <!-- No Channel Selected -->
        <div v-if="!channel" class="absolute inset-0 flex items-center justify-center">
            <div class="text-center p-6">
                <svg class="w-24 h-24 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h3 class="text-xl font-bold text-gray-400 mb-2">Nessun canale selezionato</h3>
                <p class="text-gray-500 text-sm">Seleziona un canale dalla lista per iniziare la riproduzione</p>
            </div>
        </div>

        <!-- Channel Info Bar -->
        <div v-if="channel && !playerError"
            class="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 pointer-events-none">
                    <img v-if="channel.logo" :src="channel.logo" :alt="channel.name"
                        class="w-10 h-10 rounded object-contain bg-gray-800" />
                    <div>
                        <h2 class="text-white font-bold">{{ channel.name }}</h2>
                        <div class="flex items-center gap-2">
                            <p class="text-gray-400 text-sm">{{ channel.group }}</p>
                            <span v-if="currentAdapterType && !isBuffering"
                                class="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                                {{ currentAdapterType.toUpperCase() }}
                            </span>
                        </div>
                    </div>
                </div>
                <button @click="$emit('close')"
                    class="pointer-events-auto p-2 bg-gray-900/80 hover:bg-red-600 text-white rounded-lg transition-colors"
                    title="Chiudi riproduzione">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { StreamHandler } from '@/utils/streamHandler'
import { useUiStore } from '@/stores/ui'
import { useIptvStore } from '@/stores/iptv'

const props = defineProps({
    channel: {
        type: Object,
        default: null
    }
})

const uiStore = useUiStore()
const iptvStore = useIptvStore()

const videoRef = ref(null)
const isBuffering = ref(false)
const playerError = ref(null)
const currentAdapterType = ref(null)

// Istanza StreamHandler
let streamHandler = null

/**
 * Inizializza o aggiorna lo StreamHandler con la configurazione corrente
 */
function initStreamHandler() {
    if (streamHandler) {
        streamHandler.updateConfig(uiStore.streamConfig)
    } else {
        streamHandler = new StreamHandler(uiStore.streamConfig)

        // Registra event handlers
        streamHandler.on('loading', () => {
            isBuffering.value = true
            playerError.value = null
            currentAdapterType.value = null
        })

        streamHandler.on('buffering', ({ type }) => {
            isBuffering.value = true
            currentAdapterType.value = type || null
        })

        streamHandler.on('ready', ({ type }) => {
            isBuffering.value = false
            currentAdapterType.value = type
            console.log(`[VideoPlayer] Stream ready with adapter: ${type}`)
        })

        streamHandler.on('success', ({ type, url }) => {
            isBuffering.value = false
            currentAdapterType.value = type
            // Salva nella cache del store
            iptvStore.cacheStreamType(url, type)
            console.log(`[VideoPlayer] Stream success: ${type}`)
        })

        streamHandler.on('adapterError', ({ type, message }) => {
            console.warn(`[VideoPlayer] Adapter ${type} error: ${message}`)
            // Non mostrare errore qui, lascia che il fallback provi altri adapter
        })

        streamHandler.on('error', ({ message }) => {
            isBuffering.value = false
            playerError.value = message
            console.error(`[VideoPlayer] Stream error: ${message}`)
        })
    }
}

/**
 * Carica lo stream per il canale corrente
 */
async function loadStream(url) {
    if (!url || !videoRef.value) return

    console.log('='.repeat(60))
    console.log('🎬 Loading stream via StreamHandler')
    console.log('URL:', url)
    console.log('Channel:', props.channel?.name || 'Unknown')
    console.log('Config:', uiStore.streamConfig)
    console.log('='.repeat(60))

    // Assicurati che StreamHandler sia inizializzato
    initStreamHandler()

    // Controlla se abbiamo un tipo cached per questo URL
    const cachedType = iptvStore.getCachedStreamType(url)
    if (cachedType) {
        console.log(`[VideoPlayer] Found cached stream type: ${cachedType}`)
        // Metti il tipo cached in cima alla fallback chain
        const config = { ...uiStore.streamConfig }
        const filteredOrder = config.fallbackOrder.filter(t => t !== cachedType)
        config.fallbackOrder = [cachedType, ...filteredOrder]
        streamHandler.updateConfig(config)
    }

    // Avvia il caricamento
    await streamHandler.attach(videoRef.value, url)
}

/**
 * Riprova con lo stream corrente
 */
async function retry() {
    if (props.channel?.url) {
        await loadStream(props.channel.url)
    }
}

/**
 * Riprova forzando un nuovo rilevamento (ignora cache)
 */
async function retryFresh() {
    if (props.channel?.url) {
        // Rimuovi dalla cache per forzare nuova detection
        iptvStore.removeCachedStreamType(props.channel.url)
        if (streamHandler) {
            streamHandler.removeFromCache(props.channel.url)
        }
        await loadStream(props.channel.url)
    }
}

/**
 * Pulisce lo stream corrente
 */
async function destroyStream() {
    if (streamHandler) {
        await streamHandler.destroy()
    }
    currentAdapterType.value = null
    if (videoRef.value) {
        videoRef.value.removeAttribute('src')
        videoRef.value.load()
    }
}

// Watch per cambi canale
watch(() => props.channel, async (newChannel) => {
    if (newChannel?.url) {
        await loadStream(newChannel.url)
    } else {
        await destroyStream()
    }
}, { immediate: true })

// Watch per cambi configurazione stream
watch(() => uiStore.streamConfig, (newConfig) => {
    if (streamHandler) {
        streamHandler.updateConfig(newConfig)
    }
}, { deep: true })

onMounted(() => {
    if (props.channel?.url) {
        loadStream(props.channel.url)
    }
})

onUnmounted(async () => {
    await destroyStream()
    streamHandler = null
})
</script>
