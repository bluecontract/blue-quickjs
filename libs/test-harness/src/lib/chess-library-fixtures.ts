import { HOST_V1_HASH, HOST_V1_MANIFEST } from './abi-manifest-fixtures.js';
import { DETERMINISM_INPUT } from './determinism-fixtures.js';

export const CHESS_LIBRARY_ENTRY_PATH =
  'libs/test-harness/fixtures/library-reuse/chess-entry.ts';

export const CHESS_E2E6_EXPECTED_LEGAL = false;

export const CHESS_LIBRARY_PROGRAM_BASE = {
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
  executionProfile: 'compat-regexp-v1' as const,
};

export const CHESS_LIBRARY_INPUT = DETERMINISM_INPUT;
export const CHESS_LIBRARY_GAS_LIMIT = 5_000_000n;
export const CHESS_LIBRARY_MANIFEST = HOST_V1_MANIFEST;
