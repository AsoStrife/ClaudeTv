import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { computed } from "vue";
import { StreamType } from "@/utils/streamHandler";

export const useUiStore = defineStore("ui", () => {
    // Stato sidebar (persistito)
    const isSidebarCollapsed = useLocalStorage("ui/sidebarCollapsed", false);

    // ========================================
    // Lingua (persistita)
    // ========================================
    // 'auto' = rilevamento automatico, 'it' = italiano, 'en' = inglese
    const selectedLanguage = useLocalStorage("ui/language", "auto");

    // ========================================
    // Configurazione Stream Handler (persistita)
    // ========================================

    // Timeout per il caricamento stream (millisecondi)
    const streamTimeout = useLocalStorage("ui/streamTimeout", 15000);

    // Numero di tentativi per adapter prima di passare al successivo
    const streamRetryAttempts = useLocalStorage("ui/streamRetryAttempts", 2);

    // Abilita fallback automatico tra adapter
    const streamEnableFallback = useLocalStorage("ui/streamEnableFallback", true);

    // Abilita rilevamento Content-Type via HEAD request
    const streamEnableContentTypeSniffing = useLocalStorage("ui/streamEnableContentTypeSniffing", true);

    // Ordine di fallback personalizzabile
    const streamFallbackOrder = useLocalStorage("ui/streamFallbackOrder", [
        StreamType.HLS,
        StreamType.DASH,
        StreamType.MPEGTS,
        StreamType.NATIVE
    ]);

    // ========================================
    // Computed - Configurazione completa per StreamHandler
    // ========================================

    const streamConfig = computed(() => ({
        timeout: streamTimeout.value,
        retryAttempts: streamRetryAttempts.value,
        enableFallback: streamEnableFallback.value,
        enableContentTypeSniffing: streamEnableContentTypeSniffing.value,
        fallbackOrder: streamFallbackOrder.value
    }));

    // ========================================
    // Actions - Sidebar
    // ========================================

    function toggleSidebar() {
        isSidebarCollapsed.value = !isSidebarCollapsed.value;
    }

    function collapseSidebar() {
        isSidebarCollapsed.value = true;
    }

    function expandSidebar() {
        isSidebarCollapsed.value = false;
    }

    // ========================================
    // Actions - Language
    // ========================================

    function setLanguage(lang) {
        // Validazione: accetta solo 'auto', 'it', 'en'
        if (['auto', 'it', 'en'].includes(lang)) {
            selectedLanguage.value = lang;
        }
    }

    // ========================================
    // Actions - Stream Settings
    // ========================================

    function setStreamTimeout(timeout) {
        // Minimo 5s, massimo 60s
        streamTimeout.value = Math.max(5000, Math.min(60000, timeout));
    }

    function setStreamRetryAttempts(attempts) {
        // Minimo 0, massimo 5
        streamRetryAttempts.value = Math.max(0, Math.min(5, attempts));
    }

    function setStreamEnableFallback(enabled) {
        streamEnableFallback.value = enabled;
    }

    function setStreamEnableContentTypeSniffing(enabled) {
        streamEnableContentTypeSniffing.value = enabled;
    }

    function setStreamFallbackOrder(order) {
        if (Array.isArray(order) && order.length > 0) {
            streamFallbackOrder.value = order;
        }
    }

    function resetStreamSettings() {
        streamTimeout.value = 15000;
        streamRetryAttempts.value = 2;
        streamEnableFallback.value = true;
        streamEnableContentTypeSniffing.value = true;
        streamFallbackOrder.value = [
            StreamType.HLS,
            StreamType.DASH,
            StreamType.MPEGTS,
            StreamType.NATIVE
        ];
    }

    return {
        // Sidebar
        isSidebarCollapsed,
        toggleSidebar,
        collapseSidebar,
        expandSidebar,

        // Language
        selectedLanguage,
        setLanguage,

        // Stream Settings
        streamTimeout,
        streamRetryAttempts,
        streamEnableFallback,
        streamEnableContentTypeSniffing,
        streamFallbackOrder,
        streamConfig,
        setStreamTimeout,
        setStreamRetryAttempts,
        setStreamEnableFallback,
        setStreamEnableContentTypeSniffing,
        setStreamFallbackOrder,
        resetStreamSettings,
    };
});
