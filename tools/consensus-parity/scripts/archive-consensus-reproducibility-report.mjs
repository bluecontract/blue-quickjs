#!/usr/bin/env node

import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import jiti from 'jiti';
import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const smokeWebConfigPath = path.join(repoRoot, 'apps/smoke-web/vite.config.mts');
const require = jiti(import.meta.url, { interopDefault: true });

const { encodeDv } = require('../../../libs/dv/src/index.ts');
const { bundleDeterministicProgram } = require(
  '../../../libs/deterministic-bundler/src/index.ts',
);
const { createRuntime, evaluate, initializeDeterministicVm } = require(
  '../../../libs/quickjs-runtime/src/index.ts',
);
const {
  BINARY_LIBRARY_FIXTURES,
  BINARY_LIBRARY_GAS_LIMIT,
  BINARY_LIBRARY_INPUT,
  BINARY_LIBRARY_MANIFEST,
  BINARY_LIBRARY_PROGRAM_BASE,
  CHESS_LIBRARY_ENTRY_PATH,
  CHESS_LIBRARY_GAS_LIMIT,
  CHESS_LIBRARY_INPUT,
  CHESS_LIBRARY_MANIFEST,
  CHESS_LIBRARY_PROGRAM_BASE,
  DETERMINISM_FIXTURES,
  GAS_SAMPLE_FIXTURES,
  MODULE_PACK_FIXTURES,
  createDeterminismHost,
  parseDeterministicEvalOutput,
  serializeHostTape,
} = require('../../../libs/test-harness/src/index.ts');
const { loadQuickjsWasmBinary, loadQuickjsWasmMetadata } = require(
  '../../../libs/quickjs-wasm/src/index.ts',
);

const args = parseArgs(process.argv.slice(2));

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(repoRoot, args.outDir);
const reportPath = path.join(outDir, `consensus-parity-report-${timestamp}.json`);
const summaryPath = path.join(
  outDir,
  `consensus-parity-summary-${timestamp}.md`,
);

await mkdir(outDir, { recursive: true });

const metadata = await loadQuickjsWasmMetadata();
const wasmBinary = await loadQuickjsWasmBinary('wasm32', 'release', metadata);
const variantMetadata = metadata.variants?.wasm32?.release ?? null;

const viteServer = args.reuseServer
  ? null
  : await createServer({
      configFile: smokeWebConfigPath,
      server: {
        host: '127.0.0.1',
        port: 4300,
        strictPort: true,
      },
      clearScreen: false,
    });

if (viteServer) {
  await viteServer.listen();
}

const baseUrl = args.baseUrl ?? 'http://127.0.0.1:4300';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: baseUrl });

