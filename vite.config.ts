import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo>/ — VITE_BASE sets that (the deploy workflow does it).
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  build: {
    // Firebase alone is ~650 kB minified; it has its own chunk, so the default 500 kB warning is noise.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Libraries change far less often than the app. In their own chunks, an update only
        // re-downloads the app code; the service worker keeps the unchanged vendor files.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase';
          if (/\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('/motion') || id.includes('/framer-motion/') || id.includes('/radix-ui/') || id.includes('/@radix-ui/') || id.includes('/@phosphor-icons/')) return 'ui';
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Custom service worker (src/sw.ts) = Workbox precache + FCM background handler.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false, // registered manually in src/lib/pwa.ts
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        // Archivo ships Vietnamese glyphs the app never shows; don't download them for offline use.
        globIgnores: ['**/*-vietnamese-*'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        // A fixed id keeps Android/Chrome treating every deploy as the same installed app.
        id: base,
        name: 'Mamūlāt',
        short_name: 'Mamūlāt',
        description: 'Track your daily mamoolaat — offline-first.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#e9e5dd',
        theme_color: '#e9e5dd',
        icons: [
          { src: 'icons/v3/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/v3/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/v3/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
});
