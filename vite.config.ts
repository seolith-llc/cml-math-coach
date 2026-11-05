/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'CML Math Coach — Grades 2 & 3',
        short_name: 'Math Coach',
        description: 'Practice Continental Math League style problems with a voice coach.',
        theme_color: '#3b5bdb',
        background_color: '#f8f9fc',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//],
        importScripts: ['push-sw.js'], // practice reminders (public/push-sw.js)
        runtimeCaching: [
          {
            // Premium voice clips: replay instantly and offline once heard.
            urlPattern: ({ url }) => url.pathname.endsWith('/api/tts'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'coach-voice',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] }
            }
          }
        ]
      }
    })
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] }
});
