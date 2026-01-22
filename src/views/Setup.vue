<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useIptvStore } from '@/stores/iptv'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const router = useRouter()
const route = useRoute()
const iptvStore = useIptvStore()

const playlistName = ref('')
const playlistUrl = ref('')
const username = ref('')
const password = ref('')
const useType = ref(false)
const type = ref('m3u_plus')
const useOutput = ref(false)
const output = ref('mpegts')
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

            // Carica type e output se presenti
            if (playlist.type) {
                useType.value = true
                type.value = playlist.type
            }
            if (playlist.output) {
                useOutput.value = true
                output.value = playlist.output
            }
        }
    }
})

// Funzione per estrarre parametri dall'URL
function parseUrlParams(url) {
    try {
        const urlObj = new URL(url)
        const params = urlObj.searchParams

        const user = params.get('username')
        const pass = params.get('password')
        const typeParam = params.get('type')
        const outputParam = params.get('output')

        return {
            username: user || '',
            password: pass || '',
            type: typeParam || '',
            output: outputParam || ''
        }
    } catch {
        return { username: '', password: '', type: '', output: '' }
    }
}

// Watch per auto-popolare parametri dall'URL
watch(playlistUrl, (newUrl) => {
    if (newUrl && !isEditing.value) {
        const { username: user, password: pass, type: typeParam, output: outputParam } = parseUrlParams(newUrl)
        if (user) username.value = user
        if (pass) password.value = pass
        if (typeParam) {
            useType.value = true
            type.value = typeParam
        }
        if (outputParam) {
            useOutput.value = true
            output.value = outputParam
        }
    }
})