try {
  const chessBundle = await bundleDeterministicProgram({
    absWorkingDir: repoRoot,
    entryPath: CHESS_LIBRARY_ENTRY_PATH,
    profile: 'compat-general-v1',
  });
  const binaryBundles = await Promise.all(
    BINARY_LIBRARY_FIXTURES.map(async (fixture) => ({
      name: fixture.name,
      code: (
        await bundleDeterministicProgram({
          absWorkingDir: repoRoot,
          entryPath: fixture.entryPath,
          profile: 'compat-binary-v1',
        })
      ).code,
    })),
  );

  const nodeSnapshots = await collectNodeSnapshots({
    metadata,
    wasmBinary,
    chessCode: chessBundle.code,
    binaryBundles,
  });
  const browserSnapshots = await collectBrowserSnapshots({
    context,
    chessCode: chessBundle.code,
    binaryBundles,
  });

  const suites = [
    compareNamedSuite(
      'determinism-fixtures',
      nodeSnapshots.determinism,
      browserSnapshots.determinism,
    ),
    compareNamedSuite(
      'gas-sample-fixtures',
      nodeSnapshots.gasSamples,
      browserSnapshots.gasSamples,
    ),
    compareNamedSuite(
      'gas-boundary-fixtures',
      nodeSnapshots.gasBoundaries,
      browserSnapshots.gasBoundaries,
    ),
    compareNamedSuite(
      'module-pack-fixtures',
      nodeSnapshots.modulePack,
      browserSnapshots.modulePack,
    ),
    compareNamedSuite('chess-library', nodeSnapshots.chess, browserSnapshots.chess),
    compareNamedSuite(
      'binary-library',
      nodeSnapshots.binary,
      browserSnapshots.binary,
    ),
  ];

  const mismatchCount = suites.reduce(
    (sum, suite) => sum + suite.mismatchCount,
    0,
  );
  const fixtureCount = suites.reduce((sum, suite) => sum + suite.fixtureCount, 0);
  const executionProfiles = collectExecutionProfiles();
  const oogBoundaryParity = summarizeOogBoundaryParity(
    suites.find((suite) => suite.name === 'gas-boundary-fixtures'),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    consensusExecutors: {
      primary: 'wasm-node',
      secondary: 'wasm-browser',
    },
    metadata: {
      gasVersion: metadata.gasVersion ?? null,
      engineBuildHash: metadata.engineBuildHash ?? null,
      executionProfile: 'fixture-defined',
      executionProfiles,
      wasmVariant: 'wasm32',
      wasmBuildType: 'release',
      wasmFilename: variantMetadata?.wasm?.filename ?? null,
      wasmLoaderFilename: variantMetadata?.loader?.filename ?? null,
      baseUrl,
    },
    suiteCount: suites.length,
    fixtureCount,
    mismatchCount,
    oogBoundaryParity,
    suites,
  };
  const signatureDigest = sha256Hex(JSON.stringify(report));
  const signedReport = {
    ...report,
    signature: {
      algorithm: 'sha256',
      digest: signatureDigest,
    },
  };

  const reportText = `${JSON.stringify(signedReport, null, 2)}\n`;
  await writeFile(reportPath, reportText, 'utf8');

  const checksumPath = `${reportPath}.sha256`;
  const fileDigest = sha256Hex(reportText);
  await writeFile(
    checksumPath,
    `${fileDigest}  ${path.basename(reportPath)}\n`,
    'utf8',
  );
  const summaryText = buildConsensusSummaryMarkdown({
    report: signedReport,
    reportPath,
    reportChecksumPath: checksumPath,
    reportFileDigest: fileDigest,
  });
  await writeFile(summaryPath, summaryText, 'utf8');
  const summaryDigest = sha256Hex(summaryText);
  const summaryChecksumPath = `${summaryPath}.sha256`;
  await writeFile(
    summaryChecksumPath,
    `${summaryDigest}  ${path.basename(summaryPath)}\n`,
    'utf8',
  );

  process.stdout.write(
    [
      `consensus reproducibility report: ${reportPath}`,
      `report signature digest: ${signatureDigest}`,
      `file sha256: ${fileDigest}`,
      `file checksum: ${checksumPath}`,
      `summary report: ${summaryPath}`,
      `summary sha256: ${summaryDigest}`,
      `summary checksum: ${summaryChecksumPath}`,
      `total fixtures: ${fixtureCount}`,
      `total mismatches: ${mismatchCount}`,
      `exact OOG boundary parity: ${oogBoundaryParity.status}`,
    ].join('\n') + '\n',
  );

  if (mismatchCount > 0) {
    throw new Error(
      `consensus parity mismatches detected (${mismatchCount} fixtures)`,
    );
  }
} finally {
  await context.close();
  await browser.close();
  if (viteServer) {
    await viteServer.close();
  }
}

async function collectNodeSnapshots(options) {
  return {
    determinism: await runNodeDeterminismSnapshots(
      options.metadata,
      options.wasmBinary,
    ),
    gasSamples: await runNodeGasSampleSnapshots(options.metadata, options.wasmBinary),
    gasBoundaries: await runNodeGasBoundarySnapshots(
      options.metadata,
      options.wasmBinary,
    ),
    modulePack: await runNodeModulePackSnapshots(options.metadata, options.wasmBinary),
    chess: [
      {
        name: 'chess-e2e6',
        snapshot: await runNodeChessSnapshot(options.chessCode),
      },
    ],
    binary: await Promise.all(
      options.binaryBundles.map(async (bundle) => ({
        name: bundle.name,
        snapshot: await runNodeBinarySnapshot(bundle.code),
      })),
    ),
  };
}

