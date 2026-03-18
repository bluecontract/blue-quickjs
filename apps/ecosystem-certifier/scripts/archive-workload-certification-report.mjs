#!/usr/bin/env node

import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import jiti from 'jiti';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const appRoot = path.resolve(repoRoot, 'apps/ecosystem-certifier');
const require = jiti(import.meta.url, { interopDefault: true });

const { buildDeterministicModulePack, DeterministicBuilderError } = require(
  '../../../libs/deterministic-builder/src/index.ts',
);
const { evaluate } = require('../../../libs/quickjs-runtime/src/index.ts');
const { encodeDv } = require('../../../libs/dv/src/index.ts');
const { serializeHostTape } = require('../../../libs/test-harness/src/index.ts');
const {
  CERTIFIER_FIXTURES,
  manifestForFixture,
} = require('../src/shared/fixtures.ts');
const { createCertificationHost } = require('../src/shared/host.ts');

const args = parseArgs(process.argv.slice(2));
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(repoRoot, args.outDir);
const jsonPath = path.join(outDir, `workload-certification-${timestamp}.json`);
const mdPath = path.join(outDir, `workload-certification-${timestamp}.md`);
const checksumPath = `${jsonPath}.sha256`;
const matrixPath = path.join(outDir, `compatibility-matrix-${timestamp}.json`);

await mkdir(outDir, { recursive: true });

const nodeRecords = [];
const browserCases = [];

for (const fixture of CERTIFIER_FIXTURES) {
  const manifest = manifestForFixture(fixture);
  const entry = {
    id: fixture.id,
    title: fixture.title,
    kind: fixture.kind,
    expected: fixture.expect,
    node: null,
    browser: null,
    builder: {
      ok: false,
      diagnostics: [],
      graphHash: null,
    },
  };

  try {
    const built = await buildDeterministicModulePack({
      absWorkingDir: repoRoot,
      entryPath: fixture.entryPath,
      profile: fixture.profile,
      emitProgramArtifact: true,
      abiId: fixture.abiId,
      abiVersion: fixture.abiVersion,
      abiManifestHash: fixture.abiManifestHash,
    });
    entry.builder = {
      ok: true,
      diagnostics: built.compatibility.diagnostics,
      graphHash: built.modulePack.graphHash,
    };

    if (!built.programArtifact) {
      throw new Error(`builder did not return ProgramArtifact.v2 (${fixture.id})`);
    }

    const host = createCertificationHost();
    const nodeResult = await evaluate({
      program: built.programArtifact,
      input: {
        event: { type: 'ecosystem-certifier' },
        eventCanonical: { type: 'ecosystem-certifier' },
        steps: [],
        currentContract: { id: 'ecosystem-certifier' },
        currentContractCanonical: { id: { value: 'ecosystem-certifier' } },
      },
      gasLimit: fixture.gasLimit,
      manifest,
      handlers: host.handlers,
      tape: { capacity: 64 },
    });

    entry.node = snapshotFromEvaluateResult(nodeResult);
    browserCases.push({
      id: fixture.id,
      title: fixture.title,
      kind: fixture.kind,
      gasLimit: fixture.gasLimit.toString(),
      manifest,
      program: built.programArtifact,
    });
  } catch (error) {
    if (error instanceof DeterministicBuilderError) {
      entry.node = {
        stage: 'builder_reject',
        resultHash: null,
        errorCode: null,
        errorTag: null,
        gasUsed: '0',
        gasRemaining: fixture.gasLimit.toString(),
        tapeHash: null,
        tapeLength: 0,
      };
      entry.builder = {
        ok: false,
        diagnostics: error.diagnostics,
        graphHash: null,
      };
    } else {
      throw error;
    }
  }

  nodeRecords.push(entry);
}

const browserSnapshotsById = await runBrowserCases(browserCases, args.baseUrl);

for (const record of nodeRecords) {
  record.browser = browserSnapshotsById.get(record.id) ?? null;
  record.match = determineFixtureMatch(record);
}

const mismatches = nodeRecords.filter((record) => !record.match);
const positiveRecords = nodeRecords.filter((record) => record.kind === 'positive');
const negativeRecords = nodeRecords.filter((record) => record.kind === 'negative');
const flagshipRecords = nodeRecords.filter((record) => record.kind === 'flagship');
const compatibilityMatrix = nodeRecords.map((record) => ({
  id: record.id,
  title: record.title,
  kind: record.kind,
  expectedStage: record.expected.stage,
  nodeStage: record.node?.stage ?? null,
  browserStage: record.browser?.stage ?? null,
  match: record.match,
  diagnostics: record.builder?.diagnostics ?? [],
}));
const report = {
  generatedAt: now.toISOString(),
  summary: {
    total: nodeRecords.length,
    withBrowserRuns: browserCases.length,
    mismatches: mismatches.length,
    greenCount: positiveRecords.length,
    redCount: negativeRecords.length,
    flagshipCount: flagshipRecords.length,
  },
  compatibilityMatrix,
  records: nodeRecords,
  signature: {
    algorithm: 'sha256',
    digest: sha256Hex(JSON.stringify(nodeRecords)),
  },
};

