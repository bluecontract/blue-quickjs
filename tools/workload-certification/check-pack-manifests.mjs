#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { PUBLIC_PACKAGES } from './public-packages.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const outDir = path.resolve(repoRoot, args.outDir);
await mkdir(outDir, { recursive: true });

const records = [];
for (const pkg of PUBLIC_PACKAGES) {
  const run = spawnSync(
    'pnpm',
    ['--filter', pkg, 'pack', '--json', '--pack-destination', outDir],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: process.env,
    },
  );
  if (run.status !== 0) {
    throw new Error(`pack --json failed for ${pkg}: ${run.stderr ?? run.stdout}`);
  }

  const raw = run.stdout.trim();
  const parsed = JSON.parse(raw);
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  records.push({
    package: pkg,
    entries,
  });
}

const manifest = {
  generatedAt: new Date().toISOString(),
  packageCount: PUBLIC_PACKAGES.length,
  records,
};
const manifestPath = path.join(outDir, 'pack-manifest.json');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

process.stdout.write(
  `${JSON.stringify(
    {
      outDir,
      manifestPath,
      packageCount: PUBLIC_PACKAGES.length,
    },
    null,
    2,
  )}\n`,
);

function parseArgs(argv) {
  let outDir = 'artifacts/consumer-proof/pack-manifests';
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
    throw new Error(`unknown argument: ${arg}`);
  }
  return { outDir };
}
