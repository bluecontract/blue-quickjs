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

if (!existsSync(harnessPath)) {
  throw new Error(
    `Native harness not found at ${harnessPath}. Build quickjs-native-harness first.`,
  );
}

const hostV2ManifestHex = readFileSync(
  path.join(
    repoRoot,
    'libs',
    'test-harness',
    'fixtures',
    'abi-manifest',
    'host-v2.bytes.hex',
  ),
  'utf8',
).replace(/[\r\n\s]+/g, '');

const hostV2ManifestHash = readFileSync(
  path.join(
    repoRoot,
    'libs',
    'test-harness',
    'fixtures',
    'abi-manifest',
    'host-v2.hash',
  ),
  'utf8',
).trim();

const require = jiti(import.meta.url);
const {
  bundleDeterministicProgram,
} = require('../../../libs/deterministic-bundler/src/index.ts');
const {
  BINARY_LIBRARY_FIXTURES,
  BINARY_LIBRARY_GAS_LIMIT,
  serializeHostTape,
} = require('../../../libs/test-harness/src/index.ts');
const { encodeDv } = require('../../../libs/dv/src/index.ts');

const BINARY_NATIVE_BASELINES = {
  'base64-js-roundtrip': {
    ok: true,
    valueHash:
      '87dbcca4f5403c38f1d4259ba4d152240ab993b6d54d2bc5be615294634398d2',
    errorCode: null,
    errorTag: null,
    gasUsed: '14208',
    gasRemaining: '4985792',
    tapeHash: null,
    tapeLength: 0,
  },
  'noble-sha256-hex': {
    ok: true,
    valueHash:
      '137c77da6a39cb7439836094805726f43751c3d4df281f9268ba4bf03b523afd',
    errorCode: null,
    errorTag: null,
    gasUsed: '43772',
    gasRemaining: '4956228',
    tapeHash: null,
    tapeLength: 0,
  },
};

const sha256Hex = (input) => createHash('sha256').update(input).digest('hex');

const hashDv = (value) => sha256Hex(Buffer.from(encodeDv(value)));

const hashTape = (tape) => {
  if (!Array.isArray(tape) || tape.length === 0) {
    return null;
  }
  return sha256Hex(Buffer.from(serializeHostTape(tape)));
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
  const gasRemaining = gasMatch[1];
  const gasUsed = gasMatch[2] ?? '0';
  const tapeJson = stdout.slice(tapeIndex + tapeMarker.length).trim();
  const tape = JSON.parse(tapeJson);

  if (!Array.isArray(tape)) {
    throw new Error(`native tape must be an array: ${tapeJson}`);
  }

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
      tapeHash: hashTape(tape),
      tapeLength: tape.length,
    };
  }

  if (stdout.startsWith('ERROR ')) {
    const message = stdout.slice('ERROR '.length, gasStart);
    return {
      ok: false,
      valueHash: null,
      errorCode: message,
      errorTag: null,
      gasUsed,
      gasRemaining,
      tapeHash: hashTape(tape),
      tapeLength: tape.length,
    };
  }

  throw new Error(`unexpected native output prefix: ${stdout}`);
};

const runNative = (code) => {
  const args = [
    '--abi-manifest-hex',
    hostV2ManifestHex,
    '--abi-manifest-hash',
    hostV2ManifestHash,
    '--execution-profile',
    'compat-binary-v1',
    '--gas-limit',
    BINARY_LIBRARY_GAS_LIMIT.toString(),
    '--report-gas',
    '--report-tape',
    '--eval',
    code,
  ];

  const result = spawnSync(harnessPath, args, { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }

  const stdout = (result.stdout ?? '').trim();
  if (!stdout) {
    throw new Error(
      `native harness emitted empty output; stderr="${result.stderr ?? ''}"`,
    );
  }
  return parseNativeOutput(stdout);
};

for (const fixture of BINARY_LIBRARY_FIXTURES) {
  const bundled = await bundleDeterministicProgram({
    absWorkingDir: repoRoot,
    entryPath: fixture.entryPath,
    profile: 'compat-binary-v1',
  });
  const nativeSnapshot = runNative(bundled.code);
  const expected = BINARY_NATIVE_BASELINES[fixture.name];
  if (!expected) {
    throw new Error(`missing binary native baseline for ${fixture.name}`);
  }

  assert.deepStrictEqual(
    nativeSnapshot,
    expected,
    `native binary baseline mismatch for fixture "${fixture.name}"`,
  );
}

console.log(
  `binary library native suite passed (${BINARY_LIBRARY_FIXTURES.length} fixtures)`,
);