const reportText = `${JSON.stringify(report, null, 2)}\n`;
await writeFile(jsonPath, reportText, 'utf8');
await writeFile(
  checksumPath,
  `${sha256Hex(reportText)}  ${path.basename(jsonPath)}\n`,
  'utf8',
);
await writeFile(mdPath, renderMarkdownReport(report), 'utf8');
await writeFile(
  matrixPath,
  `${JSON.stringify(
    {
      generatedAt: now.toISOString(),
      summary: report.summary,
      compatibilityMatrix,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

console.log(
  JSON.stringify(
    {
      jsonPath,
      mdPath,
      checksumPath,
      matrixPath,
      mismatches: mismatches.length,
    },
    null,
    2,
  ),
);

if (mismatches.length > 0) {
  process.exitCode = 1;
}

function snapshotFromEvaluateResult(result) {
  const tape = result.tape ?? [];
  if (result.ok) {
    return {
      stage: 'success',
      resultHash: sha256Hex(Buffer.from(encodeDv(result.value))),
      errorCode: null,
      errorTag: null,
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
      tapeHash:
        tape.length > 0
          ? sha256Hex(Buffer.from(serializeHostTape(tape)))
          : null,
      tapeLength: tape.length,
    };
  }

  return {
    stage: normalizeFailureStage(result.error.kind),
    resultHash: null,
    errorCode: result.error.code,
    errorTag: 'tag' in result.error ? result.error.tag : null,
    gasUsed: result.gasUsed.toString(),
    gasRemaining: result.gasRemaining.toString(),
    tapeHash:
      tape.length > 0 ? sha256Hex(Buffer.from(serializeHostTape(tape))) : null,
    tapeLength: tape.length,
  };
}

function normalizeFailureStage(kind) {
  if (kind === 'module-pack') {
    return 'artifact_validation';
  }
  if (kind === 'execution-surface-mismatch') {
    return 'pin_enforcement';
  }
  return 'runtime_error';
}

async function runBrowserCases(cases, baseUrlOverride) {
  if (cases.length === 0) {
    return new Map();
  }

  const viteServer = await createServer({
    configFile: path.join(appRoot, 'vite.config.mts'),
    server: {
      host: '127.0.0.1',
      port: 4310,
      strictPort: true,
    },
    clearScreen: false,
  });
  await viteServer.listen();

  const baseUrl = baseUrlOverride ?? 'http://127.0.0.1:4310';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });

  try {
    const page = await context.newPage();
    await page.addInitScript((payload) => {
      window.__ECOSYSTEM_CERT_CASES__ = payload;
    }, cases);
    await page.goto('/');
    await page.waitForSelector('[data-runstate="done"]', { timeout: 120000 });

    const records = await page.evaluate(() => window.__ECOSYSTEM_CERT_RESULTS__ ?? []);
    return new Map(records.map((record) => [record.id, record.browser]));
  } finally {
    await context.close();
    await browser.close();
    await viteServer.close();
  }
}

function determineFixtureMatch(record) {
  const expected = record.expected;
  const node = record.node;
  const browser = record.browser;

  if (expected.stage === 'builder_reject') {
    return node.stage === 'builder_reject' && browser === null;
  }

  if (expected.stage === 'success') {
    return (
      node.stage === 'success' &&
      browser !== null &&
      JSON.stringify(node) === JSON.stringify(browser)
    );
  }

  if (expected.stage === 'runtime_error') {
    if (node.stage !== 'runtime_error' || browser === null) {
      return false;
    }
    if (expected.errorCode && node.errorCode !== expected.errorCode) {
      return false;
    }
    if (expected.errorTag && node.errorTag !== expected.errorTag) {
      return false;
    }
    return JSON.stringify(node) === JSON.stringify(browser);
  }

  return node.stage === expected.stage;
}

function renderMarkdownReport(report) {
  const lines = [
    '# Workload Certification Report (Generated)',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `- Total fixtures: ${report.summary.total}`,
    `- Browser-evaluated fixtures: ${report.summary.withBrowserRuns}`,
    `- Mismatches: ${report.summary.mismatches}`,
    `- Green fixtures: ${report.summary.greenCount}`,
    `- Red fixtures: ${report.summary.redCount}`,
    '',
    '| Fixture | Kind | Expected stage | Node stage | Browser stage | Match |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const record of report.records) {
    lines.push(
      `| ${record.id} | ${record.kind} | ${record.expected.stage} | ${record.node?.stage ?? 'n/a'} | ${record.browser?.stage ?? 'n/a'} | ${record.match ? 'yes' : 'no'} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  let outDir = 'artifacts/workload-certification';
  let baseUrl = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out-dir') {
      outDir = argv[i + 1] ?? outDir;
      i += 1;
      continue;
    }
    if (arg === '--base-url') {
      baseUrl = argv[i + 1] ?? baseUrl;
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { outDir, baseUrl };
}

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}
