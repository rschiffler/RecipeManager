import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { astryxStylex } from '@astryxdesign/build/vite';

export default defineConfig({
  // Served by Express under /ui (see root index.ts).
  base: '/ui/',
  plugins: [...astryxStylex(), react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
