#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { URL } from 'node:url';
import { PUBLIC_PACKAGES } from './public-packages.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const outDir = path.resolve(repoRoot, args.outDir);
const consumerAppDir = path.resolve(repoRoot, 'e2e/consumer-proof-app');
const registryStoragePath = path.resolve(repoRoot, 'tmp/local-registry/storage');
const listenAddress = resolveListenAddress(args.registryUrl);

await rm(registryStoragePath, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const registryProcess = spawn(
  'pnpm',
  [
    'exec',
    'verdaccio',
    '--config',
    '.verdaccio/config.yml',
    '--listen',
    listenAddress,
  ],
  {
    cwd: repoRoot,
    stdio: 'pipe',
  },
);
let registryStdout = '';
let registryStderr = '';
registryProcess.stdout.on('data', (chunk) => {
  registryStdout += chunk.toString();
});
registryProcess.stderr.on('data', (chunk) => {
  registryStderr += chunk.toString();
});

try {
  await waitForRegistry(args.registryUrl, args.registryTimeoutMs);

  run(
    'pnpm',
    [
      'dlx',
      'npm-cli-login',
      '-u',
      'ci-user',
      '-p',
      'ci-password',
      '-e',
      'ci@example.com',
      '-r',
      args.registryUrl,
    ],
    repoRoot,
  );

  run(
    'pnpm',
    [
      'nx',
      'run-many',
      '-t',
      'build',
      '-p',
      'dv,abi-manifest,execution-profiles,quickjs-wasm-constants,quickjs-runtime,deterministic-bundler',
    ],
    repoRoot,
  );

  const packageVersions = await resolvePublicPackageVersions(repoRoot);
  const publishResults = [];
  for (const pkg of PUBLIC_PACKAGES) {
    const publish = run(
      'pnpm',
      [
        '--filter',
        pkg,
        'publish',
        '--registry',
        args.registryUrl,
        '--no-git-checks',
        '--access',
        'public',
        '--tag',
        'rc',
        '--force',
      ],
      repoRoot,
    );
    publishResults.push({
      package: pkg,
      version: packageVersions.get(pkg),
      command: publish.command,
      exitCode: publish.exitCode,
    });
  }

  run('npm', ['install', '--no-fund', '--no-audit'], consumerAppDir);
  run(
    'npm',
    ['remove', '--no-save', ...PUBLIC_PACKAGES],
    consumerAppDir,
    { allowFailure: true },
  );
  run(
    'npm',
    [
      'install',
      '--no-save',
      '--force',
      '--no-fund',
      '--no-audit',
      '--registry',
      args.registryUrl,
      ...PUBLIC_PACKAGES.map((pkg) => `${pkg}@${packageVersions.get(pkg)}`),
    ],
    consumerAppDir,
  );

  if (!args.skipPlaywrightInstall) {
    run(
      'pnpm',
      ['--dir', 'e2e/consumer-proof-app', 'exec', 'playwright', 'install', '--with-deps', 'chromium'],
      repoRoot,
    );
  }

  run(
    'pnpm',
    ['--dir', 'e2e/consumer-proof-app', 'run', 'repro', '--', '--browser', 'chromium'],
    repoRoot,
  );

  const reproReportPath = path.join(
    consumerAppDir,
    'reports',
    'reproducibility-report.json',
  );
  const reproReport = JSON.parse(await readFile(reproReportPath, 'utf8'));

  const output = {
    generatedAt: new Date().toISOString(),
    registryUrl: args.registryUrl,
    packageCount: PUBLIC_PACKAGES.length,
    publishedPackages: publishResults,
    consumerReportPath: path.relative(repoRoot, reproReportPath),
    consumerParity: reproReport.parity ?? null,
  };

  const outputPath = path.join(outDir, 'verdaccio-publish-rehearsal.json');
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outDir, 'verdaccio-stdout.log'), registryStdout, 'utf8');
  await writeFile(path.join(outDir, 'verdaccio-stderr.log'), registryStderr, 'utf8');

  process.stdout.write(
    `${JSON.stringify(
      {
        outputPath: path.relative(repoRoot, outputPath),
        registryUrl: args.registryUrl,
        consumerParity: output.consumerParity,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  if (!registryProcess.killed) {
    registryProcess.kill('SIGTERM');
  }
  await waitForExit(registryProcess, 5000);
  run('npm', ['config', 'set', 'registry', 'https://registry.npmjs.org/'], repoRoot, {
    allowFailure: true,
  });
  run('npm', ['config', 'delete', '//127.0.0.1:4873/:_authToken'], repoRoot, {
    allowFailure: true,
  });
}

async function resolvePublicPackageVersions(repoRootPath) {
  const versionMap = new Map();
  for (const pkg of PUBLIC_PACKAGES) {
    const packageJsonPath = path.resolve(
      repoRootPath,
      'libs',
      pkg.replace('@blue-quickjs/', ''),
      'package.json',
    );
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    versionMap.set(pkg, packageJson.version);
  }
  return versionMap;
}

async function waitForRegistry(registryUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${registryUrl}/-/ping`);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore while waiting
    }
    await sleep(500);
  }
  throw new Error(`verdaccio did not become ready within ${timeoutMs}ms`);
}

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    input: options.input,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `command failed (${command} ${args.join(' ')}): ${result.stderr ?? result.stdout}`,
    );
  }
  return {
    command: `${command} ${args.join(' ')}`,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function waitForExit(child, timeoutMs) {
  await Promise.race([
    new Promise((resolve) => {
      child.once('exit', () => resolve(undefined));
    }),
    sleep(timeoutMs),
  ]);
}

function parseArgs(argv) {
  const parsed = {
    outDir: 'artifacts/consumer-proof/verdaccio',
    registryUrl: 'http://127.0.0.1:4873',
    registryTimeoutMs: 60000,
    skipPlaywrightInstall: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--out-dir') {
      parsed.outDir = argv[index + 1] ?? parsed.outDir;
      index += 1;
      continue;
    }
    if (arg === '--registry-url') {
      parsed.registryUrl = argv[index + 1] ?? parsed.registryUrl;
      index += 1;
      continue;
    }
    if (arg === '--registry-timeout-ms') {
      parsed.registryTimeoutMs = Number(argv[index + 1] ?? parsed.registryTimeoutMs);
      index += 1;
      continue;
    }
    if (arg === '--skip-playwright-install') {
      parsed.skipPlaywrightInstall = true;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}

function resolveListenAddress(registryUrl) {
  const parsed = new URL(registryUrl);
  return `${parsed.hostname}:${parsed.port}`;
}
