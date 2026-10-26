import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5273, strictPort: true, proxy: { '/api': 'http://localhost:4100', '/socket.io': { target: 'http://localhost:4100', ws: true } } },
});
