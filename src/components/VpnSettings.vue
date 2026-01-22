<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { useVpnStore, VpnType, VpnStatus } from '@/stores/vpn'

const { t } = useI18n()
const vpnStore = useVpnStore()

// Local state
const isLoadingFile = ref(false)
const parseError = ref(null)
const tempConfigInfo = ref(null)

// Computed
const hasConfig = computed(() => vpnStore.hasConfig)
const savedConfig = computed(() => vpnStore.savedConfigInfo)
const configPath = computed(() => vpnStore.configPath)
const autoConnect = computed({
    get: () => vpnStore.autoConnect,
    set: (val) => vpnStore.setAutoConnect(val)
})

const wireguardAvailable = computed(() => vpnStore.detectedClients.wireguard?.available)
const openvpnAvailable = computed(() => vpnStore.detectedClients.openvpn?.available)
const anyClientAvailable = computed(() => vpnStore.hasAnyVpnClient)

const isConnected = computed(() => vpnStore.isConnected)
const isBusy = computed(() => vpnStore.isBusy)
const status = computed(() => vpnStore.status)
const connectionError = computed(() => vpnStore.error)

const statusColor = computed(() => {
    switch (status.value) {
        case VpnStatus.Connected: return 'text-green-400'
        case VpnStatus.Connecting:
        case VpnStatus.Disconnecting: return 'text-yellow-400'
        case VpnStatus.Error: return 'text-red-400'
        default: return 'text-gray-400'
    }
})

// Methods
async function selectConfigFile() {
    isLoadingFile.value = true
    parseError.value = null
    tempConfigInfo.value = null

    try {
        const selected = await open({
            title: t('vpn.selectFile'),
            filters: [
                {
                    name: 'VPN Config',
                    extensions: ['conf', 'ovpn']
                }
            ]
        })

        if (!selected) {
            isLoadingFile.value = false
            return
        }

        // Read file content
        const content = await readTextFile(selected)

        // Parse config
        const configInfo = await vpnStore.parseConfig(content)

        if (!configInfo) {
            parseError.value = t('vpn.parseError')
            return
        }

        if (!configInfo.is_valid) {
            parseError.value = configInfo.error || t('vpn.invalidConfig')
            return
        }

        // Save config
        vpnStore.saveConfig(selected, configInfo)
        tempConfigInfo.value = configInfo

    } catch (e) {
        console.error('[VPN Settings] Error loading config:', e)
        parseError.value = e.toString()
    } finally {
        isLoadingFile.value = false
    }
}

function clearConfig() {
    vpnStore.clearConfig()
    tempConfigInfo.value = null
    parseError.value = null
}

async function testConnection() {
    if (isConnected.value) {
        await vpnStore.disconnect()
    } else {
        await vpnStore.connect()
    }
}

function getVpnTypeName(type) {
    if (type === VpnType.WireGuard) return 'WireGuard'
    if (type === VpnType.OpenVPN) return 'OpenVPN'
    return type
}

function getFileName(path) {
    if (!path) return ''
    return path.split(/[/\\]/).pop()
}

// Initialize
onMounted(async () => {
    await vpnStore.detectClients()
})
</script>

