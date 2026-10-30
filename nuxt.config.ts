// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

// Validates the env vars when dev/build starts, and stops with the list of missing ones
import env from "./shared/lib/env";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  modules: [
    // Registered here so the project's @nuxt/fonts 1.x (needed by Nuxt SEO's og-image) is used, not Nuxt UI's 0.14
    "@nuxt/fonts",
    "@nuxt/ui",
    "@nuxt/image",
    "@nuxt/eslint",
    "motion-v/nuxt",
    "@nuxtjs/seo",
    "@nuxt/a11y",
  ],
  // Module Configuration
  site: {
    url: env.NUXT_SITE_URL,
    name: "TODO: site name",
    description: "TODO: one-sentence description",
    defaultLocale: "fr",
  },
  eslint: {
    config: {
      standalone: false,
    },
  },
});
