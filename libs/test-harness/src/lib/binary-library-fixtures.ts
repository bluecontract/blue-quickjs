import { HOST_V2_HASH, HOST_V2_MANIFEST } from './abi-manifest-fixtures.js';
import { DETERMINISM_INPUT } from './determinism-fixtures.js';

export interface BinaryLibraryFixture {
  name: string;
  entryPath: string;
  expectedValue: Record<string, number | string>;
}

export const BINARY_LIBRARY_PROGRAM_BASE = {
  abiId: 'Host.v2',
  abiVersion: 2,
  abiManifestHash: HOST_V2_HASH,
  executionProfile: 'compat-binary-v1' as const,
};

export const BINARY_LIBRARY_INPUT = DETERMINISM_INPUT;
export const BINARY_LIBRARY_GAS_LIMIT = 5_000_000n;
export const BINARY_LIBRARY_MANIFEST = HOST_V2_MANIFEST;

export const BINARY_LIBRARY_FIXTURES: BinaryLibraryFixture[] = [
  {
    name: 'base64-js-roundtrip',
    entryPath:
      'libs/test-harness/fixtures/library-reuse/binary-base64-entry.ts',
    expectedValue: {
      length: 8,
      sum: 36,
      first: 1,
      last: 8,
      reencoded: 'AQIDBAUGBwg=',
    },
  },
  {
    name: 'noble-sha256-hex',
    entryPath:
      'libs/test-harness/fixtures/library-reuse/binary-sha256-entry.ts',
    expectedValue: {
      hex: '641041dbb216456635a87ee5a1183e0b7462484d205c246eabecf274427efaad',
      length: 32,
      first: 100,
      last: 173,
    },
  },
];
