import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";

export const useUiStore = defineStore("ui", () => {
  // Stato sidebar (persistito)
  const isSidebarCollapsed = useLocalStorage("ui/sidebarCollapsed", false);

  // Actions
  function toggleSidebar() {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
  }

  function collapseSidebar() {
    isSidebarCollapsed.value = true;
  }

  function expandSidebar() {
    isSidebarCollapsed.value = false;
  }

  return {
    isSidebarCollapsed,
    toggleSidebar,
    collapseSidebar,
    expandSidebar,
  };
});
