<template>
  <div class="relative w-full h-full bg-black flex items-center justify-center">
    <!-- Video Element -->
    <video
      ref="videoRef"
      class="w-full h-full"
      controls
      autoplay
      playsinline
      crossorigin="use-credentials"
    />

    <!-- Loading Overlay -->
    <div
      v-if="isBuffering"
      class="absolute inset-0 flex items-center justify-center bg-black/50"
    >
      <div class="flex flex-col items-center gap-3">
        <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-white text-sm">Caricamento stream...</span>
      </div>
    </div>

    <!-- Error Overlay -->
    <div
      v-if="playerError"
      class="absolute inset-0 flex items-center justify-center bg-black/80"
    >
      <div class="text-center p-6 max-w-md">
        <svg class="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="text-xl font-bold text-white mb-2">Errore di riproduzione</h3>
        <p class="text-gray-400 text-sm mb-4">{{ playerError }}</p>
        <button
          @click="retry"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Riprova
        </button>
      </div>
    </div>

    <!-- No Channel Selected -->
    <div
      v-if="!channel"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-center p-6">
        <svg class="w-24 h-24 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <h3 class="text-xl font-bold text-gray-400 mb-2">Nessun canale selezionato</h3>
        <p class="text-gray-500 text-sm">Seleziona un canale dalla lista per iniziare la riproduzione</p>
      </div>
    </div>

    <!-- Channel Info Bar -->
    <div
      v-if="channel && !playerError"
      class="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none"
    >
      <div class="flex items-center gap-3">
        <img
          v-if="channel.logo"
          :src="channel.logo"
          :alt="channel.name"
          class="w-10 h-10 rounded object-contain bg-gray-800"
        />
        <div>
          <h2 class="text-white font-bold">{{ channel.name }}</h2>
          <p class="text-gray-400 text-sm">{{ channel.group }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Hls from 'hls.js'
import mpegts from 'mpegts.js'

const props = defineProps({
  channel: {
    type: Object,
    default: null
  }
})

const videoRef = ref(null)
const isBuffering = ref(false)
const playerError = ref(null)

let hls = null
let mpegtsPlayer = null

function destroyHls() {
  if (hls) {
    hls.destroy()
    hls = null
  }
}

function destroyMpegts() {
  if (mpegtsPlayer) {
    mpegtsPlayer.pause()
    mpegtsPlayer.unload()
    mpegtsPlayer.detachMediaElement()
    mpegtsPlayer.destroy()
    mpegtsPlayer = null
  }
}

function destroyAllPlayers() {
  destroyHls()
  destroyMpegts()
}

/**
 * Determina se l'URL è probabilmente uno stream HLS/live
 * La maggior parte degli stream IPTV sono HLS anche senza estensione .m3u8
 */
function isLikelyHlsStream(url) {
  // URL con estensione esplicita HLS
  if (url.includes('.m3u8') || url.includes('.m3u')) {
    return true
  }
  
  // URL con estensione video standard (mp4, mkv, avi, etc.) - prova prima nativo
  const videoExtensions = /\.(mp4|mkv|avi|mov|wmv|flv|webm)(\?|$)/i
  if (videoExtensions.test(url)) {
    return false
  }
  
  // Per tutti gli altri URL (inclusi stream live senza estensione), prova HLS
  return true
}

function loadStream(url) {
  if (!url || !videoRef.value) return

  console.log('='.repeat(60))
  console.log('🎬 Attempting to load stream:')
  console.log('URL:', url)
  console.log('Channel:', props.channel?.name || 'Unknown')
  console.log('='.repeat(60))

  playerError.value = null
  isBuffering.value = true
  destroyAllPlayers()

  const video = videoRef.value
  
  // Rimuovi listener precedenti e src precedente
  video.removeAttribute('src')
  video.load()

  // IMPORTANTE: Pre-fetch per inizializzare sessione/cookie sul server IPTV
  console.log('→ Pre-fetching URL to establish session/cookies...')
  fetch(url, {
    method: 'HEAD', // HEAD invece di GET per non scaricare lo stream
    mode: 'cors',
    credentials: 'include', // Includi cookies cross-origin
    cache: 'no-cache'
  })
  .then(response => {
    console.log('✓ Pre-fetch completed:', {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type'),
        'set-cookie': response.headers.get('set-cookie')
      }
    })
    // Ora procedi con il caricamento normale
    attemptPlayback(url, video)
  })
  .catch(err => {
    console.warn('⚠ Pre-fetch failed, trying playback anyway:', err)
    // Anche se fallisce, prova lo stesso
    attemptPlayback(url, video)
  })
}

