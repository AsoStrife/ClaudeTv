<template>
    <!-- Barra sottile quando collassato -->
    <div v-if="isSidebarCollapsed"
        class="h-full w-12 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-4 gap-4">
        <!-- Pulsante per riaprire -->
        <button @click="uiStore.toggleSidebar"
            class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            :title="t('sidebar.show')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
        </button>
        <!-- Pulsante impostazioni -->
        <button @click="goToSettings"
            class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            :title="t('sidebar.settings')">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        </button>
    </div>

    <!-- Sidebar completa -->
    <aside v-if="!isSidebarCollapsed"
        class="h-full w-64 sm:w-72 md:w-80 bg-gray-900 text-white flex flex-col transition-all duration-300 ease-in-out">
        <div class="flex-shrink-0 p-4 border-b border-gray-700">
            <!-- Header -->
            <div class="flex items-center justify-between mb-3 sm:mb-4">
                <div class="flex-1 min-w-0">
                    <h1 class="text-lg sm:text-xl font-bold text-blue-400">{{ t('app.name') }}</h1>
                    <p v-if="activePlaylist" class="text-xs text-gray-500 truncate mt-0.5">{{ t('sidebar.playlist', {
                        name: activePlaylist.name }) }}</p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <!-- Settings Button -->
                    <button @click="goToSettings"
                        class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                        :title="t('sidebar.settings')">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                    <!-- Toggle Sidebar Button -->
                    <button @click="uiStore.toggleSidebar"
                        class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                        :title="t('sidebar.hide')">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Stats -->
            <div v-if="hasPlaylist" class="text-xs text-gray-400">
                {{ t('sidebar.channelsCount', { filtered: filteredChannelsCount, total: totalChannels }) }}
            </div>
        </div>

        <!-- Search -->
        <div v-if="hasPlaylist" class="flex-shrink-0 p-4 border-b border-gray-700">
            <div class="relative">
                <input v-model="searchInput" type="text" :placeholder="t('common.search')"
                    class="w-full px-3 py-2 pl-9 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500" />
                <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <button v-if="searchInput" @click="clearSearch"
                    class="absolute right-3 top-2.5 text-gray-400 hover:text-white">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Expand/Collapse all -->
            <div class="flex gap-2 mt-2">
                <button @click="expandAllCategories"
                    class="flex-1 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors">
                    {{ t('sidebar.expandAll') }}
                </button>
                <button @click="collapseAllCategories"
                    class="flex-1 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors">
                    {{ t('sidebar.collapseAll') }}
                </button>
            </div>
        </div>

        <!-- Skeleton Loader -->
        <div v-if="isLoading || isSearching" class="flex-1 overflow-y-auto p-4">
            <div class="space-y-2 animate-pulse">
                <div v-for="i in 12" :key="i" class="h-10 bg-gray-800 rounded"></div>
            </div>
        </div>

        <!-- Channel List with Categories (when no search) -->
        <div v-if="hasPlaylist && !isLoading && !isSearching && !searchInput"
            class="flex-1 overflow-y-auto sidebar-scroll">
            <div v-for="category in visibleCategories" :key="category" class="border-b border-gray-800">
                <!-- Category Header -->
                <button @click="toggleCategory(category)"
                    class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800 transition-colors">
                    <span class="font-medium text-sm truncate">{{ category }}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500">
                            {{ channelsByCategory[category]?.length || 0 }}
                        </span>
                        <svg class="w-4 h-4 text-gray-400 transition-transform duration-200"
                            :class="{ 'rotate-180': isCategoryExpanded(category) }" fill="none" stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </button>

                <!-- Channels in Category -->
                <div v-if="isCategoryExpanded(category)" class="bg-gray-950">
                    <button v-for="channel in channelsByCategory[category]" :key="channel.id"
                        @click="selectChannel(channel)" @contextmenu="showContextMenu($event, channel)"
                        class="channel-item w-full px-4 py-2 pl-6 flex items-center justify-between hover:bg-gray-800 transition-colors text-left"
                        :class="{ 'bg-blue-900/50 border-l-2 border-blue-500': selectedChannel?.id === channel.id }">
                        <span class="text-sm truncate flex-1">{{ channel.name }}</span>
                        <svg v-if="isFavorite(channel.id)" class="w-4 h-4 text-yellow-400 flex-shrink-0 ml-2"
                            fill="currentColor" viewBox="0 0 20 20">
                            <path
                                d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <!-- Flat Channel List (when searching) -->
        <div v-if="hasPlaylist && !isLoading && !isSearching && searchInput"
            class="flex-1 overflow-y-auto sidebar-scroll">
            <div v-for="category in visibleCategories" :key="category">
                <button v-for="channel in channelsByCategory[category]" :key="channel.id"
                    @click="selectChannel(channel)" @contextmenu="showContextMenu($event, channel)"
                    class="channel-item w-full px-4 py-2 flex items-center justify-between hover:bg-gray-800 transition-colors text-left"
                    :class="{ 'bg-blue-900/50 border-l-2 border-blue-500': selectedChannel?.id === channel.id }">
                    <span class="text-sm truncate flex-1">{{ channel.name }}</span>
                    <svg v-if="isFavorite(channel.id)" class="w-4 h-4 text-yellow-400 flex-shrink-0 ml-2"
                        fill="currentColor" viewBox="0 0 20 20">
                        <path
                            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Empty state -->
        <div v-if="!hasPlaylist && !isLoading" class="flex-1 flex items-center justify-center p-4">
            <div class="text-center text-gray-500">
                <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
                <p class="text-sm">{{ t('sidebar.emptyMessage') }}</p>
            </div>
        </div>

        <!-- Context Menu -->
        <Teleport to="body">
            <div v-if="contextMenu.show" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
                class="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]">
                <button @click="toggleChannelFavorite"
                    class="w-full px-4 py-2 text-sm text-left text-white hover:bg-gray-700 transition-colors flex items-center gap-2">
                    <svg v-if="contextMenu.channel && isFavorite(contextMenu.channel.id)"
                        class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <svg v-else class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                        <path
                            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                            stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
                    </svg>
                    <span v-if="contextMenu.channel && isFavorite(contextMenu.channel.id)">{{
                        t('sidebar.removeFromFavorites') }}</span>
                    <span v-else>{{ t('sidebar.addToFavorites') }}</span>
                </button>
            </div>
        </Teleport>
    </aside>
