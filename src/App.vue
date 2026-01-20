<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ChannelSidebar from '@/components/ChannelSidebar.vue'
import { useIptvStore } from '@/stores/iptv'

const route = useRoute()
const iptvStore = useIptvStore()

const isSetupPage = computed(() => route.name === 'Setup')

// Carica automaticamente la playlist attiva all'avvio
onMounted(async () => {
    if (iptvStore.activePlaylistId && !iptvStore.hasPlaylist) {
        await iptvStore.loadPlaylist()
    }
})
</script>

<template>
    <!-- Setup layout: scrollable, no sidebar -->
    <div v-if="isSetupPage" class="min-h-screen w-full flex bg-gray-950">
        <main class="flex-1 flex flex-col min-w-0">
            <router-view class="flex-1 overflow-auto" />
        </main>
    </div>

    <!-- Default layout: fixed viewport with sidebar + player -->
    <div v-else class="h-screen w-screen flex bg-gray-950 overflow-hidden">
        <ChannelSidebar />
        <main class="flex-1 flex flex-col min-w-0 relative">
            <router-view class="flex-1" />
        </main>
    </div>
</template>

<style scoped></style>
