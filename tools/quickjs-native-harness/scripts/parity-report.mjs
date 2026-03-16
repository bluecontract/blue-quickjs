#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import jiti from 'jiti';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const require = jiti(import.meta.url, { interopDefault: true });

const harnessPath = path.join(
  repoRoot,
  'tools',
  'quickjs-native-harness',
  'dist',
  'quickjs-native-harness',
);

if (!existsSync(harnessPath)) {
  throw new Error(
    `Native harness not found at ${harnessPath}. Build quickjs-native-harness first.`,
  );
}

const GAS_SPEC_PATH = path.join(repoRoot, 'tools', 'gas-spec', 'gas-spec.v3.json');
const GAS_VERSION = readGasVersion();

const { encodeDv, encodeDv2 } = require('../../../libs/dv/src/index.ts');
const {
  evaluate,
  validateProgramArtifact,
  validateProgramArtifactV2,
  validateInputEnvelope,
} = require('../../../libs/quickjs-runtime/src/index.ts');
const {
  mapVmError,
} = require('../../../libs/quickjs-runtime/src/lib/evaluate-errors.ts');
const {
  hashAbiManifest,
  validateAbiManifest,
} = require('../../../libs/abi-manifest/src/index.ts');
const {
  bundleDeterministicProgram,
} = require('../../../libs/deterministic-bundler/src/index.ts');
const {
  BINARY_LIBRARY_FIXTURES,
  BINARY_LIBRARY_GAS_LIMIT,
  BINARY_LIBRARY_INPUT,
  BINARY_LIBRARY_MANIFEST,
  BINARY_LIBRARY_PROGRAM_BASE,
  DETERMINISM_FIXTURES,
  MODULE_PACK_FIXTURES,
  serializeHostTape,
} = require('../../../libs/test-harness/src/index.ts');

const TAPE_CAPACITY = 64;

const argv = parseArgs(process.argv.slice(2));

/** @typedef {{resultHash: string | null, errorCode: string | null, errorTag: string | null, gasUsed: string, gasRemaining: string, tapeHash: string | null, tapeLength: number}} Snapshot */

