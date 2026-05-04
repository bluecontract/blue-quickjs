#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const outDir = path.resolve(repoRoot, args.outDir);
await mkdir(outDir, { recursive: true });

const run = spawnSync('pnpm', ['licenses', 'list', '--json'], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: process.env,
  stdio: 'pipe',
});
if (run.status !== 0) {
  throw new Error(`license report generation failed: ${run.stderr ?? run.stdout}`);
}

const parsed = JSON.parse(run.stdout);
const dependencies = [];
if (Array.isArray(parsed)) {
  dependencies.push(...parsed);
} else if (parsed && typeof parsed === 'object') {
  for (const [license, entries] of Object.entries(parsed)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      dependencies.push({
        ...entry,
        license: entry.license ?? license,
      });
    }
  }
}

const counts = new Map();
for (const entry of dependencies) {
  const license = entry.license ?? 'UNKNOWN';
  counts.set(license, (counts.get(license) ?? 0) + 1);
}
const summary = [...counts.entries()]
  .map(([license, count]) => ({ license, count }))
  .sort((left, right) => right.count - left.count);

const report = {
  generatedAt: new Date().toISOString(),
  dependencyCount: dependencies.length,
  licenseSummary: summary,
  dependencies,
};

const jsonPath = path.join(outDir, 'license-report.json');
const mdPath = path.join(outDir, 'license-report.md');
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(mdPath, renderMarkdown(report), 'utf8');

process.stdout.write(
  `${JSON.stringify(
    {
      jsonPath: path.relative(repoRoot, jsonPath),
      mdPath: path.relative(repoRoot, mdPath),
      dependencyCount: dependencies.length,
    },
    null,
    2,
  )}\n`,
);

function renderMarkdown(report) {
  const lines = [
    '# Dependency license report',
    '',
    `Generated: ${report.generatedAt}`,
    `Dependencies: ${report.dependencyCount}`,
    '',
    '| License | Count |',
    '| --- | ---: |',
    ...report.licenseSummary.map((entry) => `| ${entry.license} | ${entry.count} |`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  let outDir = 'artifacts/security';
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
