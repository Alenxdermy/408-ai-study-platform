import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5174
  },
  preview: {
    host: '127.0.0.1',
    port: 4174
  },
  build: {
    outDir: '../dist/admin-web',
    emptyOutDir: true
  }
});
