import { defineConfig } from '@playwright/test';

const projectRoot = __dirname;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 120000,
  use: {
    headless: true,
    baseURL: 'http://localhost:4310',
  },
  webServer: {
    command: 'pnpm vite --host --port 4310 --config vite.config.mts',
    cwd: projectRoot,
    url: 'http://localhost:4310',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
