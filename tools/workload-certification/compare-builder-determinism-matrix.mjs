#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = parseArgs(process.argv.slice(2));
const inputDir = path.resolve(process.cwd(), args.inputDir);
const reportPaths = await findReports(inputDir);

if (reportPaths.length === 0) {
  throw new Error(`no builder-determinism-report.json files found under ${inputDir}`);
}

const reports = [];
for (const reportPath of reportPaths) {
  reports.push({
    path: reportPath,
    payload: JSON.parse(await readFile(reportPath, 'utf8')),
  });
}

const baseline = reports[0].payload;
const mismatches = [];
for (const report of reports.slice(1)) {
  for (let index = 0; index < baseline.fixtures.length; index += 1) {
    const baselineFixture = baseline.fixtures[index];
    const candidateFixture = report.payload.fixtures[index];
    if (!candidateFixture) {
      mismatches.push({
        type: 'missing_fixture',
        report: report.path,
        fixtureIndex: index,
      });
      continue;
    }
    if (baselineFixture.graphHash !== candidateFixture.graphHash) {
      mismatches.push({
        type: 'graph_hash_mismatch',
        report: report.path,
        fixtureIndex: index,
        baseline: baselineFixture.graphHash,
        candidate: candidateFixture.graphHash,
      });
    }
    if (baselineFixture.canonicalHash !== candidateFixture.canonicalHash) {
      mismatches.push({
        type: 'canonical_hash_mismatch',
        report: report.path,
        fixtureIndex: index,
        baseline: baselineFixture.canonicalHash,
        candidate: candidateFixture.canonicalHash,
      });
    }
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  inputDir,
  reportCount: reports.length,
  mismatchCount: mismatches.length,
  reports: reports.map((report) => ({
    path: path.relative(inputDir, report.path),
    checks: report.payload.checks,
  })),
  mismatches,
};

console.log(JSON.stringify(output, null, 2));
if (mismatches.length > 0) {
  process.exitCode = 1;
}

async function findReports(targetDir) {
  const entries = await readdir(targetDir, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    const entryPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      reports.push(...(await findReports(entryPath)));
      continue;
    }
    if (entry.name === 'builder-determinism-report.json') {
      reports.push(entryPath);
    }
  }
  return reports.sort();
}

function parseArgs(argv) {
  let inputDir = 'artifacts';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input-dir') {
      inputDir = argv[index + 1] ?? inputDir;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { inputDir };
}
