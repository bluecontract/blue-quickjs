#!/usr/bin/env node

import { HOST_V1_MANIFEST } from '@blue-quickjs/abi-manifest';
import { evaluate } from '@blue-quickjs/quickjs-runtime';
import { chromium, firefox, webkit } from '@playwright/test';
import { createServer } from 'vite';
import path from 'node:path';
import {
  appRoot,
  artifactPath,
  createInputEnvelope,
  oogBoundaryPath,
  readJson,
  writeJson,
} from './_helpers.mjs';
import { createConsumerHost } from './consumer-host.mjs';

const args = parseArgs(process.argv.slice(2));
const payload = await readJson(args.artifactPath ?? artifactPath);

const nodeBoundary = await searchBoundary({
  low: 1n,
  high: BigInt(args.maxGas),
  run: async (gasLimit) => {
    const host = createConsumerHost();
    const result = await evaluate({
      program: payload.artifact,
      input: createInputEnvelope(),
      gasLimit,
      manifest: HOST_V1_MANIFEST,
      handlers: host.handlers,
      tape: { capacity: 32 },
    });
    return result.ok;
  },
});

const viteServer = await createServer({
  configFile: path.join(appRoot, 'vite.config.mts'),
  clearScreen: false,
});
await viteServer.listen();
const browserType = resolveBrowserType(args.browser);
const browser = await browserType.launch({ headless: true });
const context = await browser.newContext({ baseURL: args.baseUrl });

let browserBoundary;
try {
  const page = await context.newPage();
  await page.addInitScript((artifact) => {
    window.__CONSUMER_ARTIFACT__ = artifact;
  }, payload.artifact);
  await page.goto('/');
  await page.waitForFunction(() => typeof window.__runConsumerEvaluation === 'function');

  browserBoundary = await searchBoundary({
    low: 1n,
    high: BigInt(args.maxGas),
    run: async (gasLimit) =>
      page.evaluate(async (value) => {
        const result = await window.__runConsumerEvaluation?.(String(value));
        return result?.stage === 'success';
      }, gasLimit.toString()),
  });
} finally {
  await context.close();
  await browser.close();
  await viteServer.close();
}

const parity = {
  firstSuccessEqual:
    nodeBoundary.firstSuccessGas.toString() === browserBoundary.firstSuccessGas.toString(),
  lastFailureEqual:
    nodeBoundary.lastFailureGas.toString() === browserBoundary.lastFailureGas.toString(),
};

const report = {
  generatedAt: new Date().toISOString(),
  browser: args.browser,
  node: {
    firstSuccessGas: nodeBoundary.firstSuccessGas.toString(),
    lastFailureGas: nodeBoundary.lastFailureGas.toString(),
  },
  browser: {
    firstSuccessGas: browserBoundary.firstSuccessGas.toString(),
    lastFailureGas: browserBoundary.lastFailureGas.toString(),
  },
  parity,
};

await writeJson(oogBoundaryPath, report);
console.log(JSON.stringify({ oogBoundaryPath, parity, report }, null, 2));

if (!parity.firstSuccessEqual || !parity.lastFailureEqual) {
  process.exitCode = 1;
}

async function searchBoundary({ low, high, run }) {
  let left = low;
  let right = high;
  const rightSuccess = await run(right);
  if (!rightSuccess) {
    throw new Error(
      `max gas ${high.toString()} is still OOG; increase --max-gas to locate boundary`,
    );
  }

  while (left + 1n < right) {
    const mid = (left + right) / 2n;
    const ok = await run(mid);
    if (ok) {
      right = mid;
    } else {
      left = mid;
    }
  }
  return {
    lastFailureGas: left,
    firstSuccessGas: right,
  };
}

function parseArgs(argv) {
  let maxGas = '2000000';
  let artifact = null;
  let baseUrl = 'http://127.0.0.1:4320';
  let browser = 'chromium';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--max-gas') {
      maxGas = argv[index + 1] ?? maxGas;
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
  return { maxGas, artifactPath: artifact, baseUrl, browser };
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
