/// <reference types='vitest' />
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(dirname, '../..');

export default defineConfig(() => ({
  root: dirname,
  cacheDir: '../../node_modules/.vite/libs/blue-documents',
  plugins: [],
  resolve: {
    alias: {
      '@blue-quickjs/abi-manifest': path.join(
        workspaceRoot,
        'libs/abi-manifest/src/index.ts',
      ),
      '@blue-quickjs/deterministic-builder': path.join(
        workspaceRoot,
        'libs/deterministic-builder/src/index.ts',
      ),
      '@blue-quickjs/deterministic-bundler': path.join(
        workspaceRoot,
        'libs/deterministic-bundler/src/index.ts',
      ),
      '@blue-quickjs/execution-profiles': path.join(
        workspaceRoot,
        'libs/execution-profiles/src/index.ts',
      ),
      '@blue-quickjs/quickjs-runtime': path.join(
        workspaceRoot,
        'libs/quickjs-runtime/src/index.ts',
      ),
    },
  },
  test: {
    name: 'blue-documents',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