function attemptPlayback(url, video) {
  const useHls = isLikelyHlsStream(url)
  console.log('Strategy: Try HLS first?', useHls)

  // 1. Prova prima HLS.js (la maggior parte degli stream IPTV)
  if (useHls && Hls.isSupported()) {
    console.log('✓ HLS.js is supported, attempting HLS playback...')
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      // Configurazione ottimizzata per live streaming
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 10,
      liveDurationInfinity: true,
      // Riprova in caso di errori di rete
      manifestLoadingMaxRetry: 4,
      manifestLoadingRetryDelay: 1000,
      levelLoadingMaxRetry: 4,
      levelLoadingRetryDelay: 1000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1000,
      // Abilita credentials per gestire cookies
      xhrSetup: function(xhr, url) {
        xhr.withCredentials = true
      }
    })

    hls.loadSource(url)
    hls.attachMedia(video)

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      isBuffering.value = false
      video.play().catch(() => {
        // Autoplay blocked, user needs to click
      })
    })

    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error('❌ HLS Error:', {
        type: data.type,
        details: data.details,
        fatal: data.fatal,
        url: data.url || url,
        reason: data.reason
      })
      
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Se è errore di parsing manifest o manifest load error, non è HLS -> prova MPEGTS
            if (data.details === 'manifestParsingError' || 
                data.details === 'manifestLoadError' ||
                data.details.includes('manifest')) {
              console.log('→ Not an HLS stream, trying MPEGTS...')
              destroyHls()
              loadMpegtsStream(url)
              return
            }
            // Altri errori di rete, prova comunque MPEGTS
            console.log('→ HLS network error, trying MPEGTS fallback...')
            destroyHls()
            loadMpegtsStream(url)
            return
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('→ Attempting to recover from media error...')
            hls.recoverMediaError()
            return
          default:
            playerError.value = 'Impossibile riprodurre lo stream.'
            destroyHls()
        }
        isBuffering.value = false
      }
    })
    
    // Gestisci errore video element
    video.onerror = () => {
      if (hls) {
        playerError.value = 'Errore nel caricamento del video.'
        isBuffering.value = false
      }
    }
    
  } else if (video.canPlayType('application/vnd.apple.mpegurl') && useHls) {
    // Native HLS support (Safari)
    loadNativeVideo(url)
  } else {
    // Direct video URL (MP4, etc.) o fallback
    loadNativeVideo(url)
  }
}

/**
 * Carica stream MPEGTS con mpegts.js
 * Per stream TS/FLV live diretti (tipici IPTV)
 */
function loadMpegtsStream(url) {
  const video = videoRef.value
  if (!video) return

  if (!mpegts.isSupported()) {
    console.warn('MPEGTS not supported, trying native video...')
    loadNativeVideo(url)
    return
  }

  // Prova prima come MPEGTS, poi come FLV se fallisce
  tryMpegtsType(url, 'mpegts')
}

