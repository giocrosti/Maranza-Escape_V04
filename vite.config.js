import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Percorsi relativi: il gioco deve funzionare anche pubblicato in una
  // sottocartella (GitHub Pages), non solo nella radice di un dominio.
  base: './',

  build: {
    // Safari 16.4 e' il minimo su cui gira PixiJS v8 con WebGPU. Non si scende
    // sotto: sotto quella soglia manca anche il resto (Array.at, ecc.).
    target: ['es2022', 'safari16'],
    sourcemap: true,
  },

  server: {
    host: '127.0.0.1',
    port: 5173,
  },

  plugins: [
    VitePWA({
      // Il manifest sta in public/manifest.json ed e' scritto a mano: i test
      // lo controllano li'. Il plugin non deve generarne un altro.
      manifest: false,
      injectRegister: null, // la registrazione la fa src/main.js, e solo in rete
      filename: 'sw.js',
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,webmanifest}'],
        // Il bundle di PixiJS supera il tetto di due mega di default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // In sviluppo il service worker terrebbe in cache i file mentre li si
        // modifica: e' esattamente il problema che si vuole evitare.
        enabled: false,
      },
    }),
  ],
});
