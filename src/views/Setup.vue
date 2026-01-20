<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useIptvStore } from '@/stores/iptv'

const router = useRouter()
const route = useRoute()
const iptvStore = useIptvStore()

const playlistName = ref('')
const playlistUrl = ref('')
const username = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref(null)

// Verifica se stiamo modificando una playlist esistente
const editingId = computed(() => route.params.id)
const isEditing = computed(() => !!editingId.value)

// Carica i dati della playlist se in modalità editing
onMounted(() => {
  if (isEditing.value) {
    const playlist = iptvStore.playlists.find(p => p.id === editingId.value)
    if (playlist) {
      playlistName.value = playlist.name
      playlistUrl.value = playlist.url
      username.value = playlist.username || ''
      password.value = playlist.password || ''
    }
  }
})

// Funzione per estrarre username e password dall'URL
function parseUrlParams(url) {
  try {
    const urlObj = new URL(url)
    const params = urlObj.searchParams
    
    const user = params.get('username')
    const pass = params.get('password')
    
    return { username: user || '', password: pass || '' }
  } catch {
    return { username: '', password: '' }
  }
}

// Watch per auto-popolare username e password dall'URL
watch(playlistUrl, (newUrl) => {
  if (newUrl && !isEditing.value) {
    const { username: user, password: pass } = parseUrlParams(newUrl)
    if (user) username.value = user
    if (pass) password.value = pass
  }
})

async function handleSave() {
  if (!playlistUrl.value.trim()) {
    error.value = 'Inserisci un URL valido'
    return
  }

  if (!playlistName.value.trim()) {
    error.value = 'Inserisci un nome per la playlist'
    return
  }

  isLoading.value = true
  error.value = null

  try {
    let playlistId

    if (isEditing.value) {
      // Modifica playlist esistente
      iptvStore.updatePlaylist(editingId.value, {
        name: playlistName.value.trim(),
        url: playlistUrl.value.trim(),
        username: username.value.trim(),
        password: password.value.trim(),
      })
      playlistId = editingId.value
    } else {
      // Aggiungi nuova playlist
      playlistId = iptvStore.addPlaylist(
        playlistName.value.trim(),
        playlistUrl.value.trim(),
        username.value.trim(),
        password.value.trim()
      )
    }

    // Carica la playlist
    const success = await iptvStore.loadPlaylist(playlistId)
    
    if (success) {
      // Reindirizza alla home
      router.push('/')
    } else {
      error.value = iptvStore.error
    }
  } catch (err) {
    error.value = err.message || 'Errore nel caricamento della playlist'
  } finally {
    isLoading.value = false
  }
}

function handleCancel() {
  router.push('/settings')
}
</script>

<template>
  <div class="h-screen w-screen flex items-center justify-center bg-gray-950">
    <div class="w-full max-w-md p-8">
      <!-- Logo/Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-blue-400 mb-2">ClaudeTV</h1>
        <p class="text-gray-400">{{ isEditing ? 'Modifica playlist' : 'Aggiungi nuova playlist' }}</p>
      </div>

      <!-- Form -->
      <div class="bg-gray-900 rounded-xl shadow-2xl p-8 border border-gray-800">
        <form @submit.prevent="handleSave" class="space-y-6">
          <!-- Nome Playlist -->
          <div>
            <label for="playlist-name" class="block text-sm font-medium text-gray-300 mb-2">
              Nome Playlist
            </label>
            <input
              id="playlist-name"
              v-model="playlistName"
              type="text"
              required
              placeholder="La mia playlist IPTV"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <!-- URL Playlist -->
          <div>
            <label for="playlist-url" class="block text-sm font-medium text-gray-300 mb-2">
              URL Playlist M3U
            </label>
            <input
              id="playlist-url"
              v-model="playlistUrl"
              type="url"
              required
              placeholder="http://example.com/playlist.m3u"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <!-- Username -->
          <div>
            <label for="username" class="block text-sm font-medium text-gray-300 mb-2">
              Username <span class="text-gray-500 text-xs">(opzionale)</span>
            </label>
            <input
              id="username"
              v-model="username"
              type="text"
              placeholder="Username"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <!-- Password -->
          <div>
            <label for="password" class="block text-sm font-medium text-gray-300 mb-2">
              Password <span class="text-gray-500 text-xs">(opzionale)</span>
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="Password"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <!-- Error message -->
          <div v-if="error" class="p-4 bg-red-900/30 border border-red-700 rounded-lg">
            <p class="text-sm text-red-400 flex items-center gap-2">
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ error }}
            </p>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:shadow-none"
          >
            <span v-if="isLoading" class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Caricamento...
            </span>
            <span v-else>{{ isEditing ? 'Salva Modifiche' : 'Salva e Continua' }}</span>
          </button>

          <!-- Cancel Button -->
          <button
            type="button"
            @click="handleCancel"
            class="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all"
          >
            Annulla
          </button>
        </form>

        <!-- Info -->
        <div class="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <p class="text-xs text-gray-400 leading-relaxed">
            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Se l'URL contiene parametri username e password, verranno rilevati automaticamente.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Aggiungi animazioni personalizzate se necessario */
</style>