async function collectBrowserSnapshots(options) {
  const determinismResults = await readBrowserResults(
    options.context,
    '/determinism.html',
    '__DETERMINISM_RESULTS__',
  );
  const gasSampleResults = await readBrowserResults(
    options.context,
    '/gas-samples.html',
    '__GAS_SAMPLE_RESULTS__',
  );
  const gasBoundaryResults = await readBrowserResults(
    options.context,
    '/gas-samples.html',
    '__GAS_BOUNDARY_RESULTS__',
  );
  const modulePackResults = await readBrowserResults(
    options.context,
    '/module-pack-fixtures.html',
    '__MODULE_PACK_FIXTURE_RESULTS__',
  );

  const chessResult = await readBrowserInjectedResult(options.context, {
    url: '/chess-library-reuse.html',
    initKey: '__CHESS_BUNDLED_CODE__',
    resultKey: '__CHESS_LIBRARY_REUSE_RESULT__',
    code: options.chessCode,
  });

  const binaryResults = await Promise.all(
    options.binaryBundles.map(async (bundle) => ({
      name: bundle.name,
      snapshot: await readBrowserInjectedResult(options.context, {
        url: '/binary-library-reuse.html',
        initKey: '__BINARY_BUNDLED_CODE__',
        resultKey: '__BINARY_LIBRARY_REUSE_RESULT__',
        code: bundle.code,
      }),
    })),
  );

  return {
    determinism: determinismResults.map((entry) => ({
      name: entry.name,
      snapshot: entry,
    })),
    gasSamples: gasSampleResults.map((entry) => ({
      name: entry.name,
      snapshot: entry,
    })),
    gasBoundaries: gasBoundaryResults.map((entry) => ({
      name: entry.name,
      snapshot: entry,
    })),
    modulePack: modulePackResults.map((entry) => ({
      name: entry.name,
      snapshot: entry,
    })),
    chess: [
      {
        name: 'chess-e2e6',
        snapshot: chessResult,
      },
    ],
    binary: binaryResults,
  };
}

async function runNodeDeterminismSnapshots(metadata, wasmBinary) {
  const results = [];
  for (const fixture of DETERMINISM_FIXTURES) {
    const host = fixture.createHost();
    const result = await evaluate({
      program: fixture.program,
      input: fixture.input,
      gasLimit: fixture.gasLimit,
      manifest: fixture.manifest,
      handlers: host.handlers,
      metadata,
      wasmBinary,
      tape: { capacity: 32 },
    });
    const tape = result.tape ?? [];
    results.push({
      name: fixture.name,
      snapshot: {
        name: fixture.name,
        expected: {
          resultHash: fixture.expected.resultHash,
          errorCode: fixture.expected.errorCode,
          errorTag: fixture.expected.errorTag,
          gasUsed: fixture.expected.gasUsed.toString(),
          gasRemaining: fixture.expected.gasRemaining.toString(),
          tapeHash: fixture.expected.tapeHash,
          tapeLength: fixture.expected.tapeLength,
        },
        actual: {
          resultHash: result.ok ? hashDv(result.value) : null,
          errorCode: result.ok ? null : result.error.code,
          errorTag:
            result.ok || !('tag' in result.error) ? null : result.error.tag,
          gasUsed: result.gasUsed.toString(),
          gasRemaining: result.gasRemaining.toString(),
          tapeHash: hashTape(tape),
          tapeLength: tape.length,
        },
        matches: {
          resultHash:
            (result.ok ? hashDv(result.value) : null) ===
            fixture.expected.resultHash,
          errorCode:
            (result.ok ? null : result.error.code) === fixture.expected.errorCode,
          errorTag:
            (result.ok || !('tag' in result.error) ? null : result.error.tag) ===
            fixture.expected.errorTag,
          gasUsed:
            result.gasUsed.toString() === fixture.expected.gasUsed.toString(),
          gasRemaining:
            result.gasRemaining.toString() ===
            fixture.expected.gasRemaining.toString(),
          tapeHash: hashTape(tape) === fixture.expected.tapeHash,
          tapeLength: tape.length === fixture.expected.tapeLength,
        },
      },
    });
  }
  return results;
}

async function runNodeGasSampleSnapshots(metadata, wasmBinary) {
  const snapshots = [];
  for (const fixture of GAS_SAMPLE_FIXTURES) {
    const host = fixture.createHost();
    const result = await evaluate({
      program: fixture.program,
      input: fixture.input,
      gasLimit: fixture.gasLimit,
      manifest: fixture.manifest,
      handlers: host.handlers,
      metadata,
      wasmBinary,
    });
    if (!result.ok) {
      throw new Error(`gas sample fixture ${fixture.name} failed: ${result.error.code}`);
    }

    const actual = {
      resultHash: hashDv(result.value),
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
    };
    const expected = {
      resultHash: fixture.expected.resultHash,
      gasUsed: fixture.expected.gasUsed.toString(),
      gasRemaining: fixture.expected.gasRemaining.toString(),
    };
    const repeatSameContext = fixture.repeatSameContext
      ? await runRepeatSameContext(fixture, metadata, wasmBinary)
      : undefined;

    snapshots.push({
      name: fixture.name,
      snapshot: {
        name: fixture.name,
        actual,
        expected,
        matches: {
          resultHash: actual.resultHash === expected.resultHash,
          gasUsed: actual.gasUsed === expected.gasUsed,
          gasRemaining: actual.gasRemaining === expected.gasRemaining,
        },
        ...(repeatSameContext ? { repeatSameContext } : {}),
      },
    });
  }
  return snapshots;
}