function tryMpegtsType(url, streamType) {
  const video = videoRef.value
  if (!video) return
  
  console.log(`→ Trying to load as ${streamType.toUpperCase()} stream...`)
  console.log('   URL:', url)

  try {
    mpegtsPlayer = mpegts.createPlayer({
      type: streamType,  // 'mpegts' o 'flv'
      isLive: true,
      url: url,
      // Alcuni server IPTV richiedono questi header
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, {
      enableWorker: true,
      enableStashBuffer: true,
      stashInitialSize: 384,  // KB - aumentato
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 60,
      autoCleanupMinBackwardDuration: 30,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: 5,
      liveBufferLatencyMinRemain: 1,
      lazyLoad: false,
      lazyLoadMaxDuration: 0,
      deferLoadAfterSourceOpen: false,
    })

    mpegtsPlayer.attachMediaElement(video)
    
    // Event handlers
    mpegtsPlayer.on(mpegts.Events.ERROR, (errType, errDetail) => {
      console.error(`${streamType.toUpperCase()} Error:`, errType, errDetail)
      
      if (errType === mpegts.ErrorTypes.NETWORK_ERROR) {
        // Se è MPEGTS che fallisce, prova FLV
        if (streamType === 'mpegts') {
          console.log('MPEGTS failed, trying FLV...')
          destroyMpegts()
          tryMpegtsType(url, 'flv')
          return
        }
        // Se anche FLV fallisce, prova native
        console.log('FLV failed, trying native video...')
        destroyMpegts()
        loadNativeVideo(url)
      } else {
        playerError.value = `Errore stream ${streamType}: ${errDetail || errType}`
        isBuffering.value = false
      }
    })

    mpegtsPlayer.on(mpegts.Events.LOADING_COMPLETE, () => {
      console.log(`${streamType.toUpperCase()} loading complete`)
      isBuffering.value = false
    })

    mpegtsPlayer.on(mpegts.Events.METADATA_ARRIVED, (metadata) => {
      console.log(`${streamType.toUpperCase()} metadata arrived:`, metadata)
      isBuffering.value = false
    })
    
    mpegtsPlayer.on(mpegts.Events.MEDIA_INFO, (mediaInfo) => {
      console.log(`${streamType.toUpperCase()} media info:`, mediaInfo)
    })
    
    mpegtsPlayer.on(mpegts.Events.STATISTICS_INFO, (stats) => {
      // Log periodico delle statistiche (commentato per non spammare)
      // console.log('Stats:', stats)
    })

    // Inizia il caricamento
    mpegtsPlayer.load()
    
    // Timeout per rilevare se non riceve dati
    const loadTimeout = setTimeout(() => {
      if (isBuffering.value && mpegtsPlayer) {
        console.warn(`${streamType.toUpperCase()} timeout - no data received`)
        destroyMpegts()
        
        // Se era MPEGTS, prova FLV
        if (streamType === 'mpegts') {
          tryMpegtsType(url, 'flv')
        } else {
          // Altrimenti prova native
          loadNativeVideo(url)
        }
      }
    }, 8000) // 8 secondi di timeout
    
    // Quando il video è pronto, fai play e cancella timeout
    video.addEventListener('loadeddata', () => {
      clearTimeout(loadTimeout)
      console.log(`${streamType.toUpperCase()} video ready, attempting play...`)
      isBuffering.value = false
      video.play().catch((err) => {
        console.warn('Autoplay blocked:', err)
      })
    }, { once: true })

  } catch (err) {
    console.error(`Failed to create ${streamType.toUpperCase()} player:`, err)
    
    // Se MPEGTS fallisce, prova FLV
    if (streamType === 'mpegts') {
      tryMpegtsType(url, 'flv')
    } else {
      loadNativeVideo(url)
    }
  }
}

function loadNativeVideo(url) {
  const video = videoRef.value
  if (!video) return
  
  console.log('→ Trying native HTML5 video playback...')
  video.src = url
  
  const onLoadedData = () => {
    console.log('✓ Native video loaded successfully')
    isBuffering.value = false
    video.play().catch((err) => {
      console.warn('Autoplay blocked by browser:', err)
    })
  }
  
  const onError = (e) => {
    const errorDetails = video.error ? {
      code: video.error.code,
      message: video.error.message,
      MEDIA_ERR_ABORTED: video.error.code === 1,
      MEDIA_ERR_NETWORK: video.error.code === 2,
      MEDIA_ERR_DECODE: video.error.code === 3,
      MEDIA_ERR_SRC_NOT_SUPPORTED: video.error.code === 4
    } : 'Unknown error'
    
    console.error('❌ Native video error:', errorDetails)
    console.error('Stream URL:', url)
    
    let errorMsg = 'Impossibile caricare il video.'
    if (video.error?.code === 2) {
      errorMsg += ' Errore di rete o CORS.'
    } else if (video.error?.code === 4) {
      errorMsg += ' Formato non supportato.'
    } else if (video.error?.code === 3) {
      errorMsg += ' Errore di decodifica.'
    }
    
    playerError.value = errorMsg
    isBuffering.value = false
    video.removeEventListener('loadeddata', onLoadedData)
    video.removeEventListener('canplay', onLoadedData)
  }
  
  video.addEventListener('loadeddata', onLoadedData, { once: true })
  video.addEventListener('canplay', onLoadedData, { once: true })
  video.addEventListener('error', onError, { once: true })
  
  video.load()
}

function retry() {
  if (props.channel?.url) {
    loadStream(props.channel.url)
  }
}

// Watch for channel changes
watch(() => props.channel, (newChannel) => {
  if (newChannel?.url) {
    loadStream(newChannel.url)
  } else {
    destroyAllPlayers()
    if (videoRef.value) {
      videoRef.value.src = ''
    }
  }
}, { immediate: true })

onMounted(() => {
  if (props.channel?.url) {
    loadStream(props.channel.url)
  }
})

onUnmounted(() => {
  destroyAllPlayers()
})
</script>
