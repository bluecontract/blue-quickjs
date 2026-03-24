#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { appRoot, reportsDir, writeJson } from './_helpers.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = path.resolve(appRoot, '..', '..');
const binaryPath = path.resolve(
  repoRoot,
  'tools/quickjs-native-harness/dist/quickjs-native-harness',
);

const report = {
  generatedAt: new Date().toISOString(),
  diagnosticOnly: true,
  command: binaryPath,
  status: 'skipped',
  output: null,
  error: null,
};

try {
  await run('pnpm', ['nx', 'build', 'quickjs-native-harness'], repoRoot);
  const runResult = await run(
    binaryPath,
    [
      '--eval',
      "(() => ({ runtime: 'native-diagnostic', value: 40 + 2 }))()",
      '--execution-profile',
      'compat-general-v1',
      '--gas-limit',
      '200000',
      '--report-gas',
    ],
    repoRoot,
  );
  report.status = 'ok';
  report.output = runResult.stdout.trim();
  report.error = runResult.stderr.trim() || null;
} catch (error) {
  report.status = 'failed';
  report.error = error instanceof Error ? error.message : String(error);
}

const outputPath = path.join(reportsDir, args.outputFile);
await writeJson(outputPath, report);

console.log(JSON.stringify({ outputPath, status: report.status }, null, 2));

function parseArgs(argv) {
  let outputFile = 'native-diagnostic.json';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output-file') {
      outputFile = argv[index + 1] ?? outputFile;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { outputFile };
}

async function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `command failed (${command} ${args.join(' ')}): ${code}\n${stderr}`,
        ),
      );
    });
  });
}
