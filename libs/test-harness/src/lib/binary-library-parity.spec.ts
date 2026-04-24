import { encodeDv } from '@blue-quickjs/dv';
import {
  BINARY_LIBRARY_FIXTURES,
  BINARY_LIBRARY_GAS_LIMIT,
} from './binary-library-fixtures.js';
import {
  hasBuiltNativeHarness,
  hostV2ManifestArgs,
  parseNativeParityOutput,
  repoRoot,
  runNativeHarness,
  sha256Hex,
  type NativeParitySnapshot,
} from './native-harness-test-utils.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import jiti from 'jiti';

const require = jiti(import.meta.url, { interopDefault: true });
const { bundleDeterministicProgram } = require(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../deterministic-bundler/src/index.ts',
  ),
);

const BINARY_NATIVE_BASELINES: Record<string, NativeParitySnapshot> = {
  'base64-js-roundtrip': {
    ok: true,
    valueHash:
      '87dbcca4f5403c38f1d4259ba4d152240ab993b6d54d2bc5be615294634398d2',
    errorCode: null,
    errorTag: null,
    gasUsed: '3542',
    gasRemaining: '4996458',
    tapeHash: null,
    tapeLength: 0,
  },
  'noble-sha256-hex': {
    ok: true,
    valueHash:
      '137c77da6a39cb7439836094805726f43751c3d4df281f9268ba4bf03b523afd',
    errorCode: null,
    errorTag: null,
    gasUsed: '25970',
    gasRemaining: '4974030',
    tapeHash: null,
    tapeLength: 0,
  },
};

describe('binary library parity', () => {
  it('has a built native harness available', () => {
    expect(hasBuiltNativeHarness()).toBe(true);
  });

  test.each(BINARY_LIBRARY_FIXTURES)(
    '$name matches the native baseline snapshot',
    async (fixture) => {
      const bundled = await bundleDeterministicProgram({
        absWorkingDir: repoRoot,
        entryPath: fixture.entryPath,
        profile: 'compat-binary-v1',
      });

      const result = runNativeHarness([
        ...hostV2ManifestArgs,
        '--execution-profile',
        'compat-binary-v1',
        '--gas-limit',
        BINARY_LIBRARY_GAS_LIMIT.toString(),
        '--report-gas',
        '--report-tape',
        '--eval',
        bundled.code,
      ], {
        includeManifest: false,
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');

      const actual = parseNativeParityOutput(result.stdout, {
        valueToHash: (value: unknown) =>
          sha256Hex(Buffer.from(encodeDv(value))),
      });

      expect(actual).toEqual(BINARY_NATIVE_BASELINES[fixture.name]);
    },
    15_000,
  );
});
