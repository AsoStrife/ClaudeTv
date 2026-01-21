import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { ref, computed } from "vue";
import { httpFetchText } from "@/utils/httpClient";
import {
    parseM3U,
    groupChannelsByCategory,
    filterChannels,
} from "@/utils/m3uParser";

export const useIptvStore = defineStore("iptv", () => {
    // Stato persistito in localStorage
    const playlists = useLocalStorage("iptv/playlists", []);
    const activePlaylistId = useLocalStorage("iptv/activePlaylistId", null);
    const favoriteChannelIds = useLocalStorage("iptv/favoriteChannelIds", []);

    // Stato reattivo (non persistito)
    const channels = ref([]);
    const categories = ref([]);
    const selectedChannel = ref(null);
    const isLoading = ref(false);
    const error = ref(null);
    const searchQuery = ref("");
    const expandedCategories = ref([]);

    // ========================================
    // Cache per tipi di stream funzionanti (persistita)
    // ========================================
    const streamTypeCache = useLocalStorage("iptv/streamTypeCache", {});

    // Getters
    const channelsByCategory = computed(() => {
        const filtered = filterChannels(channels.value, searchQuery.value);
        const grouped = groupChannelsByCategory(filtered);

        // Aggiungi categoria preferiti se ci sono canali preferiti
        if (hasFavorites.value && !searchQuery.value) {
            const favChannels = channels.value.filter(channel =>
                favoriteChannelIds.value.includes(channel.id)
            );
            grouped['⭐ Preferiti'] = favChannels;
        }

        return grouped;
    });

    const totalChannels = computed(() => channels.value.length);

    const hasPlaylist = computed(() => channels.value.length > 0);

    const isConfigured = computed(() => {
        return playlists.value.length > 0;
    });

    const activePlaylist = computed(() => {
        return playlists.value.find(p => p.id === activePlaylistId.value) || null;
    });

    const filteredChannelsCount = computed(() => {
        return filterChannels(channels.value, searchQuery.value).length;
    });

    const favoriteChannels = computed(() => {
        return channels.value.filter(channel => favoriteChannelIds.value.includes(channel.id));
    });

    const hasFavorites = computed(() => favoriteChannels.value.length > 0);

    const visibleCategories = computed(() => {
        const cats = [];

        // Aggiungi "Preferiti" come prima categoria se ci sono preferiti
        if (!searchQuery.value && hasFavorites.value) {
            cats.push('⭐ Preferiti');
        }

        if (!searchQuery.value) {
            cats.push(...categories.value);
        } else {
            // Restituisce solo le categorie che hanno almeno un canale filtrato
            const filtered = Object.keys(channelsByCategory.value).filter(
                category => channelsByCategory.value[category]?.length > 0
            );
            cats.push(...filtered);
        }

        return cats;
    });

    // Helper function per costruire URL con parametri
    function buildPlaylistUrl(baseUrl, username, password, type, output) {
        try {
            const url = new URL(baseUrl);

            // Aggiungi username e password se presenti
            if (username && username.trim()) {
                url.searchParams.set('username', username.trim());
            }
            if (password && password.trim()) {
                url.searchParams.set('password', password.trim());
            }

            // Aggiungi type se specificato
            if (type && type.trim()) {
                url.searchParams.set('type', type.trim());
            }

            // Aggiungi output se specificato
            if (output && output.trim()) {
                url.searchParams.set('output', output.trim());
            }

            return url.toString();
        } catch (e) {
            // Se l'URL non è valido, ritorna l'originale
            return baseUrl;
        }
    }

    // Actions
    async function testPlaylistUrl(url, username, password, type, output) {
        const targetUrl = buildPlaylistUrl(url, username, password, type, output);

        if (!targetUrl) {
            error.value = "URL playlist non valido";
            return false;
        }

        isLoading.value = true;
        error.value = null;

        try {
            // Use Tauri HTTP client to bypass CORS
            const content = await httpFetchText(targetUrl);
            const result = parseM3U(content);

            if (result.channels.length === 0) {
                throw new Error("Nessun canale trovato nella playlist");
            }

            // Restituisci i risultati senza salvarli
            return { success: true, channels: result.channels, categories: result.categories };
        } catch (err) {
            error.value = err.message || "Errore nel caricamento della playlist";
            return { success: false, error: err.message || "Errore nel caricamento della playlist" };
        } finally {
            isLoading.value = false;
        }
    }

    async function loadPlaylist(playlistIdOrUrl = null) {
        let targetUrl;
        let id;

        let playlist = null;

        // Se è un URL diretto (inizia con http), usalo direttamente
        if (typeof playlistIdOrUrl === 'string' && playlistIdOrUrl.startsWith('http')) {
            targetUrl = playlistIdOrUrl;
            // Cerca la playlist per URL per trovare l'ID
            const existingPlaylist = playlists.value.find(p => p.url === targetUrl);
            id = existingPlaylist?.id || activePlaylistId.value;
            playlist = existingPlaylist;
        } else {
            // Altrimenti cerca per ID
            id = playlistIdOrUrl || activePlaylistId.value;
            playlist = playlists.value.find(p => p.id === id);

            if (!playlist) {
                error.value = "Playlist non trovata";
                return false;
            }

            // Costruisci l'URL con i parametri salvati
            targetUrl = buildPlaylistUrl(
                playlist.url,
                playlist.username,
                playlist.password,
                playlist.type,
                playlist.output
            );
        }

        if (!targetUrl) {
            error.value = "URL playlist non valido";
            return false;
        }

        isLoading.value = true;
        error.value = null;

        try {
            // Use Tauri HTTP client to bypass CORS
            const content = await httpFetchText(targetUrl);
            const result = parseM3U(content);

            if (result.channels.length === 0) {
                throw new Error("Nessun canale trovato nella playlist");
            }

            channels.value = result.channels;
            categories.value = result.categories;
            if (id) {
                activePlaylistId.value = id;
            }

            // Chiudi tutte le categorie di default quando si carica una playlist
            expandedCategories.value = [];

            error.value = null;
            return true;
        } catch (err) {
            error.value = err.message || "Errore nel caricamento della playlist";
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    function selectChannel(channel) {
        selectedChannel.value = channel;
    }

    function clearSelection() {
        selectedChannel.value = null;
    }

    function toggleCategory(category) {
        const index = expandedCategories.value.indexOf(category);
        if (index === -1) {
            expandedCategories.value.push(category);
        } else {
            expandedCategories.value.splice(index, 1);
        }
    }

    function isCategoryExpanded(category) {
        return expandedCategories.value.includes(category);
    }

    function expandAllCategories() {
        expandedCategories.value = [...categories.value];
    }

    function collapseAllCategories() {
        expandedCategories.value = [];
    }

    function setSearchQuery(query) {
        searchQuery.value = query;
    }

    // ========================================
    // Favorites Functions
    // ========================================

    function toggleFavorite(channelId) {
        const index = favoriteChannelIds.value.indexOf(channelId);
        if (index === -1) {
            favoriteChannelIds.value.push(channelId);
        } else {
            favoriteChannelIds.value.splice(index, 1);
        }
    }

    function isFavorite(channelId) {
        return favoriteChannelIds.value.includes(channelId);
    }

    function addToFavorites(channelId) {
        if (!favoriteChannelIds.value.includes(channelId)) {
            favoriteChannelIds.value.push(channelId);
        }
    }

    function removeFromFavorites(channelId) {
        const index = favoriteChannelIds.value.indexOf(channelId);
        if (index !== -1) {
            favoriteChannelIds.value.splice(index, 1);
        }
    }

    function clearFavorites() {
        favoriteChannelIds.value = [];
    }

    function clearPlaylist() {
        channels.value = [];
        categories.value = [];
        selectedChannel.value = null;
        searchQuery.value = "";
        expandedCategories.value = [];
    }

    function addPlaylist(name, url, username = "", password = "", type = "", output = "") {
        const newPlaylist = {
            id: Date.now().toString(),
            name,
            url,
            username,
            password,
            type,
            output,
            createdAt: new Date().toISOString(),
        };
        playlists.value.push(newPlaylist);
        return newPlaylist.id;
    }

    function updatePlaylist(id, data) {
        const index = playlists.value.findIndex(p => p.id === id);
        if (index !== -1) {
            playlists.value[index] = {
                ...playlists.value[index],
                ...data,
                updatedAt: new Date().toISOString(),
            };
            return true;
        }
        return false;
    }

    function deletePlaylist(id) {
        const index = playlists.value.findIndex(p => p.id === id);
        if (index !== -1) {
            playlists.value.splice(index, 1);
            // Se cancello la playlist attiva, pulisco tutto
            if (activePlaylistId.value === id) {
                activePlaylistId.value = null;
                clearPlaylist();
            }
            return true;
        }
        return false;
    }

    function setActivePlaylist(id) {
        activePlaylistId.value = id;
    }

    // ========================================
    // Stream Type Cache Functions
    // ========================================

    /**
     * Salva il tipo di stream funzionante per un URL
     */
    function cacheStreamType(url, streamType) {
        if (!url || !streamType) return;
        streamTypeCache.value[url] = {
            type: streamType,
            lastSuccess: new Date().toISOString(),
            attempts: (streamTypeCache.value[url]?.attempts || 0) + 1
        };
    }

    /**
     * Ottieni il tipo di stream cached per un URL
     */
    function getCachedStreamType(url) {
        if (!url) return null;
        const cached = streamTypeCache.value[url];
        if (cached) {
            return cached.type;
        }
        return null;
    }

    /**
     * Rimuovi un URL dalla cache
     */
    function removeCachedStreamType(url) {
        if (url && streamTypeCache.value[url]) {
            delete streamTypeCache.value[url];
        }
    }

    /**
     * Pulisci tutta la cache dei tipi di stream
     */
    function clearStreamTypeCache() {
        streamTypeCache.value = {};
    }

    /**
     * Ottieni statistiche sulla cache
     */
    function getStreamCacheStats() {
        const entries = Object.entries(streamTypeCache.value);
        const typeCount = {};
        entries.forEach(([url, data]) => {
            typeCount[data.type] = (typeCount[data.type] || 0) + 1;
        });
        return {
            totalCached: entries.length,
            byType: typeCount
        };
    }

    return {
        // State
        playlists,
        activePlaylistId,
        channels,
        categories,
        selectedChannel,
        isLoading,
        error,
        searchQuery,
        expandedCategories,
        streamTypeCache,
        favoriteChannelIds,

        // Getters
        channelsByCategory,
        totalChannels,
        hasPlaylist,
        isConfigured,
        activePlaylist,
        filteredChannelsCount,
        visibleCategories,
        favoriteChannels,
        hasFavorites,

        // Actions
        loadPlaylist,
        testPlaylistUrl,
        selectChannel,
        clearSelection,
        toggleCategory,
        isCategoryExpanded,
        expandAllCategories,
        collapseAllCategories,
        setSearchQuery,
        clearPlaylist,
        addPlaylist,
        updatePlaylist,
        deletePlaylist,
        setActivePlaylist,

        // Favorites
        toggleFavorite,
        isFavorite,
        addToFavorites,
        removeFromFavorites,
        clearFavorites,

        // Stream Cache
        cacheStreamType,
        getCachedStreamType,
        removeCachedStreamType,
        clearStreamTypeCache,
        getStreamCacheStats,
    };
});