</template>

<script setup>
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useIptvStore } from '@/stores/iptv'
import { useUiStore } from '@/stores/ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const router = useRouter()
const iptvStore = useIptvStore()
const uiStore = useUiStore()

const {
    categories,
    visibleCategories,
    selectedChannel,
    hasPlaylist,
    totalChannels,
    filteredChannelsCount,
    channelsByCategory,
    isLoading,
    activePlaylist,
    hasFavorites
} = storeToRefs(iptvStore)

const { isSidebarCollapsed } = storeToRefs(uiStore)

const searchInput = ref('')
const isSearching = ref(false)
const contextMenu = ref({
    show: false,
    x: 0,
    y: 0,
    channel: null
})

// Debounce search
let searchTimeout = null
watch(searchInput, (value) => {
    clearTimeout(searchTimeout)
    isSearching.value = true
    searchTimeout = setTimeout(() => {
        iptvStore.setSearchQuery(value)
        isSearching.value = false
    }, 300)
})

function clearSearch() {
    searchInput.value = ''
    isSearching.value = false
    iptvStore.setSearchQuery('')
}

function goToSettings() {
    router.push('/settings')
}

function goToHome() {
    router.push('/')
}

function showContextMenu(event, channel) {
    event.preventDefault()
    contextMenu.value = {
        show: true,
        x: event.clientX,
        y: event.clientY,
        channel
    }
}

function closeContextMenu() {
    contextMenu.value.show = false
}

function toggleChannelFavorite() {
    if (contextMenu.value.channel) {
        iptvStore.toggleFavorite(contextMenu.value.channel.id)
    }
    closeContextMenu()
}

// Chiudi il menu contestuale quando si clicca fuori
if (typeof window !== 'undefined') {
    window.addEventListener('click', closeContextMenu)
    window.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.channel-item')) {
            closeContextMenu()
        }
    })
}

// Expose store methods
const {
    selectChannel,
    toggleCategory,
    isCategoryExpanded,
    expandAllCategories,
    collapseAllCategories,
    isFavorite
} = iptvStore
</script>
