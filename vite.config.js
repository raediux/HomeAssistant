import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      base: '/HomeAssistant/',
      scope: '/HomeAssistant/',
      manifest: {
        name: 'Home Assistant',
        short_name: 'Home',
        description: 'Household dashboard',
        start_url: '/HomeAssistant/',
        scope: '/HomeAssistant/',
        display: 'standalone',
        background_color: '#0d0d0f',
        theme_color: '#0d0d0f',
        icons: [
          {
            src: '/HomeAssistant/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/HomeAssistant/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/HomeAssistant/',
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
  base: '/HomeAssistant/',
})
