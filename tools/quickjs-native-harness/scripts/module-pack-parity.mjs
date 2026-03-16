#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jiti from 'jiti';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const harnessPath = path.join(
  repoRoot,
  'tools',
  'quickjs-native-harness',
  'dist',
  'quickjs-native-harness',
);
const manifestHex = readFileSync(
  path.join(
    repoRoot,
    'libs',
    'test-harness',
    'fixtures',
    'abi-manifest',
    'host-v1.bytes.hex',
  ),
  'utf8',
).replace(/[\r\n\s]+/g, '');
const manifestHash = readFileSync(
  path.join(
    repoRoot,
    'libs',
    'test-harness',
    'fixtures',
    'abi-manifest',
    'host-v1.hash',
  ),
  'utf8',
).trim();
const manifestArgs = [
  '--abi-manifest-hex',
  manifestHex,
  '--abi-manifest-hash',
  manifestHash,
];

if (!existsSync(harnessPath)) {
  throw new Error(
    `Native harness not found at ${harnessPath}. Build quickjs-native-harness first.`,
  );
}

const require = jiti(import.meta.url);
const {
  MODULE_PACK_FIXTURES,
  serializeHostTape,
} = require('../../../libs/test-harness/src/index.ts');
const { encodeDv } = require('../../../libs/dv/src/index.ts');

const MODULE_PACK_NATIVE_BASELINES = {
  'module-pack-default-export': {
    ok: true,
    valueHash:
      'ca358758f6d27e6cf45272937977a748fd88391db679ceda7dc7bf1f005ee879',
    errorCode: null,
    errorTag: null,
    gasUsed: '1316',
    gasRemaining: '48684',
    tapeHash: null,
    tapeLength: 0,
  },
  'module-pack-named-export': {
    ok: true,
    valueHash:
      '7f83f7bda2d63959d34767689f06d47576683d378d9eb8d09386c9a020395c53',
    errorCode: null,
    errorTag: null,
    gasUsed: '1355',
    gasRemaining: '48645',
    tapeHash: null,
    tapeLength: 0,
  },
  'module-pack-cyclic-imports': {
    ok: true,
    valueHash:
      '7f83f7bda2d63959d34767689f06d47576683d378d9eb8d09386c9a020395c53',
    errorCode: null,
    errorTag: null,
    gasUsed: '1754',
    gasRemaining: '48246',
    tapeHash: null,
    tapeLength: 0,
  },
  'module-pack-host-call-tape': {
    ok: true,
    valueHash:
      'da95a2e5e931c6478e2dbc7d03b381337d481020e16179cc7c45e0b4e3bf13fd',
    errorCode: null,
    errorTag: null,
    gasUsed: '1450',
    gasRemaining: '48550',
    tapeHash:
      'a5b1bdd5ceb469c9dbe33cceebff0225b36b30496f7af9a7d124bdaf7976b52d',
    tapeLength: 1,
  },
  'module-pack-missing-entry-specifier': {
    ok: false,
    valueHash: null,
    errorCode: 'MODULE_SPECIFIER_NOT_FOUND',
    errorTag: 'vm/module_pack',
    gasUsed: '467',
    gasRemaining: '49533',
    tapeHash: null,
    tapeLength: 0,
  },
  'module-pack-missing-export': {
    ok: false,
    valueHash: null,
    errorCode: 'MODULE_EXPORT_MISSING',
    errorTag: 'vm/module_pack',
    gasUsed: '1117',
    gasRemaining: '48883',
    tapeHash: null,
    tapeLength: 0,
  },
};

const MODULE_PACK_ERROR_CODE_MAP = [
  ['ModuleSpecifierNotFound', 'MODULE_SPECIFIER_NOT_FOUND'],
  ['ModuleExportMissing', 'MODULE_EXPORT_MISSING'],
  ['ModuleResolutionError', 'MODULE_RESOLUTION_ERROR'],
  ['ModuleEvaluationError', 'MODULE_EVALUATION_ERROR'],
];

const sha256Hex = (input) => createHash('sha256').update(input).digest('hex');

const hashDv = (value) => sha256Hex(Buffer.from(encodeDv(value)));

