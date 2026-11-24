import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se reenvía al backend (Express, por defecto en el puerto 3000): mismo origen, sin CORS.
// Si el puerto está ocupado: API_URL=http://localhost:3100 npm run dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:3000' },
  },
});
