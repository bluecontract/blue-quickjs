#!/usr/bin/env node

import { chromium, firefox, webkit } from '@playwright/test';
import { createServer } from 'vite';
import path from 'node:path';
import {
  appRoot,
  artifactPath,
  browserResultPath,
  readJson,
  writeJson,
} from './_helpers.mjs';

const args = parseArgs(process.argv.slice(2));
const payload = await readJson(args.artifactPath ?? artifactPath);

const viteServer = await createServer({
  configFile: path.join(appRoot, 'vite.config.mts'),
  clearScreen: false,
});
await viteServer.listen();

const browserType = resolveBrowserType(args.browser);
const browser = await browserType.launch({ headless: true });
const context = await browser.newContext({ baseURL: args.baseUrl });
try {
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`[browser-console] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    console.error(`[browser-pageerror] ${error.message}`);
  });
  await page.addInitScript(
    ({ artifact }) => {
      window.__CONSUMER_ARTIFACT__ = artifact;
    },
    { artifact: payload.artifact },
  );
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__runConsumerEvaluation === 'function',
    undefined,
    {
      timeout: 120000,
    },
  );
  const snapshot = await page.evaluate((gasLimit) => {
    if (!window.__runConsumerEvaluation) {
      throw new Error('window.__runConsumerEvaluation is not available');
    }
    return window.__runConsumerEvaluation(gasLimit);
  }, args.gasLimit);

  await page.waitForFunction(() => Boolean(window.__CONSUMER_RESULT__), undefined, {
    timeout: 120000,
  });
  await writeJson(browserResultPath, {
    generatedAt: new Date().toISOString(),
    browser: args.browser,
    gasLimit: args.gasLimit,
    snapshot,
  });
  console.log(JSON.stringify({ browserResultPath, snapshot }, null, 2));
} finally {
  await context.close();
  await browser.close();
  await viteServer.close();
}

function parseArgs(argv) {
  let gasLimit = '1000000';
  let artifact = null;
  let baseUrl = 'http://127.0.0.1:4320';
  let browser = 'chromium';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--gas-limit') {
      gasLimit = argv[index + 1] ?? gasLimit;
      index += 1;
      continue;
    }
    if (arg === '--artifact') {
      artifact = argv[index + 1] ?? artifact;
      index += 1;
      continue;
    }
    if (arg === '--base-url') {
      baseUrl = argv[index + 1] ?? baseUrl;
      index += 1;
      continue;
    }
    if (arg === '--browser') {
      browser = argv[index + 1] ?? browser;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { gasLimit, artifactPath: artifact, baseUrl, browser };
}

function resolveBrowserType(browserName) {
  if (browserName === 'chromium') {
    return chromium;
  }
  if (browserName === 'firefox') {
    return firefox;
  }
  if (browserName === 'webkit') {
    return webkit;
  }
  throw new Error(`unsupported browser: ${browserName}`);
}