async function main() {
  const gasDeltaBaselineMap =
    !argv.includeGasTrace && argv.gasDeltaBaselinePath
      ? await loadGasDeltaBaselineMap(argv.gasDeltaBaselinePath)
      : new Map();
  const comparison = {
    ignoreGas: argv.ignoreGas || argv.includeGasTrace,
    gasDeltaBaselineMap,
    includeGasTrace: argv.includeGasTrace,
    includeGasChargeTape: argv.includeGasChargeTape,
    gasChargeTapeCapacity: argv.gasChargeTapeCapacity,
  };
  const suites = [];
  const fixtureReports = [];

  const determinism = await runFixtureSuite(
    'determinism',
    DETERMINISM_FIXTURES,
    (fixture) => fixture.program,
    (fixture) => fixture.input,
    (fixture) => fixture.manifest,
    (fixture) => fixture.gasLimit,
    comparison,
  );
  suites.push(determinism.summary);
  fixtureReports.push(...determinism.reports);

  const modulePack = await runFixtureSuite(
    'module-pack',
    MODULE_PACK_FIXTURES,
    (fixture) => fixture.program,
    (fixture) => fixture.input,
    (fixture) => fixture.manifest,
    (fixture) => fixture.gasLimit,
    comparison,
  );
  suites.push(modulePack.summary);
  fixtureReports.push(...modulePack.reports);

  const binaryFixtureReports = [];
  for (const fixture of BINARY_LIBRARY_FIXTURES) {
    const bundled = await bundleDeterministicProgram({
      absWorkingDir: repoRoot,
      entryPath: fixture.entryPath,
      profile: 'compat-binary-v1',
    });
    const program = {
      ...BINARY_LIBRARY_PROGRAM_BASE,
      code: bundled.code,
    };
    const host = createNativeCompatibleHost();
    const nodeSnapshot = await runNodeEvaluation({
      program,
      input: BINARY_LIBRARY_INPUT,
      manifest: BINARY_LIBRARY_MANIFEST,
      gasLimit: BINARY_LIBRARY_GAS_LIMIT,
      handlers: host.handlers,
      includeGasTrace: comparison.includeGasTrace,
      includeGasChargeTape: comparison.includeGasChargeTape,
      gasChargeTapeCapacity: comparison.gasChargeTapeCapacity,
    });
    assert.deepStrictEqual(
      normalizeJsonValue(nodeSnapshot.okValue),
      fixture.expectedValue,
      `binary fixture "${fixture.name}" produced unexpected node value`,
    );
    const nativeSnapshot = runNativeEvaluation({
      program,
      manifest: BINARY_LIBRARY_MANIFEST,
      input: BINARY_LIBRARY_INPUT,
      gasLimit: BINARY_LIBRARY_GAS_LIMIT,
      includeGasTrace: comparison.includeGasTrace,
      includeGasChargeTape: comparison.includeGasChargeTape,
      gasChargeTapeCapacity: comparison.gasChargeTapeCapacity,
    });
    const report = compareSnapshots(
      'binary-library',
      fixture.name,
      {
        node: nodeSnapshot.snapshot,
        native: nativeSnapshot,
      },
      comparison,
      extractProgramMetadata(program),
    );
    binaryFixtureReports.push(report);
  }

  fixtureReports.push(...binaryFixtureReports);
  suites.push(createSuiteSummary('binary-library', binaryFixtureReports));

  const mismatchCount = fixtureReports.filter((report) => !report.match).length;
  const report = buildReport({
    fixtureReports,
    suites,
    mismatchCount,
  });

  if (argv.outPath) {
    const outPath = path.resolve(argv.outPath);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  if (argv.writeGasDeltaBaselinePath) {
    const baselinePath = path.resolve(argv.writeGasDeltaBaselinePath);
    await mkdir(path.dirname(baselinePath), { recursive: true });
    await writeFile(
      baselinePath,
      `${JSON.stringify(buildGasDeltaBaseline(report), null, 2)}\n`,
      'utf8',
    );
  }

  console.log(JSON.stringify(report, null, 2));

  if (argv.comparePath) {
    const compareResult = await compareWithReport(report, argv.comparePath);
    console.error(
      `comparison summary: differing fixtures=${compareResult.differenceCount}`,
    );
    if (compareResult.differenceCount > 0) {
      console.error(JSON.stringify(compareResult.differences, null, 2));
      process.exitCode = 1;
    }
  }

  if (argv.assertMatch && mismatchCount > 0) {
    process.exitCode = 1;
  }

  if (argv.gasDeltaBaselinePath && !argv.includeGasTrace) {
    const gasDeltaResult = await compareGasDeltaBaseline(
      report,
      argv.gasDeltaBaselinePath,
    );
    console.error(
      `gas delta baseline summary: differing fixtures=${gasDeltaResult.differenceCount}`,
    );
    if (gasDeltaResult.differenceCount > 0) {
      console.error(JSON.stringify(gasDeltaResult.differences, null, 2));
      process.exitCode = 1;
    }
  } else if (argv.gasDeltaBaselinePath && argv.includeGasTrace) {
    console.error(
      'gas delta baseline check skipped because --include-gas-trace perturbs gas counters',
    );
  }
}

/**
 * @param {string} suiteName
 * @param {Array<any>} fixtures
 * @param {(fixture: any) => any} getProgram
 * @param {(fixture: any) => any} getInput
 * @param {(fixture: any) => any} getManifest
 * @param {(fixture: any) => bigint} getGasLimit
 */
async function runFixtureSuite(
  suiteName,
  fixtures,
  getProgram,
  getInput,
  getManifest,
  getGasLimit,
  comparison,
) {
  const reports = [];
  for (const fixture of fixtures) {
    const program = getProgram(fixture);
    const manifest = getManifest(fixture);
    const input = getInput(fixture);
    const gasLimit = getGasLimit(fixture);
    const host = createNativeCompatibleHost();
    const node = await runNodeEvaluation({
      program,
      input,
      manifest,
      gasLimit,
      handlers: host.handlers,
      includeGasTrace: comparison.includeGasTrace,
      includeGasChargeTape: comparison.includeGasChargeTape,
      gasChargeTapeCapacity: comparison.gasChargeTapeCapacity,
    });
    const native = runNativeEvaluation({
      program,
      manifest,
      input,
      gasLimit,
      includeGasTrace: comparison.includeGasTrace,
      includeGasChargeTape: comparison.includeGasChargeTape,
      gasChargeTapeCapacity: comparison.gasChargeTapeCapacity,
    });
    reports.push(
      compareSnapshots(
        suiteName,
        fixture.name,
        {
          node: node.snapshot,
          native,
        },
        comparison,
        extractProgramMetadata(program),
      ),
    );
  }

  return {
    summary: createSuiteSummary(suiteName, reports),
    reports,
  };
}

function createNativeCompatibleHost() {
  return {
    handlers: {
      document: {
        get: (docPath) => {
          if (docPath === 'missing') {
            return {
              err: { code: 'NOT_FOUND', tag: 'host/not_found' },
              units: 2,
            };
          }
          if (docPath === 'limit') {
            return {
              err: { code: 'LIMIT_EXCEEDED', tag: 'host/limit' },
              units: 3,
            };
          }
          if (docPath === 'bytes/payload') {
            return { ok: Uint8Array.from([222, 173, 190, 239]), units: 4 };
          }
          return { ok: docPath, units: 1 };
        },
        getCanonical: (docPath) => {
          if (docPath === 'missing') {
            return {
              err: { code: 'NOT_FOUND', tag: 'host/not_found' },
              units: 2,
            };
          }
          if (docPath === 'limit') {
            return {
              err: { code: 'LIMIT_EXCEEDED', tag: 'host/limit' },
              units: 3,
            };
          }
          if (docPath === 'bytes/payload') {
            return { ok: Uint8Array.from([222, 173, 190, 239]), units: 4 };
          }
          return { ok: docPath, units: 1 };
        },
      },
      emit: () => ({ ok: null, units: 0 }),
    },
  };
}

/**
 * @param {{program: any, input: any, manifest: any, gasLimit: bigint, handlers: any, includeGasTrace?: boolean, includeGasChargeTape?: boolean, gasChargeTapeCapacity?: number}} options
 */
async function runNodeEvaluation(options) {
  const manifest = validateAbiManifest(options.manifest);
  const program = normalizeProgram(options.program);
  const input = validateInputEnvelope(options.input);
  const result = await evaluate({
    program,
    input,
    gasLimit: options.gasLimit,
    manifest,
    handlers: options.handlers,
    tape: { capacity: TAPE_CAPACITY },
    gasTrace: options.includeGasTrace ?? false,
    ...(options.includeGasChargeTape
      ? {
          gasChargeTape: {
            capacity: options.gasChargeTapeCapacity ?? 256,
          },
        }
      : {}),
  });

  if (result.ok) {
    return {
      okValue: result.value,
      snapshot: {
        resultHash: hashDv(result.value),
        errorCode: null,
        errorTag: null,
        gasUsed: result.gasUsed.toString(),
        gasRemaining: result.gasRemaining.toString(),
        tapeHash: hashTape(result.tape ?? []),
        tapeLength: (result.tape ?? []).length,
        ...(options.includeGasTrace && result.gasTrace
          ? { gasTrace: normalizeNodeGasTrace(result.gasTrace) }
          : {}),
        ...(options.includeGasChargeTape && result.gasChargeTape
          ? {
              gasChargeTape: normalizeNodeGasChargeTape(result.gasChargeTape),
            }
          : {}),
      },
    };
  }

  return {
    okValue: null,
    snapshot: {
      resultHash: null,
      errorCode: result.error.code,
      errorTag: 'tag' in result.error ? result.error.tag : null,
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
      tapeHash: hashTape(result.tape ?? []),
      tapeLength: (result.tape ?? []).length,
      ...(options.includeGasTrace && result.gasTrace
        ? { gasTrace: normalizeNodeGasTrace(result.gasTrace) }
        : {}),
      ...(options.includeGasChargeTape && result.gasChargeTape
        ? { gasChargeTape: normalizeNodeGasChargeTape(result.gasChargeTape) }
        : {}),
    },
  };
}

/**
 * @param {{program: any, manifest: any, input: any, gasLimit: bigint, includeGasTrace?: boolean, includeGasChargeTape?: boolean, gasChargeTapeCapacity?: number}} options
 * @returns {Snapshot}
 */
function runNativeEvaluation(options) {
  const manifest = validateAbiManifest(options.manifest);
  const manifestCanonical = hashAbiManifest(manifest);
  const contextBlobHex = bytesToHex(encodeDv(options.input));
  const profile = inferExecutionProfile(options.program);
  const args = [
    '--abi-manifest-hex',
    bytesToHex(manifestCanonical.bytes),
    '--abi-manifest-hash',
    manifestCanonical.hash,
    '--execution-profile',
    profile,
    '--context-blob-hex',
    contextBlobHex,
    '--gas-limit',
    options.gasLimit.toString(),
    '--report-gas',
    '--report-tape',
    ...(options.includeGasChargeTape
      ? [
          '--gas-charge-tape',
          '--gas-charge-tape-capacity',
          String(options.gasChargeTapeCapacity ?? 256),
        ]
      : []),
    ...(options.includeGasTrace ? ['--gas-trace'] : []),
    ...buildProgramArgs(options.program),
  ];
  const result = spawnSync(harnessPath, args, { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  const stdout = (result.stdout ?? '').trim();
  if (!stdout) {
    throw new Error(
      `native harness emitted empty output: ${result.stderr ?? ''}`,
    );
  }
  return parseNativeSnapshot(stdout, manifest, {
    includeGasTrace: options.includeGasTrace ?? false,
    includeGasChargeTape: options.includeGasChargeTape ?? false,
  });
}

function inferExecutionProfile(program) {
  return program.executionProfile ?? 'baseline-v1';
}

function buildProgramArgs(program) {
  if (program.version === 2 && program.sourceKind === 'module-pack') {
    const modulePack = program.source.modulePack;
    return [
      '--module-entry-specifier',
      modulePack.entrySpecifier,
      '--module-entry-export',
      modulePack.entryExport ?? 'default',
      '--module-pack-json',
      JSON.stringify(modulePack.modules),
    ];
  }

  if (program.version === 2 && program.sourceKind === 'script') {
    return ['--parity-eval', '--eval', program.source.code];
  }

  return ['--parity-eval', '--eval', program.code];
}

function parseNativeSnapshot(stdout, manifest, options) {
  const gasMatch = stdout.match(/ GAS remaining=(\d+)(?: used=(\d+))?/);
  if (!gasMatch || gasMatch.index == null) {
    throw new Error(`missing gas trailer in native output: ${stdout}`);
  }
  const tapeMarker = ' TAPE ';
  const tapeIndex = stdout.lastIndexOf(tapeMarker);
  if (tapeIndex < 0) {
    throw new Error(`missing tape trailer in native output: ${stdout}`);
  }
  const chargeTapeMarker = ' CHARGE_TAPE ';
  const chargeTapeIndex = stdout.lastIndexOf(chargeTapeMarker);

  const gasStart = gasMatch.index;
  const gasRemaining = gasMatch[1];
  const gasUsed = gasMatch[2] ?? '0';
  const trace = parseNativeTrace(stdout, tapeIndex, options);
  const tapeEnd =
    chargeTapeIndex > tapeIndex ? chargeTapeIndex : stdout.length;
  const tapeJson = stdout
    .slice(tapeIndex + tapeMarker.length, tapeEnd)
    .trim();
  const tape = parseNativeTape(tapeJson);
  const gasChargeTape =
    options.includeGasChargeTape && chargeTapeIndex > tapeIndex
      ? parseNativeGasChargeTape(
          stdout.slice(chargeTapeIndex + chargeTapeMarker.length).trim(),
        )
      : null;

  if (stdout.startsWith('RESULT ')) {
    const valueJson = stdout.slice('RESULT '.length, gasStart);
    const value = JSON.parse(valueJson);
    return {
      resultHash: hashDv(value),
      errorCode: null,
      errorTag: null,
      gasUsed,
      gasRemaining,
      tapeHash: hashTape(tape),
      tapeLength: tape.length,
      ...(trace ? { gasTrace: trace } : {}),
      ...(gasChargeTape ? { gasChargeTape } : {}),
    };
  }

  if (stdout.startsWith('ERROR ')) {
    const message = stdout.slice('ERROR '.length, gasStart);
    const mapped = mapVmError(message, validateAbiManifest(manifest));
    return {
      resultHash: null,
      errorCode: mapped.code,
      errorTag: mapped.tag,
      gasUsed,
      gasRemaining,
      tapeHash: hashTape(tape),
      tapeLength: tape.length,
      ...(trace ? { gasTrace: trace } : {}),
      ...(gasChargeTape ? { gasChargeTape } : {}),
    };
  }

  throw new Error(`unexpected native output prefix: ${stdout}`);
}

function parseNativeTrace(stdout, tapeIndex, options) {
  if (!options.includeGasTrace) {
    return null;
  }
  const marker = ' TRACE ';
  const traceIndex = stdout.lastIndexOf(marker);
  if (traceIndex < 0 || traceIndex > tapeIndex) {
    return null;
  }
  const traceJson = stdout.slice(traceIndex + marker.length, tapeIndex).trim();
  if (!traceJson) {
    return null;
  }
  const parsed = JSON.parse(traceJson);
  return normalizeNativeGasTrace(parsed);
}

function parseNativeTape(tapeJson) {
  const parsed = JSON.parse(tapeJson);
  if (!Array.isArray(parsed)) {
    throw new Error(`native tape must be array JSON: ${tapeJson}`);
  }
  return parsed.map((record) => ({
    fnId: Number(record.fnId),
    reqLen: Number(record.reqLen),
    respLen: Number(record.respLen),
    units: Number(record.units),
    gasPre: BigInt(record.gasPre),
    gasPost: BigInt(record.gasPost),
    isError: Boolean(record.isError),
    chargeFailed: Boolean(record.chargeFailed),
    reqHash: String(record.reqHash),
    respHash: String(record.respHash),
  }));
}

function parseNativeGasChargeTape(chargeTapeJson) {
  const parsed = JSON.parse(chargeTapeJson);
  if (!Array.isArray(parsed)) {
    throw new Error(`native charge tape must be array JSON: ${chargeTapeJson}`);
  }
  return parsed.map((record) => ({
    siteId: Number(record.siteId),
    kind: Number(record.kind),
    flags: Number(record.flags),
    amount: String(record.amount),
    logicalUnits: String(record.logicalUnits),
    gasBefore: String(record.gasBefore),
    gasAfter: String(record.gasAfter),
  }));
}

function compareSnapshots(
  suite,
  fixtureName,
  snapshots,
  comparison = { ignoreGas: false },
  metadata = {
    executionProfile: 'unknown',
    sourceKind: 'script',
    gasVersion: null,
  },
) {
  const baselineEntry = comparison.gasDeltaBaselineMap?.get(
    `${suite}:${fixtureName}`,
  );
  const match = isSnapshotEqual(
    snapshots.node,
    snapshots.native,
    comparison,
    baselineEntry,
  );
  const gasDeltaUsed =
    BigInt(snapshots.native.gasUsed) - BigInt(snapshots.node.gasUsed);
  const gasDeltaRemaining =
    BigInt(snapshots.native.gasRemaining) - BigInt(snapshots.node.gasRemaining);
  const gasTraceDelta =
    comparison.includeGasTrace &&
    snapshots.node.gasTrace &&
    snapshots.native.gasTrace
      ? computeGasTraceDelta(snapshots.node.gasTrace, snapshots.native.gasTrace)
      : null;
  const tracedGasDeltaUsed = gasTraceDelta
    ? sumTracedGasDelta(gasTraceDelta)
    : null;
  const residualGasDeltaUsed =
    tracedGasDeltaUsed !== null ? gasDeltaUsed - tracedGasDeltaUsed : null;
  const allocationGasDeltaUsed = gasTraceDelta
    ? BigInt(String(gasTraceDelta.allocationGas ?? '0'))
    : null;
  const nonAllocationTracedGasDeltaUsed =
    tracedGasDeltaUsed !== null && allocationGasDeltaUsed !== null
      ? tracedGasDeltaUsed - allocationGasDeltaUsed
      : null;
  const chargeTapeComparison =
    comparison.includeGasChargeTape &&
    snapshots.node.gasChargeTape &&
    snapshots.native.gasChargeTape
      ? compareGasChargeTape(
          snapshots.node.gasChargeTape,
          snapshots.native.gasChargeTape,
        )
      : null;
  return {
    suite,
    fixtureName,
    match,
    metadata,
    gasDeltaUsed: gasDeltaUsed.toString(),
    gasDeltaRemaining: gasDeltaRemaining.toString(),
    ...(baselineEntry
      ? {
          expectedGasDeltaUsed: baselineEntry.gasDeltaUsed,
          expectedGasDeltaRemaining: baselineEntry.gasDeltaRemaining,
        }
      : {}),
    ...(gasTraceDelta
      ? {
          gasTraceDelta,
          tracedGasDeltaUsed: tracedGasDeltaUsed.toString(),
          residualGasDeltaUsed: residualGasDeltaUsed.toString(),
          allocationGasDeltaUsed: allocationGasDeltaUsed.toString(),
          nonAllocationTracedGasDeltaUsed:
            nonAllocationTracedGasDeltaUsed.toString(),
        }
      : {}),
    ...(chargeTapeComparison
      ? {
          nodeChargeTapeHash: chargeTapeComparison.nodeHash,
          nativeChargeTapeHash: chargeTapeComparison.nativeHash,
          nodeChargeTapeLength: chargeTapeComparison.nodeLength,
          nativeChargeTapeLength: chargeTapeComparison.nativeLength,
          ...(chargeTapeComparison.siteDeltaSummaryTop
            ? {
                chargeTapeSiteDeltaSummaryTop:
                  chargeTapeComparison.siteDeltaSummaryTop,
              }
            : {}),
          ...(chargeTapeComparison.firstDivergence
            ? {
                firstDivergentChargeIndex:
                  chargeTapeComparison.firstDivergence.index,
                firstDivergentChargeSiteId:
                  chargeTapeComparison.firstDivergence.siteId,
                firstDivergentChargeNodeGasBefore:
                  chargeTapeComparison.firstDivergence.nodeGasBefore,
                firstDivergentChargeNativeGasBefore:
                  chargeTapeComparison.firstDivergence.nativeGasBefore,
                firstDivergentChargeNodeGasAfter:
                  chargeTapeComparison.firstDivergence.nodeGasAfter,
                firstDivergentChargeNativeGasAfter:
                  chargeTapeComparison.firstDivergence.nativeGasAfter,
              }
            : {}),
        }
      : {}),
    node: snapshots.node,
    native: snapshots.native,
    ...(match
      ? {}
      : {
          differences: listSnapshotDifferences(
            snapshots.node,
            snapshots.native,
          ),
        }),
  };
}

function isSnapshotEqual(left, right, comparison, baselineEntry) {
  const baseMatch =
    left.resultHash === right.resultHash &&
    left.errorCode === right.errorCode &&
    left.errorTag === right.errorTag &&
    left.tapeHash === right.tapeHash &&
    left.tapeLength === right.tapeLength;
  if (!baseMatch) {
    return false;
  }
  if (
    comparison?.includeGasChargeTape &&
    !areGasChargeTapesEqual(left.gasChargeTape, right.gasChargeTape)
  ) {
    return false;
  }
  if (comparison?.ignoreGas) {
    return true;
  }
  if (baselineEntry) {
    const normalizedNativeUsed =
      BigInt(right.gasUsed) - BigInt(baselineEntry.gasDeltaUsed);
    const normalizedNativeRemaining =
      BigInt(right.gasRemaining) - BigInt(baselineEntry.gasDeltaRemaining);
    return (
      normalizedNativeUsed === BigInt(left.gasUsed) &&
      normalizedNativeRemaining === BigInt(left.gasRemaining)
    );
  }
  return (
    left.gasUsed === right.gasUsed && left.gasRemaining === right.gasRemaining
  );
}

function areGasChargeTapesEqual(left, right) {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

function compareGasChargeTape(nodeRecords, nativeRecords) {
  const nodeHash = hashGasChargeTape(nodeRecords);
  const nativeHash = hashGasChargeTape(nativeRecords);
  const maxLength = Math.max(nodeRecords.length, nativeRecords.length);
  const siteDeltaSummary = summarizeChargeSiteDeltas(nodeRecords, nativeRecords);
  let firstDivergence = null;
  for (let index = 0; index < maxLength; index += 1) {
    const left = nodeRecords[index];
    const right = nativeRecords[index];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      firstDivergence = {
        index,
        siteId: Number(
          (right && right.siteId) ?? (left && left.siteId) ?? -1,
        ),
        nodeGasBefore: left?.gasBefore ?? null,
        nativeGasBefore: right?.gasBefore ?? null,
        nodeGasAfter: left?.gasAfter ?? null,
        nativeGasAfter: right?.gasAfter ?? null,
      };
      break;
    }
  }
  return {
    nodeHash,
    nativeHash,
    nodeLength: nodeRecords.length,
    nativeLength: nativeRecords.length,
    ...(siteDeltaSummary.length > 0
      ? { siteDeltaSummaryTop: siteDeltaSummary }
      : {}),
    firstDivergence,
  };
}

function hashGasChargeTape(records) {
  return sha256Hex(JSON.stringify(records));
}

function summarizeChargeSiteDeltas(nodeRecords, nativeRecords, limit = 8) {
  const nodeBySite = new Map();
  const nativeBySite = new Map();
  for (const record of nodeRecords) {
    const siteId = Number(record.siteId);
    const entry = nodeBySite.get(siteId) ?? { gas: 0n, count: 0n };
    entry.gas += BigInt(record.amount);
    entry.count += 1n;
    nodeBySite.set(siteId, entry);
  }
  for (const record of nativeRecords) {
    const siteId = Number(record.siteId);
    const entry = nativeBySite.get(siteId) ?? { gas: 0n, count: 0n };
    entry.gas += BigInt(record.amount);
    entry.count += 1n;
    nativeBySite.set(siteId, entry);
  }
  const allSiteIds = new Set([...nodeBySite.keys(), ...nativeBySite.keys()]);
  const rows = [];
  for (const siteId of allSiteIds) {
    const nodeEntry = nodeBySite.get(siteId) ?? { gas: 0n, count: 0n };
    const nativeEntry = nativeBySite.get(siteId) ?? { gas: 0n, count: 0n };
    const deltaGas = nodeEntry.gas - nativeEntry.gas;
    const deltaCount = nodeEntry.count - nativeEntry.count;
    if (deltaGas === 0n && deltaCount === 0n) {
      continue;
    }
    rows.push({
      siteId,
      deltaGas: deltaGas.toString(),
      deltaCount: deltaCount.toString(),
      nodeGas: nodeEntry.gas.toString(),
      nativeGas: nativeEntry.gas.toString(),
      nodeCount: nodeEntry.count.toString(),
      nativeCount: nativeEntry.count.toString(),
    });
  }
  rows.sort((left, right) => {
    const leftGasAbs = bigIntAbs(BigInt(left.deltaGas));
    const rightGasAbs = bigIntAbs(BigInt(right.deltaGas));
    if (leftGasAbs === rightGasAbs) {
      const leftCountAbs = bigIntAbs(BigInt(left.deltaCount));
      const rightCountAbs = bigIntAbs(BigInt(right.deltaCount));
      if (leftCountAbs === rightCountAbs) {
        return Number(left.siteId) - Number(right.siteId);
      }
      return rightCountAbs > leftCountAbs ? 1 : -1;
    }
    return rightGasAbs > leftGasAbs ? 1 : -1;
  });
  return rows.slice(0, limit);
}

function listSnapshotDifferences(nodeSnapshot, nativeSnapshot) {
  const differences = [];
  for (const key of [
    'resultHash',
    'errorCode',
    'errorTag',
    'gasUsed',
    'gasRemaining',
    'tapeHash',
    'tapeLength',
  ]) {
    if (nodeSnapshot[key] !== nativeSnapshot[key]) {
      differences.push({
        field: key,
        node: nodeSnapshot[key],
        native: nativeSnapshot[key],
      });
    }
  }
  return differences;
}

function createSuiteSummary(suite, reports) {
  const mismatches = reports.filter((report) => !report.match).length;
  const absGasUsed = reports.map((report) =>
    bigIntAbs(BigInt(report.gasDeltaUsed)),
  );
  const absGasRemaining = reports.map((report) =>
    bigIntAbs(BigInt(report.gasDeltaRemaining)),
  );
  const maxAbsGasUsed =
    absGasUsed.length > 0
      ? absGasUsed.reduce((max, value) => (value > max ? value : max), 0n)
      : 0n;
  const maxAbsGasRemaining =
    absGasRemaining.length > 0
      ? absGasRemaining.reduce((max, value) => (value > max ? value : max), 0n)
      : 0n;
  return {
    suite,
    totalFixtures: reports.length,
    mismatches,
    matched: reports.length - mismatches,
    maxAbsGasDeltaUsed: maxAbsGasUsed.toString(),
    maxAbsGasDeltaRemaining: maxAbsGasRemaining.toString(),
  };
}

function buildReport({ fixtureReports, suites, mismatchCount }) {
  const gasTraceSummary = summarizeGasTraceDeltas(fixtureReports);
  const gasVersions = [
    ...new Set(
      fixtureReports
        .map((report) => report.metadata?.gasVersion)
        .filter((value) => value !== null && value !== undefined),
    ),
  ].sort((left, right) => Number(left) - Number(right));
  const payload = {
    generatedAt: new Date().toISOString(),
    gitCommit: readGitCommit(),
    environment: {
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      hostname: os.hostname(),
      nodeVersion: process.version,
    },
    ...(GAS_VERSION !== null ? { gasVersion: GAS_VERSION } : {}),
    suites,
    fixtureReports,
    mismatchCount,
    ...(gasVersions.length > 0 ? { gasVersions } : {}),
    ...(gasTraceSummary ? { gasTraceSummary } : {}),
  };
  const digest = sha256Hex(JSON.stringify(payload));
  return {
    ...payload,
    signature: {
      algorithm: 'sha256',
      digest,
    },
  };
}

function readGasVersion() {
  if (!existsSync(GAS_SPEC_PATH)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(GAS_SPEC_PATH, 'utf8'));
    if (Number.isInteger(parsed?.gasVersion) && parsed.gasVersion >= 0) {
      return parsed.gasVersion;
    }
    return null;
  } catch {
    return null;
  }
}

function hashDv(value) {
  return sha256Hex(Buffer.from(encodeDv2(value)));
}

function hashTape(tape) {
  if (tape.length === 0) {
    return null;
  }
  return sha256Hex(Buffer.from(serializeHostTape(tape)));
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeProgram(program) {
  if (program.version === 2) {
    return validateProgramArtifactV2(program);
  }
  return validateProgramArtifact(program);
}

function extractProgramMetadata(program) {
  const executionProfile = program.executionProfile ?? 'baseline-v1';
  const sourceKind =
    program.version === 2 ? String(program.sourceKind) : 'script';
  const gasVersion = program.gasVersion ?? null;
  return {
    executionProfile,
    sourceKind,
    gasVersion,
  };
}

function normalizeJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJsonValue(entry));
  }
  if (value && typeof value === 'object') {
    const normalized = {};
    for (const [key, entry] of Object.entries(value)) {
      normalized[key] = normalizeJsonValue(entry);
    }
    return normalized;
  }
  return value;
}