async function runNodeGasBoundarySnapshots(metadata, wasmBinary) {
  const fixtureNames = new Set([
    'return-1',
    'loop-1k',
    'loop-10k',
    'string-concat',
    'object-alloc',
    'array-ops',
  ]);
  const selected = GAS_SAMPLE_FIXTURES.filter((fixture) =>
    fixtureNames.has(fixture.name),
  );
  return Promise.all(
    selected.map(async (fixture) => ({
      name: fixture.name,
      snapshot: await findOutOfGasBoundary(fixture, metadata, wasmBinary),
    })),
  );
}

async function runNodeModulePackSnapshots(metadata, wasmBinary) {
  const snapshots = [];
  for (const fixture of MODULE_PACK_FIXTURES) {
    const host = fixture.createHost();
    const result = await evaluate({
      program: fixture.program,
      input: fixture.input,
      gasLimit: fixture.gasLimit,
      manifest: fixture.manifest,
      handlers: host.handlers,
      metadata,
      wasmBinary,
      tape: { capacity: 16 },
    });
    const tape = result.tape ?? [];
    snapshots.push({
      name: fixture.name,
      snapshot: {
        name: fixture.name,
        expectedOk: fixture.expected.ok,
        actual: {
          ok: result.ok,
          valueHash: result.ok ? hashDv(result.value) : null,
          errorCode: result.ok ? null : result.error.code,
          errorTag:
            result.ok || !('tag' in result.error) ? null : result.error.tag,
          gasUsed: result.gasUsed.toString(),
          gasRemaining: result.gasRemaining.toString(),
          tapeHash: hashTape(tape),
          tapeLength: tape.length,
        },
      },
    });
  }
  return snapshots;
}

async function runNodeChessSnapshot(code) {
  const host = createDeterminismHost();
  const result = await evaluate({
    program: {
      ...CHESS_LIBRARY_PROGRAM_BASE,
      code,
    },
    input: CHESS_LIBRARY_INPUT,
    gasLimit: CHESS_LIBRARY_GAS_LIMIT,
    manifest: CHESS_LIBRARY_MANIFEST,
    handlers: host.handlers,
  });

  if (result.ok) {
    return {
      ok: true,
      value: result.value,
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
      errorCode: null,
      errorTag: null,
    };
  }

  return {
    ok: false,
    value: null,
    gasUsed: result.gasUsed.toString(),
    gasRemaining: result.gasRemaining.toString(),
    errorCode: result.error.code,
    errorTag: 'tag' in result.error ? result.error.tag : null,
  };
}

async function runNodeBinarySnapshot(code) {
  const host = createDeterminismHost();
  const result = await evaluate({
    program: {
      ...BINARY_LIBRARY_PROGRAM_BASE,
      code,
    },
    input: BINARY_LIBRARY_INPUT,
    gasLimit: BINARY_LIBRARY_GAS_LIMIT,
    manifest: BINARY_LIBRARY_MANIFEST,
    handlers: host.handlers,
  });

  if (result.ok) {
    return {
      ok: true,
      value: result.value,
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
      errorCode: null,
      errorTag: null,
    };
  }

  return {
    ok: false,
    value: null,
    gasUsed: result.gasUsed.toString(),
    gasRemaining: result.gasRemaining.toString(),
    errorCode: result.error.code,
    errorTag: 'tag' in result.error ? result.error.tag : null,
  };
}