const hashTape = (tape) => {
  if (!Array.isArray(tape) || tape.length === 0) {
    return null;
  }
  return sha256Hex(Buffer.from(serializeHostTape(tape)));
};

const mapModulePackErrorCode = (message) => {
  for (const [needle, code] of MODULE_PACK_ERROR_CODE_MAP) {
    if (message.includes(needle)) {
      return code;
    }
  }
  return null;
};

const parseNativeOutput = (stdout) => {
  const gasMatch = stdout.match(/ GAS remaining=(\d+)(?: used=(\d+))?/);
  if (!gasMatch || gasMatch.index == null) {
    throw new Error(`missing gas suffix in native output: ${stdout}`);
  }

  const tapeMarker = ' TAPE ';
  const tapeIndex = stdout.lastIndexOf(tapeMarker);
  if (tapeIndex < 0) {
    throw new Error(`missing tape suffix in native output: ${stdout}`);
  }

  const gasStart = gasMatch.index;
  const tapeJson = stdout.slice(tapeIndex + tapeMarker.length).trim();
  const parsedTape = JSON.parse(tapeJson);
  if (!Array.isArray(parsedTape)) {
    throw new Error(`native tape must be an array: ${tapeJson}`);
  }
  const normalizedTape = parsedTape.map((record) => ({
    fnId: record.fnId,
    reqLen: record.reqLen,
    respLen: record.respLen,
    units: record.units,
    gasPre: BigInt(record.gasPre),
    gasPost: BigInt(record.gasPost),
    isError: record.isError,
    chargeFailed: record.chargeFailed,
    reqHash: record.reqHash,
    respHash: record.respHash,
  }));

  const gasRemaining = gasMatch[1];
  const gasUsed = gasMatch[2] ?? '0';

  if (stdout.startsWith('RESULT ')) {
    const valueJson = stdout.slice('RESULT '.length, gasStart);
    const value = JSON.parse(valueJson);
    return {
      ok: true,
      valueHash: hashDv(value),
      errorCode: null,
      errorTag: null,
      gasUsed,
      gasRemaining,
      tapeHash: hashTape(normalizedTape),
      tapeLength: normalizedTape.length,
    };
  }

  if (stdout.startsWith('ERROR ')) {
    const message = stdout.slice('ERROR '.length, gasStart);
    const errorCode = mapModulePackErrorCode(message);
    return {
      ok: false,
      valueHash: null,
      errorCode,
      errorTag: errorCode ? 'vm/module_pack' : null,
      gasUsed,
      gasRemaining,
      tapeHash: hashTape(normalizedTape),
      tapeLength: normalizedTape.length,
    };
  }

  throw new Error(`unexpected native output prefix: ${stdout}`);
};

const runNativeFixture = (fixture) => {
  const modulePack = fixture.program.source.modulePack;
  const args = [
    ...manifestArgs,
    '--execution-profile',
    fixture.program.executionProfile,
    '--gas-limit',
    fixture.gasLimit.toString(),
    '--report-gas',
    '--report-tape',
    '--module-entry-specifier',
    modulePack.entrySpecifier,
    '--module-entry-export',
    modulePack.entryExport ?? 'default',
    '--module-pack-json',
    JSON.stringify(modulePack.modules),
  ];

  const result = spawnSync(harnessPath, args, { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }

  const stdout = (result.stdout ?? '').trim();
  if (!stdout) {
    throw new Error(
      `native harness emitted empty output for ${fixture.name}; stderr="${result.stderr ?? ''}"`,
    );
  }

  return parseNativeOutput(stdout);
};

for (const fixture of MODULE_PACK_FIXTURES) {
  const expected = MODULE_PACK_NATIVE_BASELINES[fixture.name];
  if (!expected) {
    throw new Error(`missing native module-pack baseline for ${fixture.name}`);
  }

  const actual = runNativeFixture(fixture);
  assert.deepStrictEqual(
    actual,
    expected,
    `native module-pack baseline mismatch for fixture "${fixture.name}"`,
  );
}

console.log(
  `module-pack native fixture suite passed (${MODULE_PACK_FIXTURES.length} fixtures)`,
);
