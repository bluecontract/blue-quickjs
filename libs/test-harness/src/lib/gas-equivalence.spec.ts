import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, test, beforeAll } from 'vitest';
import { decodeDv, encodeDv } from '@blue-quickjs/dv';
import { getQuickjsWasmArtifacts } from '@blue-quickjs/quickjs-wasm-build';
import type {
  QuickjsWasmBuildType,
  QuickjsWasmVariant,
} from '@blue-quickjs/quickjs-wasm-constants';
import { HOST_V1_BYTES, HOST_V1_HASH } from './abi-manifest-fixtures.js';
import { DETERMINISM_INPUT } from './determinism-fixtures.js';
import {
  hexToBytes,
  parseDeterministicOutput,
  type DeterministicOutput,
} from './deterministic-output.js';
import {
  readCString,
  writeBytes,
  writeCString,
  type WasmPtr,
} from './wasm-memory.js';

interface ExpectedResult extends DeterministicOutput {
  value?: unknown;
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

const fixturesRoot = path.join(
  repoRoot,
  'tools',
  'quickjs-native-harness',
  'fixtures',
  'gas',
);

const nativeHarnessPath = path.join(
  repoRoot,
  'tools',
  'quickjs-native-harness',
  'dist',
  'quickjs-native-harness',
);

const cases = [
  {
    name: 'zero-precharge',
    fixture: 'zero-precharge.js',
    gasLimit: 0n,
  },
  {
    name: 'gc-checkpoint-budget',
    fixture: 'zero-precharge.js',
    gasLimit: 54n,
  },
  {
    name: 'loop-oog',
    fixture: 'loop-counter.js',
    gasLimit: 146n,
  },
  {
    name: 'constant',
    fixture: 'constant.js',
    gasLimit: 37n,
  },
  {
    name: 'addition',
    fixture: 'addition.js',
    gasLimit: 39n,
  },
  {
    name: 'string-repeat',
    fixture: 'string-repeat.js',
    gasLimit: 84n,
  },
  {
    name: 'json-parse',
    fixture: 'json-parse-small.js',
    gasLimit: 77n,
  },
  {
    name: 'json-parse-oog',
    fixture: 'json-parse-oog.js',
    gasLimit: 76n,
  },
  {
    name: 'json-stringify',
    fixture: 'json-stringify-small.js',
    gasLimit: 82n,
  },
  {
    name: 'json-stringify-oog',
    fixture: 'json-stringify-oog.js',
    gasLimit: 81n,
  },
  {
    name: 'array-map-single',
    fixture: 'array-map-single.js',
    gasLimit: 143n,
  },
  {
    name: 'array-map-single-oog',
    fixture: 'array-map-single.js',
    gasLimit: 142n,
  },
  {
    name: 'array-map-multi',
    fixture: 'array-map-multi.js',
    gasLimit: 179n,
  },
  {
    name: 'array-map-multi-oog',
    fixture: 'array-map-multi.js',
    gasLimit: 178n,
  },
  {
    name: 'array-filter-multi',
    fixture: 'array-filter-multi.js',
    gasLimit: 189n,
  },
  {
    name: 'array-filter-multi-oog',
    fixture: 'array-filter-multi.js',
    gasLimit: 188n,
  },
  {
    name: 'array-reduce-multi',
    fixture: 'array-reduce-multi.js',
    gasLimit: 189n,
  },
  {
    name: 'array-reduce-multi-oog',
    fixture: 'array-reduce-multi.js',
    gasLimit: 188n,
  },
  {
    name: 'gc-pending',
    fixture: 'gc-pending.js',
    gasLimit: 89n,
  },
  {
    name: 'gc-pending-oog',
    fixture: 'gc-pending.js',
    gasLimit: 88n,
  },
];

interface BoundaryFixtureCase {
  name: string;
  fixture: string;
  expectedFirstSuccessGas: bigint;
}

const boundaryCases: BoundaryFixtureCase[] = [
  {
    name: 'opcode-addition',
    fixture: 'addition.js',
    expectedFirstSuccessGas: 39n,
  },
  {
    name: 'opcode-constant',
    fixture: 'constant.js',
    expectedFirstSuccessGas: 37n,
  },
  {
    name: 'loop-counter',
    fixture: 'loop-counter.js',
    expectedFirstSuccessGas: 146n,
  },
  {
    name: 'string-repeat',
    fixture: 'string-repeat.js',
    expectedFirstSuccessGas: 84n,
  },
  {
    name: 'json-parse-small',
    fixture: 'json-parse-small.js',
    expectedFirstSuccessGas: 77n,
  },
  {
    name: 'json-stringify-small',
    fixture: 'json-stringify-small.js',
    expectedFirstSuccessGas: 82n,
  },
  {
    name: 'array-map-single',
    fixture: 'array-map-single.js',
    expectedFirstSuccessGas: 143n,
  },
  {
    name: 'array-map-multi',
    fixture: 'array-map-multi.js',
    expectedFirstSuccessGas: 179n,
  },
  {
    name: 'array-filter-multi',
    fixture: 'array-filter-multi.js',
    expectedFirstSuccessGas: 189n,
  },
  {
    name: 'array-reduce-multi',
    fixture: 'array-reduce-multi.js',
    expectedFirstSuccessGas: 189n,
  },
  {
    name: 'gc-pending',
    fixture: 'gc-pending.js',
    expectedFirstSuccessGas: 89n,
  },
];

const wasmVariantEnv = process.env.QJS_WASM_VARIANT?.toLowerCase();
const wasmVariant: QuickjsWasmVariant =
  wasmVariantEnv === 'wasm64' ? 'wasm64' : 'wasm32';
const wasmBuildTypeEnv = process.env.QJS_WASM_BUILD_TYPE?.toLowerCase();
const wasmBuildType: QuickjsWasmBuildType =
  wasmBuildTypeEnv === 'debug' ? 'debug' : 'release';
const useNativeBaseline = wasmVariant === 'wasm64';
const HOST_TRANSPORT_SENTINEL = 0xffffffff >>> 0;
const MANIFEST_BYTES = HOST_V1_BYTES;
const MANIFEST_HASH = HOST_V1_HASH;
const CONTEXT_BLOB = encodeDv({
  event: DETERMINISM_INPUT.event,
  eventCanonical: DETERMINISM_INPUT.eventCanonical,
  steps: DETERMINISM_INPUT.steps,
  currentContract: DETERMINISM_INPUT.currentContract,
  currentContractCanonical: DETERMINISM_INPUT.currentContractCanonical,
});
const MANIFEST_HEX = bytesToHex(MANIFEST_BYTES);
const CONTEXT_HEX = bytesToHex(CONTEXT_BLOB);

const wasm32Expectations: Record<string, ExpectedResult> = {
  'zero-precharge': {
    kind: 'ERROR',
    payload: 'OutOfGas: out of gas',
    gasRemaining: 0n,
    gasUsed: 0n,
  },
  'gc-checkpoint-budget': {
    kind: 'ERROR',
    payload: 'OutOfGas: out of gas',
    gasRemaining: 0n,
    gasUsed: 54n,
  },
  'loop-oog': {
    kind: 'RESULT',
    payload: '03',
    value: 3,
    gasRemaining: 0n,
    gasUsed: 146n,
  },
  constant: {
    kind: 'RESULT',
    payload: '01',
    value: 1,
    gasRemaining: 0n,
    gasUsed: 37n,
  },
  addition: {
    kind: 'RESULT',
    payload: '03',
    value: 3,
    gasRemaining: 0n,
    gasUsed: 39n,
  },
  'string-repeat': {
    kind: 'RESULT',
    payload: '198000',
    value: 32768,
    gasRemaining: 0n,
    gasUsed: 84n,
  },
  'json-parse': {
    kind: 'RESULT',
    payload: 'a261620262616101',
    value: { b: 2, aa: 1 },
    gasRemaining: 0n,
    gasUsed: 77n,
  },
  'json-parse-oog': {
    kind: 'ERROR',
    payload: 'OutOfGas: out of gas',
    gasRemaining: 0n,
    gasUsed: 76n,
  },
  'json-stringify': {
    kind: 'RESULT',
    payload: '6e7b2262223a322c226161223a317d',
    value: '{"b":2,"aa":1}',
    gasRemaining: 0n,
    gasUsed: 82n,
  },
  'json-stringify-oog': {
    kind: 'ERROR',
    payload: 'OutOfGas: out of gas',
    gasRemaining: 0n,
    gasUsed: 81n,
  },
  'array-map-single': {
    kind: 'RESULT',
    payload: '01',
    value: 1,
    gasRemaining: 0n,
    gasUsed: 143n,
  },
  'array-map-single-oog': {
    kind: 'ERROR',
    payload: 'OutOfGas: out of gas',
    gasRemaining: 0n,
    gasUsed: 142n,
  },
  'array-map-multi': {
    kind: 'RESULT',
    payload: '05',
    value: 5,
    gasRemaining: 0n,
    gasUsed: 179n,
  },
  'array-map-multi-oog': {
    kind: 'ERROR',
    payload: 'OutOfGas: out of gas',
    gasRemaining: 0n,
    gasUsed: 178n,
  },
  'array-filter-multi': {
    kind: 'RESULT',
    payload: '05',
    value: 5,
    gasRemaining: 0n,
    gasUsed: 189n,
  },
  'array-filter-multi-oog': {
    kind: 'ERROR',
    payload: 'OutOfGas: out of gas',
    gasRemaining: 0n,
    gasUsed: 188n,
  },
  'array-reduce-multi': {
    kind: 'RESULT',
    payload: '0f',
    value: 15,
    gasRemaining: 0n,
    gasUsed: 189n,
  },
  'array-reduce-multi-oog': {
    kind: 'ERROR',
    payload: 'OutOfGas: out of gas',
    gasRemaining: 0n,
    gasUsed: 188n,
  },
  'gc-pending': {
    kind: 'RESULT',
    payload: '1a00124f80',
    value: 1200000,
    gasRemaining: 0n,
    gasUsed: 89n,
  },
  'gc-pending-oog': {
    kind: 'ERROR',
    payload: 'OutOfGas: out of gas',
    gasRemaining: 0n,
    gasUsed: 88n,
  },
};

let wasmInit:
  | ((
      manifestPtr: WasmPtr,
      manifestLength: number,
      hashPtr: WasmPtr,
      contextPtr: WasmPtr,
      contextLength: number,
      gasLimit: bigint,
      featureFlags: number,
    ) => WasmPtr)
  | null = null;
let wasmEval: ((code: string) => WasmPtr) | null = null;
let wasmFreeRuntime: (() => void) | null = null;
let wasmMalloc: ((size: number) => WasmPtr) | null = null;
let wasmFree: ((ptr: WasmPtr) => void) | null = null;
let wasmModule: any = null;

beforeAll(async () => {
  const { loaderPath } = getQuickjsWasmArtifacts(wasmVariant, wasmBuildType);
  if (!existsSync(loaderPath)) {
    throw new Error(
      `Wasm loader not found at ${loaderPath}. Build quickjs-wasm-build with WASM_VARIANTS=${wasmVariant} WASM_BUILD_TYPES=${wasmBuildType}`,
    );
  }
  const moduleFactory = (await import(pathToFileURL(loaderPath).href)).default;
  wasmModule = await moduleFactory({
    host: {
      host_call: () => HOST_TRANSPORT_SENTINEL,
    },
  });
  const ptrReturnType = wasmVariant === 'wasm64' ? 'bigint' : 'number';
  const ptrArgType = wasmVariant === 'wasm64' ? 'bigint' : 'number';
  wasmInit = wasmModule.cwrap('qjs_det_init', ptrReturnType, [
    ptrArgType,
    'number',
    ptrArgType,
    ptrArgType,
    'number',
    'bigint',
    'number',
  ]);
  wasmEval = wasmModule.cwrap('qjs_det_eval', ptrReturnType, ['string']);
  wasmFreeRuntime = wasmModule.cwrap('qjs_det_free', null, []);
  wasmMalloc = wasmModule.cwrap('malloc', ptrReturnType, ['number']);
  wasmFree = wasmModule.cwrap('free', null, [ptrArgType]);
});

function runNative(code: string, gasLimit: bigint): DeterministicOutput {
  const args = [
    '--gas-limit',
    gasLimit.toString(),
    '--report-gas',
    '--abi-manifest-hex',
    MANIFEST_HEX,
    '--abi-manifest-hash',
    MANIFEST_HASH,
    '--context-blob-hex',
    CONTEXT_HEX,
    '--eval',
    code,
  ];
  const result = spawnSync(nativeHarnessPath, args, {
    encoding: 'utf8',
  });
  if (result.error) {
    throw result.error;
  }
  return parseDeterministicOutput(result.stdout);
}

function runWasm(code: string, gasLimit: bigint): DeterministicOutput {
  if (
    !wasmEval ||
    !wasmInit ||
    !wasmFreeRuntime ||
    !wasmMalloc ||
    !wasmFree ||
    !wasmModule
  ) {
    throw new Error('Wasm harness not initialized');
  }

  const manifestPtr = writeBytes(wasmModule, wasmMalloc, MANIFEST_BYTES);
  const contextPtr =
    CONTEXT_BLOB.length > 0
      ? writeBytes(wasmModule, wasmMalloc, CONTEXT_BLOB)
      : 0;
  const hashPtr = writeCString(wasmModule, wasmMalloc, MANIFEST_HASH);

  try {
    const errorPtr = wasmInit(
      manifestPtr,
      MANIFEST_BYTES.length,
      hashPtr,
      contextPtr,
      CONTEXT_BLOB.length,
      gasLimit,
      0,
    );
    if (errorPtr !== 0) {
      const message = readCString(wasmModule, errorPtr);
      wasmFree(errorPtr);
      throw new Error(`wasm init failed: ${message}`);
    }

    const ptr = wasmEval(code);
    const raw = readCString(wasmModule, ptr);
    wasmFree(ptr);
    return parseDeterministicOutput(raw);
  } finally {
    wasmFree(manifestPtr);
    wasmFree(hashPtr);
    if (contextPtr) {
      wasmFree(contextPtr);
    }
    wasmFreeRuntime();
  }
}

describe('wasm gas outputs', () => {
  test.each(cases)('$name matches', ({ name, fixture, gasLimit }) => {
    const code = readFileSync(path.join(fixturesRoot, fixture), 'utf8');
    const wasm = runWasm(code, gasLimit);

    if (useNativeBaseline) {
      const native = runNative(code, gasLimit);
      expectHarnessResult(wasm, native);
      return;
    }

    const expected = wasm32Expectations[name];
    if (!expected) {
      throw new Error(`Missing wasm32 expectation for case ${name}`);
    }
    expectHarnessResult(wasm, expected);
  });
});

describe('exact OOG boundaries', () => {
  test.each(boundaryCases)(
    '$name has identical first-success and last-failure boundaries',
    ({ fixture, expectedFirstSuccessGas }) => {
      const code = readFileSync(path.join(fixturesRoot, fixture), 'utf8');

      const wasmBoundary = findOutOfGasBoundary(
        (gasLimit) => runWasm(code, gasLimit),
        expectedFirstSuccessGas + 64n,
      );
      expect(wasmBoundary.firstSuccessGas).toBe(expectedFirstSuccessGas);
      expect(wasmBoundary.lastFailureGas).toBe(expectedFirstSuccessGas - 1n);
      expect(wasmBoundary.firstSuccess.gasUsed).toBe(
        wasmBoundary.firstSuccessGas,
      );
      expect(wasmBoundary.firstSuccess.gasRemaining).toBe(0n);
      expect(isOutOfGasError(wasmBoundary.lastFailure)).toBe(true);

      const nativeBoundary = findOutOfGasBoundary(
        (gasLimit) => runNative(code, gasLimit),
        expectedFirstSuccessGas + 64n,
      );
      expect(nativeBoundary.firstSuccessGas).toBe(wasmBoundary.firstSuccessGas);
      expect(nativeBoundary.lastFailureGas).toBe(wasmBoundary.lastFailureGas);
      expect(nativeBoundary.firstSuccess.gasUsed).toBe(
        nativeBoundary.firstSuccessGas,
      );
      expect(nativeBoundary.firstSuccess.gasRemaining).toBe(0n);
      expect(isOutOfGasError(nativeBoundary.lastFailure)).toBe(true);
    },
  );
});

function expectHarnessResult(
  actual: DeterministicOutput,
  expected: ExpectedResult,
) {
  expect(actual.kind).toEqual(expected.kind);
  expect(actual.gasUsed).toEqual(expected.gasUsed);
  expect(actual.gasRemaining).toEqual(expected.gasRemaining);

  if (actual.kind === 'RESULT') {
    const decoded = decodeDv(hexToBytes(actual.payload));
    const expectedValue =
      expected.value ??
      tryDecodeExpectedPayload(expected.payload) ??
      expected.payload;
    expect(decoded).toEqual(expectedValue);
  } else {
    expect(actual.payload).toEqual(expected.payload);
  }
}

function isOutOfGasError(output: DeterministicOutput): boolean {
  return output.kind === 'ERROR' && output.payload.includes('OutOfGas');
}

function findOutOfGasBoundary(
  run: (gasLimit: bigint) => DeterministicOutput,
  initialUpperBound: bigint,
): {
  firstSuccessGas: bigint;
  lastFailureGas: bigint;
  firstSuccess: DeterministicOutput;
  lastFailure: DeterministicOutput;
} {
  let upperGas = initialUpperBound;
  let upperOutput = run(upperGas);
  while (upperOutput.kind !== 'RESULT') {
    upperGas *= 2n;
    if (upperGas > 100_000_000n) {
      throw new Error(`failed to find successful gas bound (last=${upperGas})`);
    }
    upperOutput = run(upperGas);
  }

  let lowerGas = 0n;
  let lowerOutput = run(lowerGas);
  while (lowerGas + 1n < upperGas) {
    const mid = (lowerGas + upperGas) >> 1n;
    const midOutput = run(mid);
    if (midOutput.kind === 'RESULT') {
      upperGas = mid;
      upperOutput = midOutput;
    } else {
      lowerGas = mid;
      lowerOutput = midOutput;
    }
  }

  return {
    firstSuccessGas: upperGas,
    lastFailureGas: lowerGas,
    firstSuccess: upperOutput,
    lastFailure: lowerOutput,
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function tryDecodeExpectedPayload(payload: string): unknown {
  const hexish = /^[0-9a-f]+$/i.test(payload) && payload.length % 2 === 0;
  if (hexish) {
    try {
      return decodeDv(hexToBytes(payload));
    } catch {
      // fall through
    }
  }
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}