async function runRepeatSameContext(fixture, metadata, wasmBinary) {
  const host = fixture.createHost();
  const runtime = await createRuntime({
    manifest: fixture.manifest,
    handlers: host.handlers,
    metadata,
    wasmBinary,
  });
  const vm = initializeDeterministicVm(
    runtime,
    fixture.program,
    fixture.input,
    fixture.gasLimit,
  );

  const samples = [];
  try {
    vm.setGasLimit(fixture.gasLimit);
    const warmup = parseDeterministicEvalOutput(vm.eval(fixture.program.code));
    if (warmup.kind === 'error') {
      throw new Error(`${fixture.name} warmup failed: ${warmup.error}`);
    }

    for (let i = 0; i < fixture.repeatSameContext.count; i += 1) {
      vm.setGasLimit(fixture.gasLimit);
      const output = parseDeterministicEvalOutput(vm.eval(fixture.program.code));
      if (output.kind === 'error') {
        throw new Error(`${fixture.name} failed: ${output.error}`);
      }
      samples.push(output.gasUsed.toString());
    }
  } finally {
    vm.dispose();
  }

  const expectedGasUsed = fixture.repeatSameContext.expectedGasUsed.toString();
  return {
    samples,
    expectedGasUsed,
    match:
      samples.length > 0 && samples.every((sample) => sample === expectedGasUsed),
  };
}

async function findOutOfGasBoundary(fixture, metadata, wasmBinary) {
  let upperGas = fixture.expected.gasUsed;
  let upper = await runFixtureAtGasLimit(fixture, upperGas, metadata, wasmBinary);
  while (!upper.ok) {
    upperGas *= 2n;
    upper = await runFixtureAtGasLimit(fixture, upperGas, metadata, wasmBinary);
  }

  let lowerGas = 0n;
  let lower = await runFixtureAtGasLimit(fixture, lowerGas, metadata, wasmBinary);
  while (lowerGas + 1n < upperGas) {
    const mid = (lowerGas + upperGas) >> 1n;
    const current = await runFixtureAtGasLimit(fixture, mid, metadata, wasmBinary);
    if (current.ok) {
      upperGas = mid;
      upper = current;
    } else {
      lowerGas = mid;
      lower = current;
    }
  }

  if (!upper.ok || lower.ok) {
    throw new Error(`boundary search failed for ${fixture.name}`);
  }

  return {
    name: fixture.name,
    firstSuccessGas: upperGas.toString(),
    lastFailureGas: lowerGas.toString(),
    successGasUsed: upper.gasUsed.toString(),
    successGasRemaining: upper.gasRemaining.toString(),
    failureGasUsed: lower.gasUsed.toString(),
    failureGasRemaining: lower.gasRemaining.toString(),
    failureCode: lower.error.code,
    failureTag: 'tag' in lower.error ? lower.error.tag : null,
  };
}

async function runFixtureAtGasLimit(fixture, gasLimit, metadata, wasmBinary) {
  const host = fixture.createHost();
  return evaluate({
    program: fixture.program,
    input: fixture.input,
    gasLimit,
    manifest: fixture.manifest,
    handlers: host.handlers,
    metadata,
    wasmBinary,
  });
}

async function readBrowserResults(context, url, key) {
  const page = await context.newPage();
  try {
    await page.goto(url);
    await page.waitForSelector('[data-runstate="done"]', { timeout: 60000 });
    const results = await page.evaluate(
      (resultKey) => globalThis[resultKey] ?? null,
      key,
    );
    if (!Array.isArray(results)) {
      throw new Error(`browser results missing for ${url} (${key})`);
    }
    return results;
  } finally {
    await page.close();
  }
}

async function readBrowserInjectedResult(context, options) {
  const page = await context.newPage();
  try {
    await page.addInitScript(
      ({ key, bundledCode }) => {
        globalThis[key] = bundledCode;
      },
      { key: options.initKey, bundledCode: options.code },
    );
    await page.goto(options.url);
    await page.waitForSelector('[data-runstate="done"]', { timeout: 60000 });
    const result = await page.evaluate((resultKey) => globalThis[resultKey] ?? null, options.resultKey);
    if (!result || Array.isArray(result) || typeof result !== 'object') {
      throw new Error(`browser injected result missing for ${options.url}`);
    }
    return result;
  } finally {
    await page.close();
  }
}

function compareNamedSuite(name, nodeRecords, browserRecords) {
  const nodeByName = new Map(nodeRecords.map((entry) => [entry.name, entry.snapshot]));
  const browserByName = new Map(
    browserRecords.map((entry) => [entry.name, entry.snapshot]),
  );
  const fixtureNames = Array.from(
    new Set([...nodeByName.keys(), ...browserByName.keys()]),
  ).sort();

  const fixtures = fixtureNames.map((fixtureName) => {
    const node = nodeByName.get(fixtureName);
    const browser = browserByName.get(fixtureName);
    const match = node !== undefined && browser !== undefined && deepEqual(node, browser);

    return {
      name: fixtureName,
      match,
      node: node ?? null,
      browser: browser ?? null,
      ...(node === undefined
        ? { reason: 'missing-node-snapshot' }
        : browser === undefined
          ? { reason: 'missing-browser-snapshot' }
          : {}),
    };
  });

  return {
    name,
    fixtureCount: fixtures.length,
    mismatchCount: fixtures.filter((fixture) => !fixture.match).length,
    fixtures,
  };
}

