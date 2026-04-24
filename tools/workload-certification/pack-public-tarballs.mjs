#!/usr/bin/env node

import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { PUBLIC_PACKAGES } from './public-packages.mjs';

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(repoRoot, args.outDir);
await mkdir(outDir, { recursive: true });
for (const entry of await readdir(outDir)) {
  if (entry.endsWith('.tgz')) {
    await unlink(path.join(outDir, entry));
  }
}

const packages = PUBLIC_PACKAGES;
const packageDirs = await loadWorkspacePackageDirs(repoRoot);

for (const pkg of packages) {
  const packageDir = packageDirs.get(pkg);
  if (!packageDir) {
    throw new Error(`workspace package not found: ${pkg}`);
  }
  await run(
    'pnpm',
    ['pack', '--pack-destination', outDir],
    packageDir,
  );
}

const tarballs = await listTarballs(outDir);
const manifest = {
  generatedAt: new Date().toISOString(),
  outDir,
  packages,
  tarballs,
};
const manifestPath = path.join(outDir, 'tarball-manifest.json');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ outDir, manifestPath, count: tarballs.length }, null, 2));

async function listTarballs(directory) {
  const entries = await readdir(directory);
  return entries.filter((entry) => entry.endsWith('.tgz')).sort();
}

async function run(command, argsList, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, argsList, {
      cwd,
      stdio: 'inherit',
      shell: false,
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`command failed (${command} ${argsList.join(' ')}): ${code}`));
    });
  });
}

async function loadWorkspacePackageDirs(rootDir) {
  const packageDirs = new Map();
  for (const scope of ['apps', 'libs', 'tools']) {
    const scopeDir = path.join(rootDir, scope);
    const entries = await readdir(scopeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const packageJsonPath = path.join(scopeDir, entry.name, 'package.json');
      try {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
        if (typeof packageJson.name === 'string') {
          packageDirs.set(packageJson.name, path.dirname(packageJsonPath));
        }
      } catch {
        // Ignore entries that are not workspace packages.
      }
    }
  }
  return packageDirs;
}

function parseArgs(argv) {
  let outDir = 'artifacts/consumer-proof/tarballs';
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