async function handleSave() {
    if (!playlistUrl.value.trim()) {
        error.value = t('setup.errorInvalidUrl')
        return
    }

    if (!playlistName.value.trim()) {
        error.value = t('setup.errorInvalidName')
        return
    }

    isLoading.value = true
    error.value = null

    try {
        // Pulisci l'URL rimuovendo i parametri per salvare solo la base
        let cleanUrl = playlistUrl.value.trim()
        try {
            const urlObj = new URL(cleanUrl)
            // Rimuovi tutti i parametri per ottenere solo la base
            cleanUrl = `${urlObj.origin}${urlObj.pathname}`
        } catch {
            // Se non è un URL valido, usa quello originale
        }

        // PRIMA testa il caricamento della playlist
        const testResult = await iptvStore.testPlaylistUrl(
            cleanUrl,
            username.value.trim(),
            password.value.trim(),
            useType.value ? type.value : '',
            useOutput.value ? output.value : ''
        )

        if (!testResult.success) {
            error.value = testResult.error || iptvStore.error || 'Impossibile caricare la playlist'
            return
        }

        // Solo se il test ha successo, salva la playlist
        let playlistId

        if (isEditing.value) {
            // Modifica playlist esistente
            iptvStore.updatePlaylist(editingId.value, {
                name: playlistName.value.trim(),
                url: cleanUrl,
                username: username.value.trim(),
                password: password.value.trim(),
                type: useType.value ? type.value : '',
                output: useOutput.value ? output.value : '',
            })
            playlistId = editingId.value
        } else {
            // Aggiungi nuova playlist
            playlistId = iptvStore.addPlaylist(
                playlistName.value.trim(),
                cleanUrl,
                username.value.trim(),
                password.value.trim(),
                useType.value ? type.value : '',
                useOutput.value ? output.value : ''
            )
        }

        // Carica la playlist (questa volta sappiamo che funzionerà)
        const success = await iptvStore.loadPlaylist(playlistId)

        if (success) {
            // Reindirizza alla home
            router.push('/')
        } else {
            // Se fallisce dopo averla salvata (caso raro), elimina la playlist appena aggiunta
            if (!isEditing.value) {
                iptvStore.deletePlaylist(playlistId)
            }
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
    <div class="w-full h-full flex items-center justify-center bg-gray-950 overflow-y-auto">
        <div class="w-full max-w-md p-3 sm:p-6 md:p-8 my-4">
            <!-- Logo/Header -->
            <div class="text-center mb-6 sm:mb-8 px-1">
                <h1 class="text-xl sm:text-4xl font-bold text-blue-400 mb-1 break-words leading-tight">{{ t('app.name')
                    }}</h1>
                <p class="text-xs sm:text-base text-gray-400 break-words leading-snug">
                    {{ isEditing ? t('setup.editTitle') : t('setup.title') }}
                </p>
            </div>

            <!-- Form -->
            <div class="bg-gray-900 rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 border border-gray-800">
                <form @submit.prevent="handleSave" class="space-y-4 sm:space-y-6">
                    <!-- Nome Playlist -->
                    <div>
                        <label for="playlist-name" class="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                            {{ t('setup.playlistName') }}
                        </label>
                        <input id="playlist-name" v-model="playlistName" type="text" required
                            :placeholder="t('setup.playlistNamePlaceholder')"
                            class="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all" />
                    </div>

                    <!-- URL Playlist -->
                    <div>
                        <label for="playlist-url" class="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                            {{ t('setup.playlistUrl') }}
                        </label>
                        <input id="playlist-url" v-model="playlistUrl" type="url" required
                            :placeholder="t('setup.playlistUrlPlaceholder')"
                            class="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all" />
                    </div>

                    <!-- Username -->
                    <div>
                        <label for="username" class="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                            {{ t('setup.username') }} <span class="text-gray-500 text-xs">({{ t('common.optional')
                                }})</span>
                        </label>
                        <input id="username" v-model="username" type="text"
                            :placeholder="t('setup.usernamePlaceholder')"
                            class="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all" />
                    </div>

                    <!-- Password -->
                    <div>
                        <label for="password" class="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
                            {{ t('setup.password') }} <span class="text-gray-500 text-xs">({{ t('common.optional')
                                }})</span>
                        </label>
                        <input id="password" v-model="password" type="password"
                            :placeholder="t('setup.passwordPlaceholder')"
                            class="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all" />
                    </div>

                    <!-- Type Parameter -->
                    <div>
                        <label class="flex items-center gap-2 sm:gap-3 cursor-pointer">
                            <input v-model="useType" type="checkbox"
                                class="w-4 h-4 sm:w-5 sm:h-5 bg-gray-800 border-gray-700 rounded text-blue-600 focus:ring-2 focus:ring-blue-500" />
                            <span class="text-xs sm:text-sm font-medium text-gray-300">{{ t('setup.addTypeParam')
                                }}</span>
                        </label>
                        <input v-if="useType" v-model="type" type="text" :placeholder="t('setup.typePlaceholder')"
                            class="mt-2 w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all" />
                    </div>

                    <!-- Output Parameter -->
                    <div>
                        <label class="flex items-center gap-2 sm:gap-3 cursor-pointer">
                            <input v-model="useOutput" type="checkbox"
                                class="w-4 h-4 sm:w-5 sm:h-5 bg-gray-800 border-gray-700 rounded text-blue-600 focus:ring-2 focus:ring-blue-500" />
                            <span class="text-xs sm:text-sm font-medium text-gray-300">{{ t('setup.addOutputParam')
                                }}</span>
                        </label>
                        <input v-if="useOutput" v-model="output" type="text" :placeholder="t('setup.outputPlaceholder')"
                            class="mt-2 w-full px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all" />
                    </div>

                    <!-- Error message -->
                    <div v-if="error" class="p-4 bg-red-900/30 border border-red-700 rounded-lg">
                        <p class="text-sm text-red-400 flex items-center gap-2">
                            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {{ error }}
                        </p>
                    </div>

                    <!-- Submit Button -->
                    <button type="submit" :disabled="isLoading"
                        class="w-full px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm sm:text-base font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:shadow-none">
                        <span v-if="isLoading" class="flex items-center justify-center gap-2">
                            <svg class="animate-spin h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                    stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                                </path>
                            </svg>
                            {{ t('common.loading') }}
                        </span>
                        <span v-else>{{ isEditing ? t('common.saveChanges') : t('common.save') }}</span>
                    </button>

                    <!-- Cancel Button -->
                    <button type="button" @click="handleCancel"
                        class="w-full px-4 sm:px-6 py-2 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm sm:text-base font-semibold rounded-lg transition-all">
                        {{ t('common.cancel') }}
                    </button>
                </form>

                <!-- Info -->
                <div class="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400 leading-relaxed">
                        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {{ t('setup.infoMessage') }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Aggiungi animazioni personalizzate se necessario */
</style>
