#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

if (isMain()) {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const reportPath = path.resolve(
    repoRoot,
    args.reportPath ?? 'docs/release-readiness-report.md',
  );
  const reportText = await readFile(reportPath, 'utf8');

  const expectedBranch = args.expectedBranch ?? resolveCurrentBranch(repoRoot);
  const expectedDate =
    args.expectedDate ?? new Date().toISOString().slice(0, 10);
  const output = checkReleaseDocFreshness({
    reportText,
    expectedBranch,
    expectedDate,
    reportPath: path.relative(repoRoot, reportPath),
  });

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!output.checks.branchMatches || !output.checks.dateMatches) {
    process.exitCode = 1;
  }
}

export function checkReleaseDocFreshness({
  reportText,
  expectedBranch,
  expectedDate,
  reportPath = 'docs/release-readiness-report.md',
}) {
  const branchMatch = reportText.match(/^Branch:\s*`([^`]+)`/m);
  const dateMatch = reportText.match(/^Date:\s*(\d{4}-\d{2}-\d{2})/m);

  if (!branchMatch) {
    throw new Error(`missing Branch line in ${reportPath}`);
  }
  if (!dateMatch) {
    throw new Error(`missing Date line in ${reportPath}`);
  }

  const actualBranch = branchMatch[1];
  const actualDate = dateMatch[1];
  const checks = {
    branchMatches: actualBranch === expectedBranch,
    dateMatches: actualDate === expectedDate,
  };

  return {
    reportPath,
    expected: {
      branch: expectedBranch,
      date: expectedDate,
    },
    actual: {
      branch: actualBranch,
      date: actualDate,
    },
    checks,
  };
}

function resolveCurrentBranch(cwd) {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? '';
    throw new Error(`unable to resolve current git branch: ${stderr}`);
  }
  return result.stdout.trim();
}

function parseArgs(argv) {
  let expectedBranch;
  let expectedDate;
  let reportPath;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--expected-branch') {
      expectedBranch = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--expected-date') {
      expectedDate = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--report-path') {
      reportPath = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { expectedBranch, expectedDate, reportPath };
}

function isMain() {
  if (!process.argv[1]) {
    return false;
  }
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}
