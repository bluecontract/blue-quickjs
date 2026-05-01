/// <reference types='vitest' />
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/ecosystem-certifier',
  server: {
    port: 4310,
    host: 'localhost',
    fs: {
      allow: [path.resolve(import.meta.dirname, '..', '..', '..')],
    },
  },
  preview: {
    port: 4310,
    host: 'localhost',
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'ecosystem-certifier',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['tests/**'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
      all: true,
      include: ['src/shared/**/*.{ts,mts}'],
      exclude: [
        'src/shared/**/*.d.ts',
        'src/shared/**/*.{test,spec}.{ts,mts}',
        'src/shared/fixtures/**',
        'src/shared/fixtures.ts',
        'src/shared/hash.ts',
        'src/shared/host.ts',
        'src/shared/types.ts',
      ],
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 40,
        statements: 40,
      },
    },
  },
}));
