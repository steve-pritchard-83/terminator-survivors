import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'icons/favicon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'fonts/terminator-real-nfi.ttf',
        'fonts/terminator-real-nfi.otf',
        'audio/backgroundmusic.mp3',
        'audio/effects/S_PlasmaShot01.wav',
        'audio/effects/S_PlasmaShot02.wav',
        'audio/effects/S_Plasma_Aerial_New01.wav',
        'audio/effects/S_LaserTank01.wav',
        'audio/effects/S_Ithica01.wav',
        'audio/effects/Shotgun_shot_spas.wav',
        'audio/effects/S_Explosion01.wav',
        'audio/effects/plasma_explosion.wav',
        'audio/effects/S_BulletHitMetal01.wav',
        'audio/effects/S_BulletHitMetal02.wav',
        'audio/effects/hk_heavy1a_m.wav',
        'audio/effects/S_Swing01.wav',
        'audio/effects/S_BulletHitBody01.wav'
      ],
      manifest: {
        name: 'Terminator Survivors: Los Angeles 2029 AD',
        short_name: 'T-Survivors',
        description: 'Survive the 2029 AD Future War as Kyle Reese against Skynet Hunter-Killers and T-800 Endoskeletons.',
        theme_color: '#050d1a',
        background_color: '#050d1a',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,otf,mp3}']
      }
    })
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200
  }
});
