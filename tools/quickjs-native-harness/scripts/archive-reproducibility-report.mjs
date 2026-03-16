#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const parityReportScriptPath = path.join(scriptDir, 'parity-report.mjs');

const args = parseArgs(process.argv.slice(2));

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(repoRoot, args.outDir);
const reportPath = path.join(outDir, `parity-report-${timestamp}.json`);

await mkdir(outDir, { recursive: true });

const reportArgs = [
  parityReportScriptPath,
  '--assert-match',
  '--include-gas-charge-tape',
  '--out',
  reportPath,
];
if (args.chargeTapeCapacity !== null) {
  reportArgs.push('--gas-charge-tape-capacity', String(args.chargeTapeCapacity));
}

const run = spawnSync(process.execPath, reportArgs, {
  cwd: repoRoot,
  encoding: 'utf8',
});

if (run.status !== 0) {
  process.stdout.write(run.stdout ?? '');
  process.stderr.write(run.stderr ?? '');
  throw new Error(
    `strict reproducibility report generation failed (exit ${run.status ?? 'unknown'})`,
  );
}

const reportText = await readFile(reportPath, 'utf8');
const report = JSON.parse(reportText);
if (report.mismatchCount !== 0) {
  throw new Error(
    `strict reproducibility report mismatchCount is ${report.mismatchCount}, expected 0`,
  );
}
if (
  !report.signature ||
  report.signature.algorithm !== 'sha256' ||
  typeof report.signature.digest !== 'string'
) {
  throw new Error('reproducibility report signature is missing or invalid');
}

const fileDigest = sha256Hex(reportText);
const digestPath = `${reportPath}.sha256`;
await writeFile(digestPath, `${fileDigest}  ${path.basename(reportPath)}\n`, 'utf8');

process.stdout.write(
  [
    `reproducibility report: ${reportPath}`,
    `report signature digest: ${report.signature.digest}`,
    `file sha256: ${fileDigest}`,
    `file checksum: ${digestPath}`,
  ].join('\n') + '\n',
);

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function parseArgs(argv) {
  let outDir = 'artifacts/reproducibility';
  let chargeTapeCapacity = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out-dir') {
      outDir = argv[i + 1] ?? outDir;
      i += 1;
      continue;
    }
    if (arg === '--gas-charge-tape-capacity') {
      const parsed = Number.parseInt(argv[i + 1] ?? '', 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error('--gas-charge-tape-capacity must be a non-negative integer');
      }
      chargeTapeCapacity = parsed;
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return { outDir, chargeTapeCapacity };
}
