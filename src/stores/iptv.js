import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";
import { ref, computed } from "vue";
import {
    parseM3U,
    groupChannelsByCategory,
    filterChannels,
} from "@/utils/m3uParser";

export const useIptvStore = defineStore("iptv", () => {
    // Stato persistito in localStorage
    const playlists = useLocalStorage("iptv/playlists", []);
    const activePlaylistId = useLocalStorage("iptv/activePlaylistId", null);

    // Stato reattivo (non persistito)
    const channels = ref([]);
    const categories = ref([]);
    const selectedChannel = ref(null);
    const isLoading = ref(false);
    const error = ref(null);
    const searchQuery = ref("");
    const expandedCategories = ref([]);

    // Getters
    const channelsByCategory = computed(() => {
        const filtered = filterChannels(channels.value, searchQuery.value);
        return groupChannelsByCategory(filtered);
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

    const visibleCategories = computed(() => {
        if (!searchQuery.value) {
            return categories.value;
        }
        // Restituisce solo le categorie che hanno almeno un canale filtrato
        return Object.keys(channelsByCategory.value).filter(
            category => channelsByCategory.value[category]?.length > 0
        );
    });

    // Actions
    async function loadPlaylist(playlistIdOrUrl = null) {
        let targetUrl;
        let id;

        // Se è un URL diretto (inizia con http), usalo direttamente
        if (typeof playlistIdOrUrl === 'string' && playlistIdOrUrl.startsWith('http')) {
            targetUrl = playlistIdOrUrl;
            // Cerca la playlist per URL per trovare l'ID
            const existingPlaylist = playlists.value.find(p => p.url === targetUrl);
            id = existingPlaylist?.id || activePlaylistId.value;
        } else {
            // Altrimenti cerca per ID
            id = playlistIdOrUrl || activePlaylistId.value;
            const playlist = playlists.value.find(p => p.id === id);

            if (!playlist) {
                error.value = "Playlist non trovata";
                return false;
            }
            targetUrl = playlist.url;
        }

        if (!targetUrl) {
            error.value = "URL playlist non valido";
            return false;
        }

        isLoading.value = true;
        error.value = null;

        try {
            const response = await fetch(targetUrl);

            if (!response.ok) {
                throw new Error(`Errore HTTP: ${response.status}`);
            }

            const content = await response.text();
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

    function clearPlaylist() {
        channels.value = [];
        categories.value = [];
        selectedChannel.value = null;
        searchQuery.value = "";
        expandedCategories.value = [];
    }

    function addPlaylist(name, url, username = "", password = "") {
        const newPlaylist = {
            id: Date.now().toString(),
            name,
            url,
            username,
            password,
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

        // Getters
        channelsByCategory,
        totalChannels,
        hasPlaylist,
        isConfigured,
        activePlaylist,
        filteredChannelsCount,
        visibleCategories,

        // Actions
        loadPlaylist,
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
    };
});
