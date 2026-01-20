<script setup>
import { storeToRefs } from 'pinia'
import { useIptvStore } from '@/stores/iptv'
import VideoPlayer from '@/components/VideoPlayer.vue'

const iptvStore = useIptvStore()
const { selectedChannel } = storeToRefs(iptvStore)
</script>

<template>
  <div class="w-full h-full">
    <VideoPlayer :channel="selectedChannel" />
  </div>
</template>

<style scoped></style>
