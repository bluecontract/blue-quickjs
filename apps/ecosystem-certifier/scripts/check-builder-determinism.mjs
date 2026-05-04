#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import jiti from 'jiti';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const require = jiti(import.meta.url, { interopDefault: true });
const {
  buildDeterministicModulePack,
} = require('../../../libs/deterministic-bundler/src/index.ts');
const { HOST_V1_HASH } = require('../../../libs/abi-manifest/src/index.ts');

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(repoRoot, args.outDir);
await mkdir(outDir, { recursive: true });

const fixtureSource = [
  'const values = [3, 1, 2];',
  'values.sort((a, b) => a - b);',
  'export default {',
  '  values,',
  "  joined: values.join(',')",
  '};',
  '',
].join('\n');

const tmpRoot = path.join(repoRoot, 'tmp', 'workload-certifier');
await mkdir(tmpRoot, { recursive: true });
const dirA = fs.mkdtempSync(path.join(tmpRoot, 'builder-det-a-'));
const dirB = fs.mkdtempSync(path.join(tmpRoot, 'builder-det-b-'));
await writeFixture(dirA, fixtureSource);
await writeFixture(dirB, fixtureSource);

const builtA = await buildDeterministicModulePack({
  absWorkingDir: dirA,
  entryPath: 'entry.ts',
  profile: 'compat-general-v1',
  emitProgramArtifact: true,
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
});
const builtB = await buildDeterministicModulePack({
  absWorkingDir: dirB,
  entryPath: 'entry.ts',
  profile: 'compat-general-v1',
  emitProgramArtifact: true,
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
});

const canonicalA = canonicalHash(builtA.modulePack);
const canonicalB = canonicalHash(builtB.modulePack);
const report = {
  generatedAt: new Date().toISOString(),
  fixtures: [
    {
      workingDir: dirA,
      graphHash: builtA.modulePack.graphHash,
      canonicalHash: canonicalA,
      moduleCount: builtA.modulePack.modules.length,
    },
    {
      workingDir: dirB,
      graphHash: builtB.modulePack.graphHash,
      canonicalHash: canonicalB,
      moduleCount: builtB.modulePack.modules.length,
    },
  ],
  checks: {
    graphHashEqual: builtA.modulePack.graphHash === builtB.modulePack.graphHash,
    canonicalHashEqual: canonicalA === canonicalB,
  },
};

const outputPath = path.join(outDir, 'builder-determinism-report.json');
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ outputPath, checks: report.checks }, null, 2));

if (!report.checks.graphHashEqual || !report.checks.canonicalHashEqual) {
  process.exitCode = 1;
}

async function writeFixture(targetDir, source) {
  await writeFile(path.join(targetDir, 'entry.ts'), source, 'utf8');
}

function canonicalHash(modulePack) {
  const payload = JSON.stringify({
    entrySpecifier: modulePack.entrySpecifier,
    entryExport: modulePack.entryExport,
    modules: modulePack.modules.map((module) => ({
      specifier: module.specifier,
      source: module.source,
      sourceMap: module.sourceMap ?? null,
    })),
  });
  return createHash('sha256').update(payload).digest('hex');
}

function parseArgs(argv) {
  let outDir = 'artifacts/workload-certification';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out-dir') {
      outDir = argv[i + 1] ?? outDir;
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { outDir };
}