<template>
    <div class="space-y-6">
        <!-- VPN Client Detection -->
        <div class="bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800">
            <h3 class="text-base sm:text-lg font-semibold text-white mb-4">
                {{ t('vpn.detectedClients') }}
            </h3>

            <div class="flex flex-wrap gap-3">
                <!-- WireGuard -->
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg"
                    :class="wireguardAvailable ? 'bg-green-900/30 border border-green-700' : 'bg-gray-800 border border-gray-700'">
                    <div class="w-2 h-2 rounded-full" :class="wireguardAvailable ? 'bg-green-400' : 'bg-gray-500'">
                    </div>
                    <span :class="wireguardAvailable ? 'text-green-400' : 'text-gray-500'">
                        WireGuard
                    </span>
                    <span v-if="wireguardAvailable" class="text-xs text-green-600">
                        ✓ {{ t('vpn.installed') }}
                    </span>
                    <span v-else class="text-xs text-gray-600">
                        {{ t('vpn.notInstalled') }}
                    </span>
                </div>

                <!-- OpenVPN -->
                <div class="flex items-center gap-2 px-3 py-2 rounded-lg"
                    :class="openvpnAvailable ? 'bg-green-900/30 border border-green-700' : 'bg-gray-800 border border-gray-700'">
                    <div class="w-2 h-2 rounded-full" :class="openvpnAvailable ? 'bg-green-400' : 'bg-gray-500'"></div>
                    <span :class="openvpnAvailable ? 'text-green-400' : 'text-gray-500'">
                        OpenVPN
                    </span>
                    <span v-if="openvpnAvailable" class="text-xs text-green-600">
                        ✓ {{ t('vpn.installed') }}
                    </span>
                    <span v-else class="text-xs text-gray-600">
                        {{ t('vpn.notInstalled') }}
                    </span>
                </div>
            </div>

            <!-- No clients warning -->
            <div v-if="!anyClientAvailable" class="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <p class="text-yellow-400 text-sm">
                    ⚠️ {{ t('vpn.noClientsWarning') }}
                </p>
            </div>
        </div>

        <!-- VPN Configuration -->
        <div class="bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800">
            <h3 class="text-base sm:text-lg font-semibold text-white mb-4">
                {{ t('vpn.configuration') }}
            </h3>

            <!-- No config loaded -->
            <div v-if="!hasConfig">
                <p class="text-gray-400 text-sm mb-4">
                    {{ t('vpn.noConfigDescription') }}
                </p>

                <button @click="selectConfigFile" :disabled="isLoadingFile || !anyClientAvailable"
                    class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                    <svg v-if="isLoadingFile" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4">
                        </circle>
                        <path class="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                        </path>
                    </svg>
                    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {{ t('vpn.uploadConfig') }}
                </button>

                <!-- Parse error -->
                <div v-if="parseError" class="mt-3 p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
                    <p class="text-red-400 text-sm">{{ parseError }}</p>
                </div>
            </div>

            <!-- Config loaded -->
            <div v-else class="space-y-4">
                <!-- Config info card -->
                <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-1 text-xs font-medium rounded"
                                :class="savedConfig?.vpn_type === VpnType.WireGuard ? 'bg-blue-600' : 'bg-orange-600'">
                                {{ getVpnTypeName(savedConfig?.vpn_type) }}
                            </span>
                            <span :class="statusColor" class="text-sm font-medium">
                                {{ t(`vpn.status.${status.toLowerCase()}`) }}
                            </span>
                        </div>
                        <button @click="clearConfig" class="text-gray-400 hover:text-red-400 transition-colors p-1"
                            :title="t('vpn.removeConfig')">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-400">{{ t('vpn.file') }}:</span>
                            <span class="text-white font-mono truncate ml-2 max-w-[200px]" :title="configPath">
                                {{ getFileName(configPath) }}
                            </span>
                        </div>
                        <div v-if="savedConfig?.endpoint" class="flex justify-between">
                            <span class="text-gray-400">{{ t('vpn.endpoint') }}:</span>
                            <span class="text-white font-mono">{{ savedConfig.endpoint }}</span>
                        </div>
                        <div v-if="savedConfig?.dns" class="flex justify-between">
                            <span class="text-gray-400">DNS:</span>
                            <span class="text-white font-mono">{{ savedConfig.dns }}</span>
                        </div>
                        <div v-if="savedConfig?.address" class="flex justify-between">
                            <span class="text-gray-400">{{ t('vpn.address') }}:</span>
                            <span class="text-white font-mono">{{ savedConfig.address }}</span>
                        </div>
                    </div>
                </div>

                <!-- Connection error -->
                <div v-if="connectionError" class="p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
                    <p class="text-red-400 text-sm">{{ connectionError }}</p>
                </div>

                <!-- Test connection button -->
                <button @click="testConnection" :disabled="isBusy"
                    class="w-full px-4 py-3 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    :class="isConnected
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'">
                    <svg v-if="isBusy" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4">
                        </circle>
                        <path class="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                        </path>
                    </svg>
                    <span v-else>
                        {{ isConnected ? t('vpn.disconnect') : t('vpn.testConnection') }}
                    </span>
                </button>
            </div>
        </div>

        <!-- Auto-connect Setting -->
        <div v-if="hasConfig" class="bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-800">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-base font-semibold text-white">{{ t('vpn.autoConnect') }}</h3>
                    <p class="text-gray-400 text-sm mt-1">{{ t('vpn.autoConnectDescription') }}</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" v-model="autoConnect" class="sr-only peer">
                    <div
                        class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600">
                    </div>
                </label>
            </div>
        </div>

        <!-- Admin privileges info -->
        <div class="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
            <div class="flex gap-3">
                <svg class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-gray-400 text-sm">
                    {{ t('vpn.adminNote') }}
                </p>
            </div>
        </div>
    </div>
</template>
