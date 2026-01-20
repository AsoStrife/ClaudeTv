<script setup>
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'
import ChannelSidebar from '@/components/ChannelSidebar.vue'

const uiStore = useUiStore()
const { isSidebarCollapsed } = storeToRefs(uiStore)
</script>

<template>
  <div class="h-screen w-screen flex bg-gray-950 overflow-hidden">
    <!-- Sidebar -->
    <ChannelSidebar />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 relative">
      <!-- Toggle Sidebar Button -->
      <button
        @click="uiStore.toggleSidebar"
        class="absolute top-4 left-4 z-10 p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors shadow-lg"
        :title="isSidebarCollapsed ? 'Mostra sidebar' : 'Nascondi sidebar'"
      >
        <svg
          class="w-5 h-5 transition-transform duration-300"
          :class="{ 'rotate-180': !isSidebarCollapsed }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      <!-- Router View -->
      <router-view class="flex-1" />
    </main>
  </div>
</template>

<style scoped></style>
