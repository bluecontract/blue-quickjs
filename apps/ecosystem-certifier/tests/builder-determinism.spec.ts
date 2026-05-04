import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import type { BuilderDeterminismReport } from '../src/shared/builder-determinism.js';

const execFileAsync = promisify(execFile);

test('builder path determinism script reports stable hashes', async () => {
  const outDir = path.join(
    process.cwd(),
    'artifacts',
    'workload-certification-test',
    `builder-${Date.now()}`,
  );
  await execFileAsync('node', [
    'apps/ecosystem-certifier/scripts/check-builder-determinism.mjs',
    '--out-dir',
    outDir,
  ]);

  const reportPath = path.join(outDir, 'builder-determinism-report.json');
  const report = JSON.parse(
    await readFile(reportPath, 'utf8'),
  ) as BuilderDeterminismReport;

  expect(report.checks.graphHashEqual).toBe(true);
  expect(report.checks.canonicalHashEqual).toBe(true);
  expect(report.fixtures).toHaveLength(2);
});
