#!/usr/bin/env node

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const outDir = path.resolve(repoRoot, args.outDir);
const outputPath = path.join(outDir, 'sbom.cdx.json');

await mkdir(outDir, { recursive: true });

const run = spawnSync(
  'pnpm',
  ['ls', '--json', '--depth', 'Infinity'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    stdio: 'pipe',
  },
);

if (run.status !== 0) {
  throw new Error(`SBOM generation failed: ${run.stderr || run.stdout}`);
}

const parsed = JSON.parse(run.stdout);
const roots = Array.isArray(parsed) ? parsed : [parsed];
const componentMap = new Map();

for (const root of roots) {
  walkDependencies(root);
}

const components = [...componentMap.values()].sort((left, right) =>
  `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`),
);
const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: 'application',
      name: '@blue-quickjs/source',
      version: '0.0.0',
    },
    tools: [
      {
        vendor: 'blue-quickjs',
        name: 'custom-pnpm-sbom-generator',
      },
    ],
  },
  components,
};
await writeFile(outputPath, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');

process.stdout.write(
  `${JSON.stringify(
    {
      outputPath: path.relative(repoRoot, outputPath),
      componentCount: components.length,
    },
    null,
    2,
  )}\n`,
);

function walkDependencies(node) {
  if (!node || typeof node !== 'object') {
    return;
  }
  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    const dependencies = node[field];
    if (!dependencies || typeof dependencies !== 'object') {
      continue;
    }
    for (const [name, dependency] of Object.entries(dependencies)) {
      if (!dependency || typeof dependency !== 'object') {
        continue;
      }
      const version = dependency.version ?? '0.0.0';
      const key = `${name}@${version}`;
      if (!componentMap.has(key)) {
        componentMap.set(key, {
          type: 'library',
          name,
          version,
          purl: `pkg:npm/${encodeComponent(name)}@${version}`,
        });
      }
      walkDependencies(dependency);
    }
  }
}

function encodeComponent(name) {
  return encodeURIComponent(name).replace('%2F', '/');
}

function parseArgs(argv) {
  let outDir = 'artifacts/security';
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
