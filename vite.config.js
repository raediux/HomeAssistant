import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    headers: {
      'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws://localhost:* http://localhost:* https://vvowkcqeklvfgqlbevce.supabase.co wss://vvowkcqeklvfgqlbevce.supabase.co https://api.openweathermap.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Home Assistant',
        short_name: 'Home',
        description: 'Household dashboard',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0d0d0f',
        theme_color: '#0d0d0f',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/',
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
      },
    }),
  ],
})
