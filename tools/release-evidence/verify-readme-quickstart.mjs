#!/usr/bin/env node

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const args = parseArgs(process.argv.slice(2));
const repoRoot = path.resolve(process.cwd());
const readmePath = path.join(repoRoot, 'README.md');
const readme = await readFile(readmePath, 'utf8');

const quickstartCommands = [
  'pnpm run setup',
  'pnpm verify',
  'pnpm evidence',
  'pnpm evidence:verify',
  'pnpm run playground',
];

const missingCommands = quickstartCommands.filter(
  (command) => !readme.includes(command),
);
if (missingCommands.length > 0) {
  throw new Error(
    `README quickstart is missing expected commands:\n${missingCommands.join('\n')}`,
  );
}

const tempRoot = await mkdtemp(
  path.join(args.tempRoot ?? os.tmpdir(), 'bluequickjs-quickstart-'),
);
const clonePath = path.join(tempRoot, 'repo');

try {
  run(
    'git',
    ['clone', '--depth', '1', repoRoot, clonePath],
    repoRoot,
  );

  if (!args.skipSetup) {
    run('pnpm', ['run', 'setup'], clonePath);
  }

  if (!args.skipVerify) {
    run('pnpm', ['verify'], clonePath);
  }

  if (!args.skipEvidence) {
    run('pnpm', ['evidence'], clonePath);
    run('pnpm', ['evidence:verify'], clonePath);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: 'ok',
        clonePath,
        skipped: {
          setup: args.skipSetup,
          verify: args.skipVerify,
          evidence: args.skipEvidence,
        },
      },
      null,
      2,
    )}\n`,
  );
} finally {
  if (!args.keepTemp) {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  let skipSetup = false;
  let skipVerify = false;
  let skipEvidence = false;
  let keepTemp = false;
  let tempRoot;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--skip-setup') {
      skipSetup = true;
      continue;
    }
    if (arg === '--skip-verify') {
      skipVerify = true;
      continue;
    }
    if (arg === '--skip-evidence') {
      skipEvidence = true;
      continue;
    }
    if (arg === '--keep-temp') {
      keepTemp = true;
      continue;
    }
    if (arg === '--temp-root') {
      tempRoot = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return {
    skipSetup,
    skipVerify,
    skipEvidence,
    keepTemp,
    tempRoot,
  };
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`command failed: ${command} ${args.join(' ')}`);
  }
}
