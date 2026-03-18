#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import jiti from 'jiti';
import {
  launchBrowserCertifier,
  repoRoot,
  snapshotFromEvaluateResult,
} from './_certifier-eval-helpers.mjs';

const require = jiti(import.meta.url, { interopDefault: true });
const { HOST_V1_HASH, HOST_V1_MANIFEST } = require(
  '../../../libs/abi-manifest/src/index.ts',
);
const { evaluate } = require('../../../libs/quickjs-runtime/src/index.ts');
const { createCertificationHost } = require('../src/shared/host.ts');

const propertySeedConfigPath = path.resolve(
  repoRoot,
  'apps/ecosystem-certifier/src/shared/fixtures/property-seed-config.json',
);
const defaultConfig = JSON.parse(await readFile(propertySeedConfigPath, 'utf8'));

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(repoRoot, args.outDir);
await mkdir(outDir, { recursive: true });

const browser = await launchBrowserCertifier(args.baseUrl);
const records = [];

try {
  for (let seed = args.seedStart; seed < args.seedStart + args.seedCount; seed += 1) {
    const certCase = createSeededCase(seed, args.gasLimit);
    const host = createCertificationHost();
    const nodeResult = await evaluate({
      program: certCase.program,
      input: {
        event: { type: 'ecosystem-certifier' },
        eventCanonical: { type: 'ecosystem-certifier' },
        steps: [],
        currentContract: { id: 'ecosystem-certifier' },
        currentContractCanonical: { id: { value: 'ecosystem-certifier' } },
      },
      gasLimit: BigInt(certCase.gasLimit),
      manifest: HOST_V1_MANIFEST,
      handlers: host.handlers,
      tape: { capacity: 16 },
    });
    const nodeSnapshot = snapshotFromEvaluateResult(nodeResult);
    const browserSnapshot = await browser.evaluateCaseSnapshot(
      certCase,
      certCase.gasLimit,
    );
    const match = JSON.stringify(nodeSnapshot) === JSON.stringify(browserSnapshot);
    records.push({
      seed,
      node: nodeSnapshot,
      browser: browserSnapshot,
      match,
    });
  }
} finally {
  await browser.close();
}

const mismatchCount = records.filter((record) => !record.match).length;
const output = {
  generatedAt: new Date().toISOString(),
  seedStart: args.seedStart,
  seedCount: args.seedCount,
  mismatchCount,
  records,
};
const outputPath = path.join(outDir, 'seeded-property-corpus-report.json');
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ outputPath, mismatchCount }, null, 2));
if (mismatchCount > 0) {
  process.exitCode = 1;
}

function createSeededCase(seed, gasLimit) {
  const code = [
    `let x = ${seed} >>> 0;`,
    'function rnd() {',
    '  x = ((x * 1664525) + 1013904223) >>> 0;',
    '  return x;',
    '}',
    'const values = [];',
    'for (let i = 0; i < 64; i += 1) values.push(rnd() % 10000);',
    'values.sort((a, b) => a - b);',
    '({',
    `  seed: ${seed},`,
    '  sum: values.reduce((total, value) => total + value, 0),',
    '  min: values[0],',
    '  max: values[values.length - 1],',
    '  checksum: values[3] ^ values[15] ^ values[31] ^ values[63],',
    '});',
  ].join('\n');

  return {
    id: `seed-${seed}`,
    title: `seed-${seed}`,
    kind: 'positive',
    gasLimit: String(gasLimit),
    manifest: HOST_V1_MANIFEST,
    program: {
      version: 2,
      abiId: 'Host.v1',
      abiVersion: 1,
      abiManifestHash: HOST_V1_HASH,
      executionProfile: 'compat-general-v1',
      sourceKind: 'script',
      source: { code },
    },
  };
}

function parseArgs(argv) {
  let outDir = 'artifacts/workload-certification';
  let baseUrl = null;
  let seedStart = defaultConfig.seedStart;
  let seedCount = defaultConfig.seedCount;
  let gasLimit = defaultConfig.gasLimit;
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
    if (arg === '--seed-start') {
      seedStart = Number(argv[index + 1] ?? seedStart);
      index += 1;
      continue;
    }
    if (arg === '--seed-count') {
      seedCount = Number(argv[index + 1] ?? seedCount);
      index += 1;
      continue;
    }
    if (arg === '--gas-limit') {
      gasLimit = Number(argv[index + 1] ?? gasLimit);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { outDir, baseUrl, seedStart, seedCount, gasLimit };
}
