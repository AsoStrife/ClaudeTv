<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ChannelSidebar from '@/components/ChannelSidebar.vue'
import VpnFooter from '@/components/VpnFooter.vue'
import { useIptvStore } from '@/stores/iptv'

const route = useRoute()
const iptvStore = useIptvStore()

const isSetupPage = computed(() => route.name === 'Setup')

// Carica automaticamente la playlist attiva all'avvio
onMounted(async () => {
    if (iptvStore.activePlaylistId && !iptvStore.hasPlaylist) {
        await iptvStore.loadPlaylist()
    }

    // Disabilita il menu contestuale del browser ovunque tranne che sui canali
    window.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.channel-item')) {
            e.preventDefault()
        }
    })
})
</script>

<template>
    <!-- Setup layout: scrollable, no sidebar -->
    <div v-if="isSetupPage" class="min-h-screen w-full flex bg-gray-950">
        <main class="flex-1 flex flex-col min-w-0">
            <router-view class="flex-1 overflow-auto" />
        </main>
    </div>

    <!-- Default layout: fixed viewport with sidebar + player + VPN footer -->
    <div v-else class="h-screen w-screen flex flex-col bg-gray-950 overflow-hidden">
        <div class="flex-1 flex min-h-0">
            <ChannelSidebar />
            <main class="flex-1 flex flex-col min-w-0 relative">
                <router-view class="flex-1" />
            </main>
        </div>
        <!-- VPN Status Footer -->
        <VpnFooter />
    </div>
</template>

<style scoped></style>
