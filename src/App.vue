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
    <div class="h-screen w-screen flex bg-gray-950 overflow-hidden">
        <!-- Sidebar (nascosta in setup) -->
        <ChannelSidebar v-if="!isSetupPage" />

        <!-- Main Content -->
        <main class="flex-1 flex flex-col min-w-0 relative">
            <!-- Router View -->
            <router-view class="flex-1" />
        </main>
    </div>
</template>

<style scoped></style>
