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
  'pnpm install',
  'bash tools/scripts/setup-emsdk.sh',
  'source tools/emsdk/emsdk_env.sh',
  'pnpm exec playwright install --with-deps chromium',
  'pnpm nx test smoke-node',
  'pnpm nx run smoke-web:e2e',
  'node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs --out-dir artifacts/reproducibility-consensus',
  'node apps/ecosystem-certifier/scripts/archive-workload-certification-report.mjs --out-dir artifacts/workload-certification',
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
    ['clone', '--depth', '1', '--recurse-submodules', repoRoot, clonePath],
    repoRoot,
  );

  if (!args.skipInstall) {
    run('pnpm', ['install'], clonePath);
  }
  if (!args.skipEmsdkSetup) {
    run('bash', ['tools/scripts/setup-emsdk.sh'], clonePath);
  }

  if (!args.skipBrowserTasks) {
    run('pnpm', ['exec', 'playwright', 'install', '--with-deps', 'chromium'], clonePath);
  }

  if (!args.skipSmokeTests) {
    runBash(
      'source tools/emsdk/emsdk_env.sh && pnpm nx test smoke-node',
      clonePath,
    );

    if (!args.skipBrowserTasks) {
      runBash(
        'source tools/emsdk/emsdk_env.sh && pnpm nx run smoke-web:e2e',
        clonePath,
      );
    }
  }

  if (!args.skipEvidence) {
    runBash(
      'source tools/emsdk/emsdk_env.sh && node tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs --out-dir artifacts/reproducibility-consensus',
      clonePath,
    );
    runBash(
      'source tools/emsdk/emsdk_env.sh && node apps/ecosystem-certifier/scripts/archive-workload-certification-report.mjs --out-dir artifacts/workload-certification',
      clonePath,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: 'ok',
        clonePath,
        skipped: {
          emsdkSetup: args.skipEmsdkSetup,
          install: args.skipInstall,
          browserTasks: args.skipBrowserTasks,
          smokeTests: args.skipSmokeTests,
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
  let skipEmsdkSetup = false;
  let skipInstall = false;
  let skipBrowserTasks = false;
  let skipSmokeTests = false;
  let skipEvidence = false;
  let keepTemp = false;
  let tempRoot;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--skip-install') {
      skipInstall = true;
      continue;
    }
    if (arg === '--skip-emsdk-setup') {
      skipEmsdkSetup = true;
      continue;
    }
    if (arg === '--skip-smoke-tests') {
      skipSmokeTests = true;
      continue;
    }
    if (arg === '--skip-browser-tasks') {
      skipBrowserTasks = true;
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
    skipInstall,
    skipEmsdkSetup,
    skipBrowserTasks,
    skipSmokeTests,
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

function runBash(command, cwd) {
  run('bash', ['-lc', command], cwd);
}