function normalizeNodeGasTrace(trace) {
  const normalizeBigIntString = (value) => value.toString();
  return {
    opcodeCount: normalizeBigIntString(trace.opcodeCount),
    opcodeGas: normalizeBigIntString(trace.opcodeGas),
    arrayCbBaseCount: normalizeBigIntString(trace.arrayCbBaseCount),
    arrayCbBaseGas: normalizeBigIntString(trace.arrayCbBaseGas),
    arrayCbPerElCount: normalizeBigIntString(trace.arrayCbPerElCount),
    arrayCbPerElGas: normalizeBigIntString(trace.arrayCbPerElGas),
    allocationCount: normalizeBigIntString(trace.allocationCount),
    allocationRequestedBytes: normalizeBigIntString(
      trace.allocationRequestedBytes ?? trace.allocationBytes,
    ),
    allocationBytes: normalizeBigIntString(trace.allocationBytes),
    allocationGas: normalizeBigIntString(trace.allocationGas),
    jsonParseCount: normalizeBigIntString(trace.jsonParseCount),
    jsonParseGas: normalizeBigIntString(trace.jsonParseGas),
    jsonParseInputBytes: normalizeBigIntString(trace.jsonParseInputBytes),
    jsonParseValues: normalizeBigIntString(trace.jsonParseValues),
    jsonParseObjectEntries: normalizeBigIntString(trace.jsonParseObjectEntries),
    jsonParseArrayElements: normalizeBigIntString(trace.jsonParseArrayElements),
    jsonStringifyCount: normalizeBigIntString(trace.jsonStringifyCount),
    jsonStringifyGas: normalizeBigIntString(trace.jsonStringifyGas),
    jsonStringifyOutputBytes: normalizeBigIntString(
      trace.jsonStringifyOutputBytes,
    ),
    jsonStringifyValues: normalizeBigIntString(trace.jsonStringifyValues),
    jsonStringifyObjectEntries: normalizeBigIntString(
      trace.jsonStringifyObjectEntries,
    ),
    jsonStringifyArrayElements: normalizeBigIntString(
      trace.jsonStringifyArrayElements,
    ),
    jsonStringifySortComparisons: normalizeBigIntString(
      trace.jsonStringifySortComparisons,
    ),
    hostCallPreCount: normalizeBigIntString(trace.hostCallPreCount),
    hostCallPreGas: normalizeBigIntString(trace.hostCallPreGas),
    hostCallPostCount: normalizeBigIntString(trace.hostCallPostCount),
    hostCallPostGas: normalizeBigIntString(trace.hostCallPostGas),
  };
}

