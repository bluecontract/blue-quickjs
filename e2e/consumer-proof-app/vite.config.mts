import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: [
      {
        // quickjs-wasm needs its built dist entry so import.meta.url resolves
        // against packaged wasm assets instead of raw source files.
        find: '@blue-quickjs/quickjs-wasm',
        replacement: path.resolve(
          import.meta.dirname,
          '..',
          '..',
          'libs',
          'quickjs-wasm',
          'dist',
          'index.js',
        ),
      },
      {
        // This app lives outside the pnpm workspace, so local Nx/Vite builds
        // need an explicit path back into repo source packages.
        find: /^@blue-quickjs\/(.+)$/,
        replacement:
          path.resolve(import.meta.dirname, '..', '..', 'libs') +
          '/$1/src/index.ts',
      },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 4320,
    strictPort: true,
    fs: {
      allow: [path.resolve(import.meta.dirname, '..', '..')],
    },
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
