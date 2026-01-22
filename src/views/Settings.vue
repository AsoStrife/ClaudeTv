<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useIptvStore } from '@/stores/iptv'
import { useUiStore } from '@/stores/ui'
import { StreamType } from '@/utils/streamHandler'
import { useI18n } from 'vue-i18n'
import VpnSettings from '@/components/VpnSettings.vue'

const { t } = useI18n()
const { locale } = useI18n()

const router = useRouter()
const iptvStore = useIptvStore()
const uiStore = useUiStore()

const playlists = computed(() => iptvStore.playlists)
const activePlaylistId = computed(() => iptvStore.activePlaylistId)

// Language settings
const selectedLanguage = computed({
    get: () => uiStore.selectedLanguage,
    set: (val) => {
        uiStore.setLanguage(val)
        // Aggiorna anche la locale di i18n
        if (val === 'auto') {
            // Rileva la lingua del sistema
            const systemLocale = navigator.language || navigator.userLanguage
            const localeCode = systemLocale.split('-')[0]
            locale.value = ['it', 'en'].includes(localeCode) ? localeCode : 'en'
        } else {
            locale.value = val
        }
    }
})

// Stream settings
const streamTimeout = computed({
    get: () => uiStore.streamTimeout / 1000,
    set: (val) => uiStore.setStreamTimeout(val * 1000)
})
const streamRetryAttempts = computed({
    get: () => uiStore.streamRetryAttempts,
    set: (val) => uiStore.setStreamRetryAttempts(val)
})
const streamEnableFallback = computed({
    get: () => uiStore.streamEnableFallback,
    set: (val) => uiStore.setStreamEnableFallback(val)
})
const streamEnableContentTypeSniffing = computed({
    get: () => uiStore.streamEnableContentTypeSniffing,
    set: (val) => uiStore.setStreamEnableContentTypeSniffing(val)
})

// Cache stats
const cacheStats = computed(() => iptvStore.getStreamCacheStats())

// Tabs
const activeTab = ref('playlists')
const confirmDialog = ref({
    show: false,
    title: '',
    message: '',
    onConfirm: null
})

function addNewPlaylist() {
    router.push('/setup')
}

function showConfirmDialog(title, message, onConfirm) {
    confirmDialog.value = {
        show: true,
        title,
        message,
        onConfirm
    }
}

function closeConfirmDialog() {
    confirmDialog.value.show = false
}

function handleConfirm() {
    if (confirmDialog.value.onConfirm) {
        confirmDialog.value.onConfirm()
    }
    closeConfirmDialog()
}

function editPlaylist(id) {
    router.push(`/setup/${id}`)
}

