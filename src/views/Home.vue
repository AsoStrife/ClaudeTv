<script setup>
import { storeToRefs } from 'pinia'
import { useIptvStore } from '@/stores/iptv'
import VideoPlayer from '@/components/VideoPlayer.vue'

const iptvStore = useIptvStore()
const { selectedChannel } = storeToRefs(iptvStore)

function closePlayer() {
    iptvStore.clearSelection()
}
</script>

<template>
    <div class="w-full h-full">
        <VideoPlayer :channel="selectedChannel" @close="closePlayer" />
    </div>
</template>

<style scoped></style>
