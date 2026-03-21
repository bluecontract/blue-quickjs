import { defineConfig } from '@playwright/test';

const projectRoot = __dirname;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 120000,
  use: {
    headless: true,
    baseURL: 'http://localhost:4325',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
  ],
  webServer: {
    command: 'pnpm vite --host --port 4325 --config vite.config.mts',
    cwd: projectRoot,
    url: 'http://localhost:4325',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