function normalizeNodeGasChargeTape(records) {
  return records.map((record) => ({
    siteId: Number(record.siteId),
    kind: Number(record.kind),
    flags: Number(record.flags),
    amount: record.amount.toString(),
    logicalUnits: record.logicalUnits.toString(),
    gasBefore: record.gasBefore.toString(),
    gasAfter: record.gasAfter.toString(),
  }));
}

function normalizeNativeGasTrace(trace) {
  const from = (value) => String(value ?? '0');
  return {
    opcodeCount: from(trace.opcodeCount),
    opcodeGas: from(trace.opcodeGas),
    arrayCbBaseCount: from(trace.arrayCbBase?.count),
    arrayCbBaseGas: from(trace.arrayCbBase?.gas),
    arrayCbPerElCount: from(trace.arrayCbPerEl?.count),
    arrayCbPerElGas: from(trace.arrayCbPerEl?.gas),
    allocationCount: from(trace.alloc?.count),
    allocationRequestedBytes: from(
      trace.alloc?.requestedBytes ?? trace.alloc?.bytes,
    ),
    allocationBytes: from(trace.alloc?.bytes),
    allocationGas: from(trace.alloc?.gas),
    jsonParseCount: from(trace.jsonParse?.count),
    jsonParseGas: from(trace.jsonParse?.gas),
    jsonParseInputBytes: from(trace.jsonParse?.inputBytes),
    jsonParseValues: from(trace.jsonParse?.values),
    jsonParseObjectEntries: from(trace.jsonParse?.objectEntries),
    jsonParseArrayElements: from(trace.jsonParse?.arrayElements),
    jsonStringifyCount: from(trace.jsonStringify?.count),
    jsonStringifyGas: from(trace.jsonStringify?.gas),
    jsonStringifyOutputBytes: from(trace.jsonStringify?.outputBytes),
    jsonStringifyValues: from(trace.jsonStringify?.values),
    jsonStringifyObjectEntries: from(trace.jsonStringify?.objectEntries),
    jsonStringifyArrayElements: from(trace.jsonStringify?.arrayElements),
    jsonStringifySortComparisons: from(trace.jsonStringify?.sortComparisons),
    hostCallPreCount: from(trace.hostCallPre?.count),
    hostCallPreGas: from(trace.hostCallPre?.gas),
    hostCallPostCount: from(trace.hostCallPost?.count),
    hostCallPostGas: from(trace.hostCallPost?.gas),
  };
}

