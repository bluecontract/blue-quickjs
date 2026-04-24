import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect } from 'vitest';

export const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const fixturesRoot = path.join(
  repoRoot,
  'tools',
  'quickjs-native-harness',
  'fixtures',
);
const harnessBin = path.join(
  repoRoot,
  'tools',
  'quickjs-native-harness',
  'dist',
  'quickjs-native-harness',
);

const hostManifestHex = readFixture('libs/test-harness/fixtures/abi-manifest/host-v1.bytes.hex');
const hostManifestHash = readFixture('libs/test-harness/fixtures/abi-manifest/host-v1.hash');
const commonArgs = [
  '--abi-manifest-hex',
  hostManifestHex,
  '--abi-manifest-hash',
  hostManifestHash,
];

function readFixture(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8').replace(/\s+/g, '');
}

export function runHarness(args) {
  const result = spawnSync(harnessBin, [...commonArgs, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    error: result.error,
  };
}

export function expectHarnessOutput(name, code, expected, extraArgs = []) {
  const result = runHarness([...extraArgs, '--eval', code]);

  expect(result.error, `${name}: spawn error`).toBeUndefined();
  expect(result.stderr, `${name}: stderr`).toBe('');
  expect(result.stdout, `${name}: stdout`).toBe(expected);
}

export function expectHarnessFixture(name, fixture, expected, extraArgs = []) {
  const code = readFileSync(path.join(fixturesRoot, fixture), 'utf8');
  expectHarnessOutput(name, code, expected, extraArgs);
}
