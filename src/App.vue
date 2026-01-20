<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ChannelSidebar from '@/components/ChannelSidebar.vue'

const route = useRoute()

const isSetupPage = computed(() => route.name === 'Setup')
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
