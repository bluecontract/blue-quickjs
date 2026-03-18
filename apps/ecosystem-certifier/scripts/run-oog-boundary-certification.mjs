#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  buildRunnableCasesByIds,
  launchBrowserCertifier,
  evaluateCaseNode,
  repoRoot,
} from './_certifier-eval-helpers.mjs';

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(repoRoot, args.outDir);
await mkdir(outDir, { recursive: true });

const fixtureIds = args.fixtureIds ?? [
  'flagship-knowledge-pack',
  'green-chess',
  'green-semver',
  'green-markdown-it',
  'green-stress-corpus',
];

const cases = await buildRunnableCasesByIds(fixtureIds);
const browser = await launchBrowserCertifier(args.baseUrl);
const boundaries = [];

try {
  for (const certCase of cases) {
    const maxGas = BigInt(certCase.gasLimit);
    const nodeBoundary = await searchBoundary({
      low: 1n,
      high: maxGas,
      runSuccess: async (gasLimit) => {
        const snapshot = await evaluateCaseNode(certCase, gasLimit.toString());
        return snapshot.stage === 'success';
      },
    });

    const browserBoundary = await searchBoundary({
      low: 1n,
      high: maxGas,
      runSuccess: async (gasLimit) => {
        const snapshot = await browser.evaluateCaseSnapshot(
          certCase,
          gasLimit.toString(),
        );
        return snapshot.stage === 'success';
      },
    });

    boundaries.push({
      id: certCase.id,
      title: certCase.title,
      node: {
        firstSuccessGas: nodeBoundary.firstSuccessGas.toString(),
        lastFailureGas: nodeBoundary.lastFailureGas.toString(),
      },
      browser: {
        firstSuccessGas: browserBoundary.firstSuccessGas.toString(),
        lastFailureGas: browserBoundary.lastFailureGas.toString(),
      },
      parity: {
        firstSuccessEqual:
          nodeBoundary.firstSuccessGas.toString() ===
          browserBoundary.firstSuccessGas.toString(),
        lastFailureEqual:
          nodeBoundary.lastFailureGas.toString() ===
          browserBoundary.lastFailureGas.toString(),
      },
    });
  }
} finally {
  await browser.close();
}

const mismatchCount = boundaries.filter(
  (entry) => !entry.parity.firstSuccessEqual || !entry.parity.lastFailureEqual,
).length;
const output = {
  generatedAt: new Date().toISOString(),
  fixtureCount: boundaries.length,
  mismatchCount,
  boundaries,
};
const outputPath = path.join(outDir, 'oog-boundaries.json');
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ outputPath, mismatchCount }, null, 2));
if (mismatchCount > 0) {
  process.exitCode = 1;
}

async function searchBoundary({ low, high, runSuccess }) {
  let left = low;
  let right = high;
  const highSuccess = await runSuccess(right);
  if (!highSuccess) {
    throw new Error(
      `upper bound ${high.toString()} failed; increase gas limit in fixture`,
    );
  }

  while (left + 1n < right) {
    const mid = (left + right) / 2n;
    const ok = await runSuccess(mid);
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
  let outDir = 'artifacts/workload-certification';
  let baseUrl = null;
  let fixtureIds = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out-dir') {
      outDir = argv[index + 1] ?? outDir;
      index += 1;
      continue;
    }
    if (arg === '--base-url') {
      baseUrl = argv[index + 1] ?? baseUrl;
      index += 1;
      continue;
    }
    if (arg === '--fixtures') {
      fixtureIds = (argv[index + 1] ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { outDir, baseUrl, fixtureIds };
}
