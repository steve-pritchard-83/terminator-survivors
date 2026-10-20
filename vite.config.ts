import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import packageJson from './package.json';

let commitHash = 'f4b929d';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  // fallback
}

export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_E2E': JSON.stringify(process.env.VITE_E2E ?? ''),
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_HASH__: JSON.stringify(commitHash)
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'icons/favicon.png',
        'icons/favicon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'fonts/terminator-real-nfi.ttf',
        'fonts/terminator-real-nfi.otf',
        'audio/backgroundmusic.mp3'
      ],
      manifest: {
        name: 'Terminator Survivors: Los Angeles 2029 AD',
        short_name: 'T-Survivors',
        description:
          'Survive the 2029 AD Future War as Kyle Reese against Skynet Hunter-Killers and T-800 Endoskeletons.',
        theme_color: '#050d1a',
        background_color: '#050d1a',
        display: 'standalone',
        orientation: 'landscape',
        start_url: './',
        icons: [
          { src: 'icons/favicon.png', sizes: '64x64', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,otf,mp3}'],
        runtimeCaching: [
          {
            urlPattern: /\.wav$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'terminator-sfx-wav-cache',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    outDir: process.env.BUILD_OUT_DIR ?? 'dist',
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/three/')) {
            return 'three-vendor';
          }
          if (id.includes('src/graphics/environments/')) {
            return 'stage-environments';
          }
          if (id.includes('src/ui/CodexModal') || id.includes('src/data/lore')) {
            return 'codex';
          }
          if (id.includes('src/ui/SettingsPanel')) {
            return 'settings';
          }
        }
      }
    }
  }
});
