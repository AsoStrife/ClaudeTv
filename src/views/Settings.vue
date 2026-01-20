<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useIptvStore } from '@/stores/iptv'

const router = useRouter()
const iptvStore = useIptvStore()

const playlists = computed(() => iptvStore.playlists)
const activePlaylistId = computed(() => iptvStore.activePlaylistId)

function addNewPlaylist() {
  router.push('/setup')
}

function editPlaylist(id) {
  router.push(`/setup/${id}`)
}

function deletePlaylist(id) {
  const playlist = playlists.value.find(p => p.id === id)
  if (playlist && confirm(`Sei sicuro di voler eliminare "${playlist.name}"?`)) {
    iptvStore.deletePlaylist(id)
  }
}

async function activatePlaylist(id) {
  iptvStore.setActivePlaylist(id)
  const success = await iptvStore.loadPlaylist(id)
  if (success) {
    router.push('/')
  }
}

function goBack() {
  router.push('/')
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('it-IT', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="h-screen w-screen flex items-start justify-center bg-gray-950 overflow-y-auto">
    <div class="w-full max-w-4xl p-8">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-3xl font-bold text-blue-400 mb-2">Impostazioni</h1>
            <p class="text-gray-400">Gestisci le tue playlist IPTV</p>
          </div>
          <button
            @click="goBack"
            class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Torna Indietro
          </button>
        </div>

        <!-- Add Button -->
        <button
          @click="addNewPlaylist"
          class="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi Nuova Playlist
        </button>
      </div>

      <!-- Playlist List -->
      <div v-if="playlists.length > 0" class="space-y-4">
        <div
          v-for="playlist in playlists"
          :key="playlist.id"
          class="bg-gray-900 rounded-xl p-6 border-2 transition-all hover:border-gray-700"
          :class="playlist.id === activePlaylistId ? 'border-blue-500' : 'border-gray-800'"
        >
          <div class="flex items-start justify-between">
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-xl font-semibold text-white truncate">{{ playlist.name }}</h3>
                <span
                  v-if="playlist.id === activePlaylistId"
                  class="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full"
                >
                  Attiva
                </span>
              </div>
              <p class="text-sm text-gray-400 truncate mb-3">{{ playlist.url }}</p>
              <div class="flex items-center gap-4 text-xs text-gray-500">
                <span v-if="playlist.username" class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {{ playlist.username }}
                </span>
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ formatDate(playlist.createdAt) }}
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 ml-4">
              <button
                v-if="playlist.id !== activePlaylistId"
                @click="activatePlaylist(playlist.id)"
                class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                title="Attiva questa playlist"
              >
                Attiva
              </button>
              <button
                @click="editPlaylist(playlist.id)"
                class="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
                title="Modifica"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                @click="deletePlaylist(playlist.id)"
                class="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                title="Elimina"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
        <svg class="w-20 h-20 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h3 class="text-xl font-semibold text-gray-400 mb-2">Nessuna playlist configurata</h3>
        <p class="text-gray-500">Aggiungi la tua prima playlist per iniziare</p>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
