import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      // Proxy al API en Render (no local). Permite probar el frontend con datos
      // reales sin levantar la API local. Para usar API local: cambiar a 'http://localhost:3002'.
      '/api': {
        target: 'https://bochile-dashboard-api.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
