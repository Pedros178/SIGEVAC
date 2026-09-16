import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'SIGEVAC — Gestión de Voluntariado',
        short_name: 'SIGEVAC',
        description: 'Sistema Integral para la Gestión de Expedientes y Voluntariado',
        theme_color: '#36A9D6',
        background_color: '#F4FAFD',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precarga el "app shell" (JS/CSS/HTML) para que la aplicación
        // abra sin conexión. Las llamadas a la API NO se cachean aquí a
        // propósito: los datos de actividades se cachean explícitamente
        // en src/offline/cacheActividades.js, con control total sobre
        // cuándo se consideran válidos, en vez de dejar que un cache HTTP
        // genérico sirva respuestas desactualizadas sin que la app lo sepa.
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg}'],
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        enabled: false, // evita confusiones de caché durante `npm run dev`
      },
    }),
  ],
  build: {
    // El chunk "graficas" (recharts) supera el límite por defecto de 500 kB,
    // pero ya se carga de forma diferida (lazy) solo en el Dashboard — ver
    // src/pages/Dashboard.jsx — así que el aviso por defecto es ruido, no
    // una alerta real sobre el bundle inicial.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          graficas: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