function computeGasTraceDelta(nodeTrace, nativeTrace) {
  const delta = {};
  const keys = Object.keys(nodeTrace);
  for (const key of keys) {
    const left = BigInt(nodeTrace[key] ?? '0');
    const right = BigInt(nativeTrace[key] ?? '0');
    delta[key] = (right - left).toString();
  }
  return delta;
}

function sumTracedGasDelta(gasTraceDelta) {
  const gasKeys = [
    'opcodeGas',
    'arrayCbBaseGas',
    'arrayCbPerElGas',
    'allocationGas',
    'jsonParseGas',
    'jsonStringifyGas',
    'hostCallPreGas',
    'hostCallPostGas',
  ];
  let sum = 0n;
  for (const key of gasKeys) {
    sum += BigInt(String(gasTraceDelta[key] ?? '0'));
  }
  return sum;
}

function readGitCommit() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return 'unknown';
  }
  return (result.stdout ?? '').trim() || 'unknown';
}

function parseArgs(args) {
  let outPath = null;
  let comparePath = null;
  let assertMatch = false;
  let ignoreGas = false;
  let includeGasTrace = false;
  let includeGasChargeTape = false;
  let gasChargeTapeCapacity = null;
  let gasDeltaBaselinePath = null;
  let writeGasDeltaBaselinePath = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--out') {
      outPath = args[i + 1] ? args[i + 1] : null;
      i += 1;
      continue;
    }
    if (arg === '--compare') {
      comparePath = args[i + 1] ? args[i + 1] : null;
      i += 1;
      continue;
    }
    if (arg === '--assert-match') {
      assertMatch = true;
      continue;
    }
    if (arg === '--ignore-gas') {
      ignoreGas = true;
      continue;
    }
    if (arg === '--include-gas-trace') {
      includeGasTrace = true;
      continue;
    }
    if (arg === '--include-gas-charge-tape') {
      includeGasChargeTape = true;
      continue;
    }
    if (arg === '--gas-charge-tape-capacity') {
      const value = args[i + 1] ? Number.parseInt(args[i + 1], 10) : NaN;
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('--gas-charge-tape-capacity must be a non-negative integer');
      }
      gasChargeTapeCapacity = value;
      i += 1;
      continue;
    }
    if (arg === '--gas-delta-baseline') {
      gasDeltaBaselinePath = args[i + 1] ? args[i + 1] : null;
      i += 1;
      continue;
    }
    if (arg === '--write-gas-delta-baseline') {
      writeGasDeltaBaselinePath = args[i + 1] ? args[i + 1] : null;
      i += 1;
    }
  }
  return {
    outPath,
    comparePath,
    assertMatch,
    ignoreGas,
    includeGasTrace,
    includeGasChargeTape,
    gasChargeTapeCapacity,
    gasDeltaBaselinePath,
    writeGasDeltaBaselinePath,
  };
}

