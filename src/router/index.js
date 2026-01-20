import { createRouter, createWebHistory } from "vue-router";
import { useIptvStore } from "@/stores/iptv";

const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import("../views/Home.vue"),
    meta: { requiresConfig: true },
  },
  {
    path: "/setup/:id?",
    name: "Setup",
    component: () => import("../views/Setup.vue"),
  },
  {
    path: "/settings",
    name: "Settings",
    component: () => import("../views/Settings.vue"),
  },
  {
    path: "/about",
    name: "About",
    component: () => import("../views/About.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Navigation guard per verificare la configurazione
router.beforeEach((to, from, next) => {
  const iptvStore = useIptvStore();

  // Se la route richiede configurazione e non ci sono playlist, vai al setup
  if (to.meta.requiresConfig && !iptvStore.isConfigured) {
    if (to.name !== "Setup") {
      next({ name: "Setup" });
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;
