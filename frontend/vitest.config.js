import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config separada y mínima para pruebas: evita cargar vite-plugin-pwa
// (que genera el service worker) en el entorno de test, donde no aplica.
// setupFiles carga tanto los matchers de jest-dom (usados por los tests
// de componentes/páginas) como el polyfill de IndexedDB (usado por los
// tests del módulo offline).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
  },
});