function deletePlaylist(id) {
    const playlist = playlists.value.find(p => p.id === id)
    if (playlist) {
        showConfirmDialog(
            t('settings.playlists.deleteTitle'),
            t('settings.playlists.deleteMessage', { name: playlist.name }),
            () => iptvStore.deletePlaylist(id)
        )
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

function resetStreamSettings() {
    showConfirmDialog(
        t('settings.streaming.resetTitle'),
        t('settings.streaming.resetMessage'),
        () => uiStore.resetStreamSettings()
    )
}

function clearStreamCache() {
    showConfirmDialog(
        t('settings.streaming.clearCacheTitle'),
        t('settings.streaming.clearCacheMessage'),
        () => iptvStore.clearStreamTypeCache()
    )
}
</script>

<template>
    <div class="w-full h-full flex items-start justify-center bg-gray-950 overflow-y-auto">
        <div class="w-full max-w-4xl p-4 sm:p-6 md:p-8">
            <!-- Header -->
            <div class="mb-4 sm:mb-6 md:mb-8">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div class="flex-1 min-w-0">
                        <h1 class="text-2xl sm:text-3xl font-bold text-blue-400 mb-2">{{ t('settings.title') }}</h1>
                        <p class="text-sm sm:text-base text-gray-400">{{ t('settings.description') }}</p>
                    </div>
                    <button @click="goBack"
                        class="px-3 sm:px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm sm:text-base whitespace-nowrap">
                        <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span class="hidden sm:inline">{{ t('common.back') }}</span>
                        <span class="sm:hidden">{{ t('common.backShort') }}</span>
                    </button>
                </div>

                <!-- Tabs -->
                <div class="flex gap-2 mb-4 sm:mb-6 overflow-x-auto">
                    <button @click="activeTab = 'playlists'" :class="[
                        'px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap',
                        activeTab === 'playlists'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    ]">
                        {{ t('settings.tabs.playlists') }}
                    </button>
                    <button @click="activeTab = 'vpn'" :class="[
                        'px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap',
                        activeTab === 'vpn'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    ]">
                        {{ t('settings.tabs.vpn') }}
                    </button>
                    <button @click="activeTab = 'streaming'" :class="[
                        'px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap',
                        activeTab === 'streaming'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    ]">
                        {{ t('settings.tabs.streaming') }}
                    </button>
                    <button @click="activeTab = 'language'" :class="[
                        'px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base whitespace-nowrap',
                        activeTab === 'language'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    ]">
                        {{ t('settings.tabs.language') }}
                    </button>
                </div>
            </div>

            <!-- Playlist Tab -->
            <div v-if="activeTab === 'playlists'">
                <!-- Add Button -->
                <button @click="addNewPlaylist"
                    class="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mb-6">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    {{ t('settings.playlists.addNew') }}
                </button>

                <!-- Playlist List -->
                <div v-if="playlists.length > 0" class="space-y-3 sm:space-y-4">
                    <div v-for="playlist in playlists" :key="playlist.id"
                        class="bg-gray-900 rounded-xl p-4 sm:p-6 border-2 transition-all hover:border-gray-700"
                        :class="playlist.id === activePlaylistId ? 'border-blue-500' : 'border-gray-800'">
                        <div class="flex flex-col sm:flex-row items-start gap-4">
                            <!-- Info -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-3 mb-2">
                                    <h3 class="text-xl font-semibold text-white truncate">{{ playlist.name }}</h3>
                                    <span v-if="playlist.id === activePlaylistId"
                                        class="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                                        {{ t('common.active') }}
                                    </span>
                                </div>
                                <p class="text-sm text-gray-400 truncate mb-3">{{ playlist.url }}</p>
                                <div class="flex items-center gap-4 text-xs text-gray-500">
                                    <span v-if="playlist.username" class="flex items-center gap-1">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        {{ playlist.username }}
                                    </span>
                                    <span class="flex items-center gap-1">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {{ formatDate(playlist.createdAt) }}
                                    </span>
                                </div>
                            </div>

                            <!-- Actions -->
                            <div class="flex items-center gap-2 w-full sm:w-auto sm:ml-4 justify-end sm:justify-start">
                                <button v-if="playlist.id !== activePlaylistId" @click="activatePlaylist(playlist.id)"
                                    class="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
                                    :title="t('common.activate')">
                                    {{ t('common.activate') }}
                                </button>
                                <button @click="editPlaylist(playlist.id)"
                                    class="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
                                    :title="t('common.edit')">
                                    <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <button @click="deletePlaylist(playlist.id)"
                                    class="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                                    :title="t('common.delete')">
                                    <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Empty State -->
                <div v-else class="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
                    <svg class="w-20 h-20 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 class="text-xl font-semibold text-gray-400 mb-2">{{ t('settings.playlists.emptyTitle') }}</h3>
                    <p class="text-gray-500">{{ t('settings.playlists.emptyDescription') }}</p>
                </div>
            </div>

            <!-- VPN Tab -->
            <div v-if="activeTab === 'vpn'">
                <VpnSettings />
            </div>

            <!-- Streaming Tab -->
            <div v-if="activeTab === 'streaming'" class="space-y-4 sm:space-y-6">
                <!-- Timeout Setting -->
                <div class="bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800">
                    <h3 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">{{
                        t('settings.streaming.timeoutTitle') }}</h3>
                    <p class="text-gray-400 text-sm mb-4">
                        {{ t('settings.streaming.timeoutDescription') }}
                    </p>
                    <div class="flex items-center gap-4">
                        <input type="range" v-model.number="streamTimeout" min="5" max="60" step="1"
                            class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                        <span class="text-white font-mono bg-gray-800 px-3 py-1 rounded min-w-[60px] text-center">
                            {{ streamTimeout }}s
                        </span>
                    </div>
                </div>

                <!-- Retry Attempts -->
                <div class="bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800">
                    <h3 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">{{
                        t('settings.streaming.retryTitle') }}
                    </h3>
                    <p class="text-gray-400 text-sm mb-4">
                        {{ t('settings.streaming.retryDescription') }}
                    </p>
                    <div class="flex items-center gap-4">
                        <input type="range" v-model.number="streamRetryAttempts" min="0" max="5" step="1"
                            class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                        <span class="text-white font-mono bg-gray-800 px-3 py-1 rounded min-w-[60px] text-center">
                            {{ streamRetryAttempts }}
                        </span>
                    </div>
                </div>

                <!-- Toggle Settings -->
                <div class="bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800 space-y-4">
                    <h3 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">{{
                        t('settings.streaming.advancedTitle') }}</h3>

                    <!-- Enable Fallback -->
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-white font-medium">{{ t('settings.streaming.fallbackTitle') }}</p>
                            <p class="text-gray-400 text-sm">{{ t('settings.streaming.fallbackDescription') }}</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" v-model="streamEnableFallback" class="sr-only peer">
                            <div
                                class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
                            </div>
                        </label>
                    </div>

                    <!-- Content-Type Sniffing -->
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-white font-medium">{{ t('settings.streaming.contentTypeTitle') }}</p>
                            <p class="text-gray-400 text-sm">{{ t('settings.streaming.contentTypeDescription') }}</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" v-model="streamEnableContentTypeSniffing" class="sr-only peer">
                            <div
                                class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
                            </div>
                        </label>
                    </div>
                </div>

                <!-- Cache Info -->
                <div class="bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800">
                    <h3 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">{{
                        t('settings.streaming.cacheTitle') }}</h3>
                    <p class="text-gray-400 text-sm mb-4">
                        {{ t('settings.streaming.cacheDescription') }}
                    </p>
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-gray-300">
                            <span class="font-mono text-blue-400">{{ cacheStats.totalCached }}</span> {{
                                t('settings.streaming.streamsCached') }}
                        </div>
                        <button @click="clearStreamCache"
                            class="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors text-sm">
                            {{ t('settings.streaming.clearCache') }}
                        </button>
                    </div>
                    <div v-if="cacheStats.totalCached > 0" class="flex flex-wrap gap-2">
                        <span v-for="(count, type) in cacheStats.byType" :key="type"
                            class="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm">
                            {{ type.toUpperCase() }}: {{ count }}
                        </span>
                    </div>
                </div>

                <!-- Reset Button -->
                <div class="flex justify-end">
                    <button @click="resetStreamSettings"
                        class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                        {{ t('settings.streaming.resetButton') }}
                    </button>
                </div>
            </div>

            <!-- Language Tab -->
            <div v-if="activeTab === 'language'" class="space-y-4 sm:space-y-6">
                <!-- Language Selection -->
                <div class="bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800">
                    <h3 class="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">{{
                        t('settings.language.title') }}</h3>
                    <p class="text-gray-400 text-sm mb-6">
                        {{ t('settings.language.description') }}
                    </p>

                    <!-- Current Language Display -->
                    <div class="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p class="text-xs text-gray-400 mb-1">{{ t('settings.language.current') }}</p>
                        <p class="text-white font-medium">
                            <span v-if="selectedLanguage === 'auto'">{{ t('settings.language.autoDetect') }}</span>
                            <span v-else-if="selectedLanguage === 'it'">{{ t('settings.language.italian') }}</span>
                            <span v-else-if="selectedLanguage === 'en'">{{ t('settings.language.english') }}</span>
                        </p>
                    </div>

                    <!-- Language Options -->
                    <div class="space-y-3">
                        <!-- Auto Detect -->
                        <label
                            class="flex items-center p-4 bg-gray-800 hover:bg-gray-750 rounded-lg cursor-pointer transition-colors border-2"
                            :class="selectedLanguage === 'auto' ? 'border-blue-500' : 'border-transparent'">
                            <input type="radio" v-model="selectedLanguage" value="auto" class="sr-only">
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                    <span class="text-white font-medium">{{ t('settings.language.autoDetect') }}</span>
                                    <svg v-if="selectedLanguage === 'auto'" class="w-5 h-5 text-blue-500 ml-auto"
                                        fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clip-rule="evenodd" />
                                    </svg>
                                </div>
                                <p class="text-gray-400 text-sm mt-1">{{ t('settings.language.autoDetectDescription') }}
                                </p>
                            </div>
                        </label>

                        <!-- Italiano -->
                        <label
                            class="flex items-center p-4 bg-gray-800 hover:bg-gray-750 rounded-lg cursor-pointer transition-colors border-2"
                            :class="selectedLanguage === 'it' ? 'border-blue-500' : 'border-transparent'">
                            <input type="radio" v-model="selectedLanguage" value="it" class="sr-only">
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <span class="text-2xl">🇮🇹</span>
                                    <span class="text-white font-medium">{{ t('settings.language.italian') }}</span>
                                    <svg v-if="selectedLanguage === 'it'" class="w-5 h-5 text-blue-500 ml-auto"
                                        fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clip-rule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                        </label>

                        <!-- English -->
                        <label
                            class="flex items-center p-4 bg-gray-800 hover:bg-gray-750 rounded-lg cursor-pointer transition-colors border-2"
                            :class="selectedLanguage === 'en' ? 'border-blue-500' : 'border-transparent'">
                            <input type="radio" v-model="selectedLanguage" value="en" class="sr-only">
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <span class="text-2xl">🇬🇧</span>
                                    <span class="text-white font-medium">{{ t('settings.language.english') }}</span>
                                    <svg v-if="selectedLanguage === 'en'" class="w-5 h-5 text-blue-500 ml-auto"
                                        fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clip-rule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <!-- Confirm Dialog -->
        <Teleport to="body">
            <div v-if="confirmDialog.show"
                class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                @click="closeConfirmDialog">
                <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6" @click.stop>
                    <h3 class="text-xl font-bold text-white mb-3">{{ confirmDialog.title }}</h3>
                    <p class="text-gray-300 mb-6">{{ confirmDialog.message }}</p>
                    <div class="flex gap-3 justify-end">
                        <button @click="closeConfirmDialog"
                            class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
                            {{ t('common.cancel') }}
                        </button>
                        <button @click="handleConfirm"
                            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                            {{ t('common.confirm') }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped></style>
