#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  buildRunnableCasesByIds,
  evaluateCaseNode,
  launchBrowserCertifier,
  repoRoot,
} from './_certifier-eval-helpers.mjs';

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(repoRoot, args.outDir);
await mkdir(outDir, { recursive: true });

const fixtures = args.fixtureIds ?? [
  'flagship-knowledge-pack',
  'green-semver',
  'green-markdown-it',
  'green-stress-corpus',
];
const runnableCases = await buildRunnableCasesByIds(fixtures);
const browser = await launchBrowserCertifier(args.baseUrl, args.browser);

const records = [];
try {
  for (const certCase of runnableCases) {
    const iterations =
      certCase.id === 'flagship-knowledge-pack'
        ? args.flagshipIterations
        : args.iterations;

    const nodeBaseline = await evaluateCaseNode(certCase, certCase.gasLimit);
    const browserBaseline = await browser.evaluateCaseSnapshot(
      certCase,
      certCase.gasLimit,
    );

    let nodeDriftCount = 0;
    let browserDriftCount = 0;
    let crossParityDriftCount =
      JSON.stringify(nodeBaseline) === JSON.stringify(browserBaseline) ? 0 : 1;

    for (let run = 1; run < iterations; run += 1) {
      const nodeSnapshot = await evaluateCaseNode(certCase, certCase.gasLimit);
      const browserSnapshot = await browser.evaluateCaseSnapshot(
        certCase,
        certCase.gasLimit,
      );
      if (JSON.stringify(nodeSnapshot) !== JSON.stringify(nodeBaseline)) {
        nodeDriftCount += 1;
      }
      if (JSON.stringify(browserSnapshot) !== JSON.stringify(browserBaseline)) {
        browserDriftCount += 1;
      }
      if (JSON.stringify(nodeSnapshot) !== JSON.stringify(browserSnapshot)) {
        crossParityDriftCount += 1;
      }
    }

    records.push({
      id: certCase.id,
      title: certCase.title,
      iterations,
      baseline: {
        node: nodeBaseline,
        browser: browserBaseline,
      },
      drift: {
        nodeDriftCount,
        browserDriftCount,
        crossParityDriftCount,
      },
      stable:
        nodeDriftCount === 0 &&
        browserDriftCount === 0 &&
        crossParityDriftCount === 0,
    });
  }
} finally {
  await browser.close();
}

const unstableCount = records.filter((record) => !record.stable).length;
const output = {
  generatedAt: new Date().toISOString(),
  browser: args.browser,
  fixtureCount: records.length,
  unstableCount,
  records,
};
const outputPath = path.join(outDir, 'repeatability-report.json');
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ outputPath, unstableCount }, null, 2));
if (unstableCount > 0) {
  process.exitCode = 1;
}

function parseArgs(argv) {
  let outDir = 'artifacts/workload-certification';
  let baseUrl = null;
  let iterations = 50;
  let flagshipIterations = 20;
  let fixtureIds = null;
  let browser = 'chromium';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
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
    if (arg === '--iterations') {
      iterations = Number(argv[index + 1] ?? iterations);
      index += 1;
      continue;
    }
    if (arg === '--flagship-iterations') {
      flagshipIterations = Number(argv[index + 1] ?? flagshipIterations);
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
    if (arg === '--browser') {
      browser = argv[index + 1] ?? browser;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return {
    outDir,
    baseUrl,
    iterations,
    flagshipIterations,
    fixtureIds,
    browser,
  };
}