async function compareWithReport(currentReport, comparePath) {
  const baselineText = await readFile(path.resolve(comparePath), 'utf8');
  const baseline = JSON.parse(baselineText);

  const baselineByFixture = new Map();
  for (const report of baseline.fixtureReports ?? []) {
    baselineByFixture.set(`${report.suite}:${report.fixtureName}`, report);
  }

  const differences = [];
  for (const current of currentReport.fixtureReports) {
    const key = `${current.suite}:${current.fixtureName}`;
    const previous = baselineByFixture.get(key);
    if (!previous) {
      differences.push({
        suite: current.suite,
        fixtureName: current.fixtureName,
        reason: 'missing in comparison report',
      });
      continue;
    }

    const currentSnapshot = stableFixtureSnapshot(current);
    const previousSnapshot = stableFixtureSnapshot(previous);
    if (currentSnapshot !== previousSnapshot) {
      differences.push({
        suite: current.suite,
        fixtureName: current.fixtureName,
        reason: 'snapshot differs',
      });
    }
  }

  return {
    differenceCount: differences.length,
    differences,
  };
}

function stableFixtureSnapshot(report) {
  return JSON.stringify({
    match: report.match,
    node: report.node,
    native: report.native,
  });
}

function bigIntAbs(value) {
  return value < 0n ? -value : value;
}

