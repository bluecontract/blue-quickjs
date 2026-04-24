#!/usr/bin/env node

import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { PUBLIC_PACKAGES } from './public-packages.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const outDir = path.resolve(repoRoot, args.outDir);
await mkdir(outDir, { recursive: true });
for (const entry of await readdir(outDir)) {
  if (entry.endsWith('.tgz')) {
    await unlink(path.join(outDir, entry));
  }
}
const packageDirs = await loadWorkspacePackageDirs(repoRoot);

const records = [];
for (const pkg of PUBLIC_PACKAGES) {
  const packageDir = packageDirs.get(pkg);
  if (!packageDir) {
    throw new Error(`workspace package not found: ${pkg}`);
  }
  const packageJson = JSON.parse(
    await readFile(path.join(packageDir, 'package.json'), 'utf8'),
  );
  await run('pnpm', ['pack', '--pack-destination', outDir], packageDir);
  const filename = `${pkg.replace('@', '').replaceAll('/', '-')}-${packageJson.version}.tgz`;
  records.push({
    package: pkg,
    entries: [
      {
        name: packageJson.name,
        version: packageJson.version,
        filename: path.join(outDir, filename),
      },
    ],
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

async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: false,
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`command failed (${command} ${args.join(' ')})`));
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
