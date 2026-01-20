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
  const playlistUrl = useLocalStorage("iptv/playlistUrl", "");
  const channels = useLocalStorage("iptv/channels", []);
  const categories = useLocalStorage("iptv/categories", []);

  // Stato reattivo (non persistito)
  const selectedChannel = ref(null);
  const isLoading = ref(false);
  const error = ref(null);
  const searchQuery = ref("");

  // Categorie espanse (persistito) - default vuoto
  const expandedCategories = useLocalStorage("iptv/expandedCategories", []);

  // Getters
  const channelsByCategory = computed(() => {
    const filtered = filterChannels(channels.value, searchQuery.value);
    return groupChannelsByCategory(filtered);
  });

  const totalChannels = computed(() => channels.value.length);

  const hasPlaylist = computed(() => channels.value.length > 0);

  const filteredChannelsCount = computed(() => {
    return filterChannels(channels.value, searchQuery.value).length;
  });

  // Actions
  async function loadPlaylist(url = null) {
    const targetUrl = url || playlistUrl.value;

    if (!targetUrl) {
      error.value = "Inserisci un URL valido";
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
      playlistUrl.value = targetUrl;

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

  return {
    // State
    playlistUrl,
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
    filteredChannelsCount,

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
  };
});