function summarizeGasTraceDeltas(fixtureReports) {
  const byCounter = new Map();
  const residualByFixture = [];
  const allocationByFixture = [];
  const residualHistogram = new Map();
  const residualByProfile = new Map();
  let fixturesWithTrace = 0;

  for (const report of fixtureReports) {
    if (!report.gasTraceDelta || typeof report.gasTraceDelta !== 'object') {
      continue;
    }
    fixturesWithTrace += 1;
    const fixtureKey = `${report.suite}:${report.fixtureName}`;
    if (report.residualGasDeltaUsed !== undefined) {
      const residualValue = String(report.residualGasDeltaUsed);
      residualByFixture.push({
        fixture: fixtureKey,
        residualGasDeltaUsed: residualValue,
      });

      const histogramEntry = residualHistogram.get(residualValue) ?? {
        residualGasDeltaUsed: residualValue,
        count: 0,
        fixtures: [],
      };
      histogramEntry.count += 1;
      if (histogramEntry.fixtures.length < 6) {
        histogramEntry.fixtures.push(fixtureKey);
      }
      residualHistogram.set(residualValue, histogramEntry);

      const profile = String(report.metadata?.executionProfile ?? 'unknown');
      const profileEntry = residualByProfile.get(profile) ?? {
        executionProfile: profile,
        count: 0,
        signedResidual: 0n,
        totalAbsResidual: 0n,
        maxAbsResidual: 0n,
        maxAbsFixture: null,
      };
      const residualBigInt = BigInt(residualValue);
      profileEntry.count += 1;
      profileEntry.signedResidual += residualBigInt;
      profileEntry.totalAbsResidual += bigIntAbs(residualBigInt);
      if (bigIntAbs(residualBigInt) > profileEntry.maxAbsResidual) {
        profileEntry.maxAbsResidual = bigIntAbs(residualBigInt);
        profileEntry.maxAbsFixture = fixtureKey;
      }
      residualByProfile.set(profile, profileEntry);
    }
    if (report.allocationGasDeltaUsed !== undefined) {
      allocationByFixture.push({
        fixture: fixtureKey,
        allocationGasDeltaUsed: String(report.allocationGasDeltaUsed),
      });
    }
    for (const [counter, rawDelta] of Object.entries(report.gasTraceDelta)) {
      const delta = BigInt(String(rawDelta));
      const current = byCounter.get(counter) ?? {
        counter,
        signedDelta: 0n,
        totalAbsDelta: 0n,
        maxAbsDelta: 0n,
        maxAbsFixture: null,
      };
      current.signedDelta += delta;
      current.totalAbsDelta += bigIntAbs(delta);
      if (bigIntAbs(delta) > current.maxAbsDelta) {
        current.maxAbsDelta = bigIntAbs(delta);
        current.maxAbsFixture = fixtureKey;
      }
      byCounter.set(counter, current);
    }
  }

  if (fixturesWithTrace === 0) {
    return null;
  }

  const counters = [...byCounter.values()]
    .sort((left, right) => {
      if (left.totalAbsDelta === right.totalAbsDelta) {
        return left.counter.localeCompare(right.counter);
      }
      return left.totalAbsDelta > right.totalAbsDelta ? -1 : 1;
    })
    .map((entry) => ({
      counter: entry.counter,
      signedDelta: entry.signedDelta.toString(),
      totalAbsDelta: entry.totalAbsDelta.toString(),
      maxAbsDelta: entry.maxAbsDelta.toString(),
      maxAbsFixture: entry.maxAbsFixture,
    }));

  const topResiduals = residualByFixture
    .map((entry) => ({
      fixture: entry.fixture,
      residualGasDeltaUsed: entry.residualGasDeltaUsed,
      absResidualGasDeltaUsed: bigIntAbs(
        BigInt(entry.residualGasDeltaUsed),
      ).toString(),
    }))
    .sort((left, right) => {
      const leftAbs = BigInt(left.absResidualGasDeltaUsed);
      const rightAbs = BigInt(right.absResidualGasDeltaUsed);
      if (leftAbs === rightAbs) {
        return left.fixture.localeCompare(right.fixture);
      }
      return leftAbs > rightAbs ? -1 : 1;
    })
    .slice(0, 10);

  const topAllocationGasDeltas = allocationByFixture
    .map((entry) => ({
      fixture: entry.fixture,
      allocationGasDeltaUsed: entry.allocationGasDeltaUsed,
      absAllocationGasDeltaUsed: bigIntAbs(
        BigInt(entry.allocationGasDeltaUsed),
      ).toString(),
    }))
    .sort((left, right) => {
      const leftAbs = BigInt(left.absAllocationGasDeltaUsed);
      const rightAbs = BigInt(right.absAllocationGasDeltaUsed);
      if (leftAbs === rightAbs) {
        return left.fixture.localeCompare(right.fixture);
      }
      return leftAbs > rightAbs ? -1 : 1;
    })
    .slice(0, 10);

  const residualSignatures = [...residualHistogram.values()]
    .sort((left, right) => {
      if (left.count === right.count) {
        const leftResidual = BigInt(left.residualGasDeltaUsed);
        const rightResidual = BigInt(right.residualGasDeltaUsed);
        if (leftResidual === rightResidual) {
          return 0;
        }
        return rightResidual > leftResidual ? 1 : -1;
      }
      return right.count - left.count;
    })
    .map((entry) => ({
      residualGasDeltaUsed: entry.residualGasDeltaUsed,
      count: entry.count,
      fixtures: entry.fixtures,
    }));

  const residualProfiles = [...residualByProfile.values()]
    .sort((left, right) => {
      if (left.totalAbsResidual === right.totalAbsResidual) {
        return left.executionProfile.localeCompare(right.executionProfile);
      }
      return left.totalAbsResidual > right.totalAbsResidual ? -1 : 1;
    })
    .map((entry) => ({
      executionProfile: entry.executionProfile,
      count: entry.count,
      signedResidual: entry.signedResidual.toString(),
      totalAbsResidual: entry.totalAbsResidual.toString(),
      maxAbsResidual: entry.maxAbsResidual.toString(),
      maxAbsFixture: entry.maxAbsFixture,
    }));

  return {
    fixturesWithTrace,
    counterCount: counters.length,
    counters,
    topAllocationGasDeltas,
    topResiduals,
    residualSignatures,
    residualProfiles,
  };
}

