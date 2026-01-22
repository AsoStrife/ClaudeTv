import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";

// VPN Types (matching Rust enum)
export const VpnType = {
    WireGuard: "WireGuard",
    OpenVPN: "OpenVPN"
};

// VPN Status (matching Rust enum)
export const VpnStatus = {
    Disconnected: "Disconnected",
    Connecting: "Connecting",
    Connected: "Connected",
    Disconnecting: "Disconnecting",
    Error: "Error"
};

export const useVpnStore = defineStore("vpn", () => {
    // ========================================
    // Persisted State (localStorage)
    // ========================================

    // VPN configuration path (saved config file location)
    const configPath = useLocalStorage("vpn/configPath", null);

    // VPN type (WireGuard or OpenVPN)
    const vpnType = useLocalStorage("vpn/type", null);

    // Auto-connect VPN before streaming
    const autoConnect = useLocalStorage("vpn/autoConnect", false);

    // Saved config content (for displaying info without re-reading file)
    const savedConfigInfo = useLocalStorage("vpn/configInfo", null);

    // ========================================
    // Reactive State (non-persisted)
    // ========================================

    // Current VPN status
    const status = ref(VpnStatus.Disconnected);

    // Active tunnel name
    const tunnelName = ref(null);

    // Error message
    const error = ref(null);

    // Detected VPN clients on system
    const detectedClients = ref({
        wireguard: { available: false, path: null },
        openvpn: { available: false, path: null }
    });

    // Loading states
    const isDetecting = ref(false);
    const isConnecting = ref(false);
    const isDisconnecting = ref(false);

    // ========================================
    // Computed Properties
    // ========================================

    const isConnected = computed(() => status.value === VpnStatus.Connected);
    const isDisconnected = computed(() => status.value === VpnStatus.Disconnected);
    const isBusy = computed(() => isConnecting.value || isDisconnecting.value);

    const hasConfig = computed(() => configPath.value !== null && savedConfigInfo.value !== null);

    const hasAnyVpnClient = computed(() =>
        detectedClients.value.wireguard.available || detectedClients.value.openvpn.available
    );

    const availableVpnTypes = computed(() => {
        const types = [];
        if (detectedClients.value.wireguard.available) types.push(VpnType.WireGuard);
        if (detectedClients.value.openvpn.available) types.push(VpnType.OpenVPN);
        return types;
    });

    // ========================================
    // Actions
    // ========================================

    /**
     * Detect available VPN clients on the system
     */
    async function detectClients() {
        isDetecting.value = true;
        error.value = null;

        try {
            const result = await invoke("detect_vpn_clients");
            detectedClients.value = result;
            console.log("[VPN] Detected clients:", result);
            return result;
        } catch (e) {
            console.error("[VPN] Failed to detect clients:", e);
            error.value = e.toString();
            return null;
        } finally {
            isDetecting.value = false;
        }
    }

    /**
     * Parse a VPN config file content
     * @param {string} content - The content of the config file
     */
    async function parseConfig(content) {
        try {
            const result = await invoke("parse_vpn_config", { content });
            console.log("[VPN] Parsed config:", result);
            return result;
        } catch (e) {
            console.error("[VPN] Failed to parse config:", e);
            error.value = e.toString();
            return null;
        }
    }

    /**
     * Save VPN configuration
     * @param {string} path - Path to the config file
     * @param {object} configInfo - Parsed config info
     */
    function saveConfig(path, configInfo) {
        configPath.value = path;
        vpnType.value = configInfo.vpn_type;
        savedConfigInfo.value = {
            endpoint: configInfo.endpoint,
            dns: configInfo.dns,
            address: configInfo.address,
            vpn_type: configInfo.vpn_type
        };
        console.log("[VPN] Config saved:", { path, configInfo });
    }

    /**
     * Clear saved VPN configuration
     */
    function clearConfig() {
        configPath.value = null;
        vpnType.value = null;
        savedConfigInfo.value = null;
        autoConnect.value = false;
        console.log("[VPN] Config cleared");
    }

    /**
     * Connect to VPN
     */
    async function connect() {
        if (!configPath.value || !vpnType.value) {
            error.value = "No VPN configuration loaded";
            return false;
        }

        isConnecting.value = true;
        status.value = VpnStatus.Connecting;
        error.value = null;

        try {
            const result = await invoke("connect_vpn", {
                configPath: configPath.value,
                vpnType: vpnType.value
            });

            status.value = result.status;
            tunnelName.value = result.tunnel_name;

            if (result.error) {
                error.value = result.error;
                status.value = VpnStatus.Error;
                return false;
            }

            console.log("[VPN] Connected:", result);
            return true;
        } catch (e) {
            console.error("[VPN] Connection failed:", e);
            error.value = e.toString();
            status.value = VpnStatus.Error;
            return false;
        } finally {
            isConnecting.value = false;
        }
    }

    /**
     * Disconnect from VPN
     */
    async function disconnect() {
        if (!tunnelName.value || !vpnType.value) {
            // Try to disconnect anyway with default values
            const name = tunnelName.value || "claudetv_vpn";
            const type = vpnType.value || VpnType.WireGuard;

            try {
                await invoke("disconnect_vpn", {
                    tunnelName: name,
                    vpnType: type
                });
            } catch (e) {
                console.warn("[VPN] Disconnect warning:", e);
            }

            status.value = VpnStatus.Disconnected;
            tunnelName.value = null;
            return true;
        }

        isDisconnecting.value = true;
        status.value = VpnStatus.Disconnecting;
        error.value = null;

        try {
            const result = await invoke("disconnect_vpn", {
                tunnelName: tunnelName.value,
                vpnType: vpnType.value
            });

            status.value = result.status;
            tunnelName.value = null;

            console.log("[VPN] Disconnected:", result);
            return true;
        } catch (e) {
            console.error("[VPN] Disconnect failed:", e);
            error.value = e.toString();
            status.value = VpnStatus.Error;
            return false;
        } finally {
            isDisconnecting.value = false;
        }
    }

    /**
     * Check current VPN status
     */
    async function checkStatus() {
        try {
            const result = await invoke("get_vpn_status", {
                tunnelName: tunnelName.value,
                vpnType: vpnType.value
            });

            status.value = result.status;
            if (result.tunnel_name) {
                tunnelName.value = result.tunnel_name;
            }

            console.log("[VPN] Status check:", result);
            return result;
        } catch (e) {
            console.error("[VPN] Status check failed:", e);
            return null;
        }
    }

    /**
     * Toggle VPN connection
     */
    async function toggle() {
        if (isConnected.value) {
            return await disconnect();
        } else {
            return await connect();
        }
    }

    /**
     * Set auto-connect preference
     * @param {boolean} enabled
     */
    function setAutoConnect(enabled) {
        autoConnect.value = enabled;
    }

    /**
     * Initialize store - detect clients and check status
     */
    async function initialize() {
        await detectClients();

        // Check if we have a saved config and check its status
        if (configPath.value && vpnType.value) {
            await checkStatus();
        }
    }

    return {
        // State
        configPath,
        vpnType,
        autoConnect,
        savedConfigInfo,
        status,
        tunnelName,
        error,
        detectedClients,
        isDetecting,
        isConnecting,
        isDisconnecting,

        // Computed
        isConnected,
        isDisconnected,
        isBusy,
        hasConfig,
        hasAnyVpnClient,
        availableVpnTypes,

        // Actions
        detectClients,
        parseConfig,
        saveConfig,
        clearConfig,
        connect,
        disconnect,
        checkStatus,
        toggle,
        setAutoConnect,
        initialize
    };
});
