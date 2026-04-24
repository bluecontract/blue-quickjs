import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  server: {
    host: '127.0.0.1',
    port: 4320,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4320,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ['@blue-quickjs/quickjs-wasm'],
  },
});