function deepEqual(left, right) {
  return JSON.stringify(normalizeJson(left)) === JSON.stringify(normalizeJson(right));
}

function normalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJson(entry));
  }
  if (value && typeof value === 'object') {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalizeJson(value[key]);
    }
    return normalized;
  }
  return value;
}

function hashDv(value) {
  return sha256Hex(Buffer.from(encodeDv(value)));
}

function hashTape(tape) {
  if (!Array.isArray(tape) || tape.length === 0) {
    return null;
  }
  return sha256Hex(Buffer.from(serializeHostTape(tape)));
}

function collectExecutionProfiles() {
  const profiles = new Set();
  const addProfile = (value) => {
    profiles.add(value ?? 'baseline-v1');
  };

  for (const fixture of DETERMINISM_FIXTURES) {
    addProfile(fixture.program.executionProfile);
  }
  for (const fixture of GAS_SAMPLE_FIXTURES) {
    addProfile(fixture.program.executionProfile);
  }
  for (const fixture of MODULE_PACK_FIXTURES) {
    addProfile(fixture.program.executionProfile);
  }
  addProfile(CHESS_LIBRARY_PROGRAM_BASE.executionProfile);
  addProfile(BINARY_LIBRARY_PROGRAM_BASE.executionProfile);

  return Array.from(profiles).sort();
}

function summarizeOogBoundaryParity(gasBoundarySuite) {
  if (!gasBoundarySuite) {
    return {
      status: 'unknown',
      fixtureCount: 0,
      mismatchCount: 0,
      boundarySuite: 'gas-boundary-fixtures',
    };
  }
  const status =
    gasBoundarySuite.mismatchCount === 0 ? 'exact-parity' : 'mismatch';
  return {
    status,
    fixtureCount: gasBoundarySuite.fixtureCount,
    mismatchCount: gasBoundarySuite.mismatchCount,
    boundarySuite: gasBoundarySuite.name,
  };
}

function buildConsensusSummaryMarkdown({
  report,
  reportPath,
  reportChecksumPath,
  reportFileDigest,
}) {
  const relReportPath = path.relative(repoRoot, reportPath);
  const relChecksumPath = path.relative(repoRoot, reportChecksumPath);
  const suiteRows = report.suites
    .map(
      (suite) =>
        `| ${suite.name} | ${suite.fixtureCount} | ${suite.mismatchCount} |`,
    )
    .join('\n');
  const executionProfiles =
    report.metadata.executionProfiles?.join(', ') ?? 'unknown';

  return [
    '# Consensus parity summary',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    '## Consensus-safe release gate',
    '',
    `- Primary executor: ${report.consensusExecutors.primary}`,
    `- Secondary executor: ${report.consensusExecutors.secondary}`,
    `- Canonical wasm variant/build: ${report.metadata.wasmVariant}/${report.metadata.wasmBuildType}`,
    '',
    '## Release metadata',
    '',
    `- engineBuildHash: ${report.metadata.engineBuildHash ?? 'unavailable'}`,
    `- gasVersion: ${report.metadata.gasVersion ?? 'unavailable'}`,
    `- executionProfile coverage: ${executionProfiles}`,
    `- fixture count: ${report.fixtureCount}`,
    `- mismatch count: ${report.mismatchCount}`,
    `- exact OOG boundary parity: ${report.oogBoundaryParity?.status ?? 'unknown'}`,
    '',
    '## Integrity artifacts',
    '',
    `- report JSON: \`${relReportPath}\``,
    `- report checksum sidecar: \`${relChecksumPath}\``,
    `- report signature digest: ${report.signature?.digest ?? 'unavailable'}`,
    `- report file sha256: ${reportFileDigest}`,
    '',
    '## Suite mismatch summary',
    '',
    '| Suite | Fixture count | Mismatches |',
    '| --- | ---: | ---: |',
    suiteRows,
    '',
  ].join('\n');
}

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function parseArgs(argv) {
  let outDir = 'artifacts/reproducibility-consensus';
  let baseUrl = null;
  let reuseServer = false;

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
    if (arg === '--reuse-server') {
      reuseServer = true;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return {
    outDir,
    baseUrl,
    reuseServer,
  };
}
