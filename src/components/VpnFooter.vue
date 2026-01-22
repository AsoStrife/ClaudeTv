<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVpnStore, VpnStatus, VpnType } from '@/stores/vpn'

const { t } = useI18n()
const vpnStore = useVpnStore()

// Status polling interval
let statusInterval = null

// Computed
const hasConfig = computed(() => vpnStore.hasConfig)
const isConnected = computed(() => vpnStore.isConnected)
const isBusy = computed(() => vpnStore.isBusy)
const status = computed(() => vpnStore.status)
const vpnType = computed(() => vpnStore.vpnType)
const error = computed(() => vpnStore.error)

const statusIcon = computed(() => {
    switch (status.value) {
        case VpnStatus.Connected: return '🟢'
        case VpnStatus.Connecting:
        case VpnStatus.Disconnecting: return '🟡'
        case VpnStatus.Error: return '🔴'
        default: return '⚪'
    }
})

const statusText = computed(() => {
    if (!hasConfig.value) {
        return t('vpn.footer.noConfig')
    }

    const vpnName = vpnType.value === VpnType.WireGuard ? 'WireGuard' :
        vpnType.value === VpnType.OpenVPN ? 'OpenVPN' : 'VPN'

    switch (status.value) {
        case VpnStatus.Connected:
            return t('vpn.footer.connected', { vpn: vpnName })
        case VpnStatus.Connecting:
            return t('vpn.footer.connecting')
        case VpnStatus.Disconnecting:
            return t('vpn.footer.disconnecting')
        case VpnStatus.Error:
            return t('vpn.footer.error')
        default:
            return t('vpn.footer.disconnected')
    }
})

const bgColor = computed(() => {
    switch (status.value) {
        case VpnStatus.Connected: return 'bg-green-900/30 border-green-800'
        case VpnStatus.Connecting:
        case VpnStatus.Disconnecting: return 'bg-yellow-900/30 border-yellow-800'
        case VpnStatus.Error: return 'bg-red-900/30 border-red-800'
        default: return 'bg-gray-900/50 border-gray-800'
    }
})

// Methods
async function toggleVpn() {
    if (isBusy.value) return
    await vpnStore.toggle()
}

// Lifecycle
onMounted(async () => {
    // Initialize store
    await vpnStore.initialize()

    // Poll status every 10 seconds if connected
    statusInterval = setInterval(async () => {
        if (vpnStore.hasConfig && vpnStore.isConnected) {
            await vpnStore.checkStatus()
        }
    }, 10000)
})

onUnmounted(() => {
    if (statusInterval) {
        clearInterval(statusInterval)
    }
})
</script>

<template>
    <div v-if="hasConfig" class="h-8 flex items-center justify-between px-4 py-1.5 border-t text-xs transition-colors"
        :class="bgColor">
        <!-- Status indicator -->
        <div class="flex items-center gap-2">
            <span class="text-sm leading-none">{{ statusIcon }}</span>
            <span class="text-gray-300">{{ statusText }}</span>
            <span v-if="error" class="text-red-400 truncate max-w-[200px]" :title="error">
                - {{ error }}
            </span>
        </div>

        <!-- Quick toggle button -->
        <button @click="toggleVpn" :disabled="isBusy"
            class="px-2 py-0.5 rounded text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-wait"
            :class="isConnected
                ? 'bg-red-600/50 hover:bg-red-600 text-red-200'
                : 'bg-green-600/50 hover:bg-green-600 text-green-200'">
            <span v-if="isBusy" class="flex items-center gap-1">
                <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
            </span>
            <span v-else>
                {{ isConnected ? t('vpn.footer.disconnect') : t('vpn.footer.connect') }}
            </span>
        </button>
    </div>
</template>
