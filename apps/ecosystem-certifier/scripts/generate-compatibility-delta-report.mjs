#!/usr/bin/env node

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const args = parseArgs(process.argv.slice(2));
const currentDir = path.resolve(repoRoot, args.currentDir);
const outDir = path.resolve(repoRoot, args.outDir);
const baselinePath = path.resolve(repoRoot, args.baselinePath);

await mkdir(outDir, { recursive: true });

const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const currentReportPath =
  args.currentReport ??
  (await findNewestFile(currentDir, (entry) =>
    /^workload-certification-.*\.json$/.test(entry.name),
  ));
const currentReport = JSON.parse(await readFile(currentReportPath, 'utf8'));

const baselineFixtures = new Map(
  baseline.fixtures.map((fixture) => [fixture.id, fixture]),
);
const currentFixturesRaw =
  currentReport.compatibilityMatrix ??
  currentReport.records?.map((record) => ({
    id: record.id,
    kind: record.kind,
    expectedStage: record.expected?.stage ?? null,
    nodeStage: record.node?.stage ?? null,
    browserStage: record.browser?.stage ?? null,
    profile: record.profile ?? null,
  })) ??
  [];
const currentFixtures = new Map(
  currentFixturesRaw.map((fixture) => [fixture.id, fixture]),
);

const added = [];
const removed = [];
const stageChanges = [];
const profileCounts = new Map();

for (const [id, current] of currentFixtures.entries()) {
  if (!baselineFixtures.has(id)) {
    added.push({
      id,
      kind: current.kind,
      expectedStage: current.expectedStage,
      profile: current.profile ?? null,
    });
  } else {
    const previous = baselineFixtures.get(id);
    if (previous.expectedStage !== current.expectedStage) {
      stageChanges.push({
        id,
        kind: current.kind,
        from: previous.expectedStage,
        to: current.expectedStage,
      });
    }
  }
  if (current.kind === 'positive') {
    const profile = current.profile ?? 'unknown';
    profileCounts.set(profile, (profileCounts.get(profile) ?? 0) + 1);
  }
}

for (const [id, previous] of baselineFixtures.entries()) {
  if (!currentFixtures.has(id)) {
    removed.push({
      id,
      kind: previous.kind,
      expectedStage: previous.expectedStage,
    });
  }
}

const currentSummary = currentReport.summary ?? {
  greenCount: currentFixturesRaw.filter((fixture) => fixture.kind === 'positive')
    .length,
  redCount: currentFixturesRaw.filter((fixture) => fixture.kind === 'negative')
    .length,
  flagshipCount: currentFixturesRaw.filter((fixture) => fixture.kind === 'flagship')
    .length,
};

const delta = {
  generatedAt: new Date().toISOString(),
  baseline: {
    release: baseline.release ?? 'unknown',
    path: path.relative(repoRoot, baselinePath),
    summary: baseline.summary ?? null,
  },
  current: {
    reportPath: path.relative(repoRoot, currentReportPath),
    summary: currentSummary,
  },
  deltas: {
    greenDelta:
      (currentSummary.greenCount ?? 0) - (baseline.summary?.greenCount ?? 0),
    redDelta: (currentSummary.redCount ?? 0) - (baseline.summary?.redCount ?? 0),
    flagshipDelta:
      (currentSummary.flagshipCount ?? 0) - (baseline.summary?.flagshipCount ?? 0),
  },
  added,
  removed,
  stageChanges,
  positiveProfileCounts: Object.fromEntries(
    [...profileCounts.entries()].sort((left, right) =>
      left[0].localeCompare(right[0]),
    ),
  ),
};

const outputPath = path.join(outDir, 'compatibility-delta-report.json');
await writeFile(outputPath, `${JSON.stringify(delta, null, 2)}\n`, 'utf8');

process.stdout.write(
  `${JSON.stringify(
    {
      outputPath: path.relative(repoRoot, outputPath),
      greenDelta: delta.deltas.greenDelta,
      addedCount: added.length,
      removedCount: removed.length,
    },
    null,
    2,
  )}\n`,
);

async function findNewestFile(rootDir, predicate) {
  const files = await walk(rootDir);
  let latest = null;
  for (const filePath of files) {
    const entry = { name: path.basename(filePath), path: filePath };
    if (!predicate(entry)) {
      continue;
    }
    const fileStat = await stat(filePath);
    if (!latest || fileStat.mtimeMs > latest.mtimeMs) {
      latest = { filePath, mtimeMs: fileStat.mtimeMs };
    }
  }
  if (!latest) {
    throw new Error(`no current report files found under ${rootDir}`);
  }
  return latest.filePath;
}

async function walk(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function parseArgs(argv) {
  const parsed = {
    currentDir: 'artifacts/workload-certification',
    outDir: 'artifacts/workload-certification',
    baselinePath: 'docs/ecosystem-compatibility-baseline-0.4.1.json',
    currentReport: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--current-dir') {
      parsed.currentDir = argv[index + 1] ?? parsed.currentDir;
      index += 1;
      continue;
    }
    if (arg === '--out-dir') {
      parsed.outDir = argv[index + 1] ?? parsed.outDir;
      index += 1;
      continue;
    }
    if (arg === '--baseline-path') {
      parsed.baselinePath = argv[index + 1] ?? parsed.baselinePath;
      index += 1;
      continue;
    }
    if (arg === '--current-report') {
      parsed.currentReport = argv[index + 1] ?? parsed.currentReport;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}
