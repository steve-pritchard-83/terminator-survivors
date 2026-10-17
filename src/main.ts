import './style.css';
import { Game } from './core/Game';
import { ErrorReporter } from './core/ErrorReporter';
import { registerSW } from 'virtual:pwa-register';

// Install global error / unhandledrejection reporting
ErrorReporter.init();

window.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (!app) {
    throw new Error('Element #app not found in document');
  }

  // Register PWA service worker with auto-update prompt
  if ('serviceWorker' in navigator) {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[PWA] New version available.');
      },
      onOfflineReady() {
        console.log('[PWA] Terminator Survivors is ready for offline play.');
      }
    });
  }

  // Initialize Game Engine
  new Game(app);
});