function buildGasDeltaBaseline(report) {
  const entries = report.fixtureReports
    .map((fixtureReport) => ({
      suite: fixtureReport.suite,
      fixtureName: fixtureReport.fixtureName,
      gasDeltaUsed: fixtureReport.gasDeltaUsed,
      gasDeltaRemaining: fixtureReport.gasDeltaRemaining,
    }))
    .sort((left, right) => {
      const leftKey = `${left.suite}:${left.fixtureName}`;
      const rightKey = `${right.suite}:${right.fixtureName}`;
      return leftKey.localeCompare(rightKey);
    });

  return {
    version: 1,
    entries,
  };
}

async function loadGasDeltaBaselineMap(baselinePath) {
  const baselineText = await readFile(path.resolve(baselinePath), 'utf8');
  const baseline = JSON.parse(baselineText);
  const baselineEntries = Array.isArray(baseline.entries)
    ? baseline.entries
    : [];
  const lookup = new Map();
  for (const entry of baselineEntries) {
    lookup.set(`${entry.suite}:${entry.fixtureName}`, {
      gasDeltaUsed: String(entry.gasDeltaUsed),
      gasDeltaRemaining: String(entry.gasDeltaRemaining),
    });
  }
  return lookup;
}

async function compareGasDeltaBaseline(currentReport, baselinePath) {
  const baselineText = await readFile(path.resolve(baselinePath), 'utf8');
  const baseline = JSON.parse(baselineText);
  const baselineEntries = Array.isArray(baseline.entries)
    ? baseline.entries
    : [];

  const baselineByFixture = new Map();
  for (const entry of baselineEntries) {
    baselineByFixture.set(`${entry.suite}:${entry.fixtureName}`, entry);
  }

  const differences = [];
  for (const fixtureReport of currentReport.fixtureReports) {
    const key = `${fixtureReport.suite}:${fixtureReport.fixtureName}`;
    const expected = baselineByFixture.get(key);
    if (!expected) {
      differences.push({
        suite: fixtureReport.suite,
        fixtureName: fixtureReport.fixtureName,
        reason: 'missing fixture in gas delta baseline',
      });
      continue;
    }
    if (
      String(expected.gasDeltaUsed) !== String(fixtureReport.gasDeltaUsed) ||
      String(expected.gasDeltaRemaining) !==
        String(fixtureReport.gasDeltaRemaining)
    ) {
      differences.push({
        suite: fixtureReport.suite,
        fixtureName: fixtureReport.fixtureName,
        reason: 'gas delta mismatch',
        expected: {
          gasDeltaUsed: String(expected.gasDeltaUsed),
          gasDeltaRemaining: String(expected.gasDeltaRemaining),
        },
        actual: {
          gasDeltaUsed: String(fixtureReport.gasDeltaUsed),
          gasDeltaRemaining: String(fixtureReport.gasDeltaRemaining),
        },
      });
    }
  }

  return {
    differenceCount: differences.length,
    differences,
  };
}

await main();
