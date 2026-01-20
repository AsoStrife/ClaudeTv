<template>
	<aside class="h-full bg-gray-900 text-white flex flex-col transition-all duration-300 ease-in-out"
		:class="isSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-80'">
		<div class="flex-shrink-0 p-4 border-b border-gray-700">
			<!-- Header -->
			<div class="flex items-center justify-between mb-4">
				<h1 class="text-xl font-bold text-blue-400">ClaudeTV</h1>
			</div>

			<!-- Form URL Playlist -->
			<form @submit.prevent="handleLoadPlaylist" class="space-y-2">
				<input v-model="urlInput" type="url" placeholder="Inserisci URL playlist M3U..."
					class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
				<button type="submit" :disabled="isLoading"
					class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-colors">
					{{ isLoading ? 'Caricamento...' : 'Carica Playlist' }}
				</button>
			</form>

			<!-- Error message -->
			<p v-if="error" class="mt-2 text-sm text-red-400">
				⚠️ {{ error }}
			</p>

			<!-- Stats -->
			<div v-if="hasPlaylist" class="mt-3 text-xs text-gray-400">
				{{ filteredChannelsCount }} / {{ totalChannels }} canali
			</div>
		</div>

		<!-- Search -->
		<div v-if="hasPlaylist" class="flex-shrink-0 p-4 border-b border-gray-700">
			<div class="relative">
				<input v-model="searchInput" type="text" placeholder="Cerca canale..."
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
					Espandi tutto
				</button>
				<button @click="collapseAllCategories"
					class="flex-1 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors">
					Comprimi tutto
				</button>
			</div>
		</div>

		<!-- Channel List -->
		<div v-if="hasPlaylist" class="flex-1 overflow-y-auto sidebar-scroll">
			<div v-for="category in categories" :key="category" class="border-b border-gray-800">
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
						@click="selectChannel(channel)"
						class="w-full px-4 py-2 pl-6 flex items-center gap-3 hover:bg-gray-800 transition-colors text-left"
						:class="{ 'bg-blue-900/50 border-l-2 border-blue-500': selectedChannel?.id === channel.id }">
						<span class="text-sm truncate">{{ channel.name }}</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Empty state -->
		<div v-if="!hasPlaylist && !isLoading" class="flex-1 flex items-center justify-center p-4">
			<div class="text-center text-gray-500">
				<svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
						d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
				</svg>
				<p class="text-sm">Inserisci l'URL di una playlist M3U per iniziare</p>
			</div>
		</div>
	</aside>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useIptvStore } from '@/stores/iptv'
import { useUiStore } from '@/stores/ui'

const iptvStore = useIptvStore()
const uiStore = useUiStore()

const {
	playlistUrl,
	categories,
	selectedChannel,
	isLoading,
	error,
	hasPlaylist,
	totalChannels,
	filteredChannelsCount,
	channelsByCategory
} = storeToRefs(iptvStore)

const { isSidebarCollapsed } = storeToRefs(uiStore)

const urlInput = ref('')
const searchInput = ref('')

// Sync URL input with store
onMounted(() => {
	urlInput.value = playlistUrl.value

	// Non serve auto-load, i dati sono già in localStorage e caricati automaticamente
	// Lo store Pinia + VueUse li carica da solo al mount
})

// Debounce search
let searchTimeout = null
watch(searchInput, (value) => {
	clearTimeout(searchTimeout)
	searchTimeout = setTimeout(() => {
		iptvStore.setSearchQuery(value)
	}, 300)
})

function handleLoadPlaylist() {
	iptvStore.loadPlaylist(urlInput.value)
}

function clearSearch() {
	searchInput.value = ''
	iptvStore.setSearchQuery('')
}

// Expose store methods
const {
	selectChannel,
	toggleCategory,
	isCategoryExpanded,
	expandAllCategories,
	collapseAllCategories
} = iptvStore
</script>
