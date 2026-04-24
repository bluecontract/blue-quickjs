#!/usr/bin/env node

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const appRoot = path.resolve(import.meta.dirname, '..');
const args = parseArgs(process.argv.slice(2));
const tarballDir = path.resolve(appRoot, args.tarballDir);
const entries = await readdir(tarballDir);
const tarballs = entries
  .filter((entry) => entry.endsWith('.tgz'))
  .filter((entry) => !entry.includes('deterministic-builder'))
  .map((entry) => path.join(tarballDir, entry))
  .sort();

if (tarballs.length === 0) {
  throw new Error(`no .tgz files found in ${tarballDir}`);
}

await run('npm', ['install', '--no-fund', '--no-audit'], appRoot);
await run(
  'npm',
  ['install', '--no-save', '--no-fund', '--no-audit', ...tarballs],
  appRoot,
);

console.log(
  JSON.stringify({ tarballDir, installed: tarballs.length }, null, 2),
);

function parseArgs(argv) {
  let tarballDir = '../../artifacts/consumer-proof/tarballs';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--tarball-dir') {
      tarballDir = argv[index + 1] ?? tarballDir;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { tarballDir };
}

async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`command failed (${command} ${args.join(' ')})`));
    });
  });
}
