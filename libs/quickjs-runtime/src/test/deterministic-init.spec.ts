import { decodeDv, encodeDv } from '@blue-quickjs/dv';
import {
  HOST_V1_BYTES_HEX,
  HOST_V1_HASH,
  HOST_V1_MANIFEST,
} from '@blue-quickjs/abi-manifest';
import { initializeDeterministicVm } from '../lib/deterministic-init.js';
import type { HostDispatcherHandlers } from '../lib/host-dispatcher.js';
import { parseHexToBytes } from '../lib/hex-utils.js';
import { createRuntime } from '../lib/runtime.js';
import type { InputEnvelope, ProgramArtifact } from '../lib/quickjs-runtime.js';
import { writeBytes, writeCString } from '@blue-quickjs/test-harness';

const BASE_PROGRAM: ProgramArtifact = {
  code: 'export default 1;',
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
};
const TEST_GAS_LIMIT = 10_000n;

const BASE_INPUT: InputEnvelope = {
  event: { type: 'create', payload: { id: 1 } },
  eventCanonical: { type: 'create', payload: { id: 1 } },
  steps: [{ name: 'first' }],
  currentContract: { id: 'contract-1', kind: 'workflow' },
  currentContractCanonical: { id: { value: 'contract-1' }, kind: 'workflow' },
};

describe('initializeDeterministicVm', () => {
  it('installs ergonomic globals and freezes injected values', async () => {
    const runtime = await createRuntime({
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    const vm = initializeDeterministicVm(
      runtime,
      BASE_PROGRAM,
      BASE_INPUT,
      TEST_GAS_LIMIT,
    );
    try {
      const output = vm.eval(`
        (() => {
          const docResult = document("path/to/doc");
          return {
            docType: typeof document,
            docCanonicalType: typeof document.canonical,
            documentExtensible: Object.isExtensible(document),
            canonExtensible: Object.isExtensible(canon),
            eventFrozen: Object.isFrozen(event),
            stepsFrozen: Object.isFrozen(steps),
            currentContractFrozen: Object.isFrozen(currentContract),
            currentContractCanonicalFrozen: Object.isFrozen(currentContractCanonical),
            currentContract,
            currentContractCanonical,
            docResult
          };
        })()
      `);

      const parsed = parseEvalOutput(output);
      if (parsed.kind === 'ERROR') {
        throw new Error(`eval failed: ${parsed.message}`);
      }
      expect(parsed.kind).toBe('RESULT');
      expect(parsed.value).toMatchObject({
        docType: 'function',
        docCanonicalType: 'function',
        documentExtensible: false,
        canonExtensible: false,
        eventFrozen: true,
        stepsFrozen: true,
        currentContractFrozen: true,
        currentContractCanonicalFrozen: true,
        currentContract: { id: 'contract-1', kind: 'workflow' },
        currentContractCanonical: {
          id: { value: 'contract-1' },
          kind: 'workflow',
        },
        docResult: { path: 'path/to/doc' },
      });
    } finally {
      vm.dispose();
    }
  });

  it('fails when the provided manifest hash does not match the bytes', async () => {
    const runtime = await createRuntime({
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    const badProgram: ProgramArtifact = {
      ...BASE_PROGRAM,
      abiManifestHash: '0'.repeat(64),
    };

    expect(() =>
      initializeDeterministicVm(
        runtime,
        badProgram,
        BASE_INPUT,
        TEST_GAS_LIMIT,
      ),
    ).toThrow(/manifest hash/i);
  });

  it('resets gas trace counts when gas tracing is re-enabled on the same VM', async () => {
    const runtime = await createRuntime({
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    const vm = initializeDeterministicVm(
      runtime,
      BASE_PROGRAM,
      BASE_INPUT,
      TEST_GAS_LIMIT,
    );

    try {
      vm.enableGasTrace(true);
      vm.eval('1 + 2');
      const firstTrace = parseGasTrace(vm.readGasTrace());

      vm.eval('1 + 2');
      const accumulatedTrace = parseGasTrace(vm.readGasTrace());

      vm.enableGasTrace(true);
      vm.eval('1 + 2');
      const resetTrace = parseGasTrace(vm.readGasTrace());

      expect(firstTrace.opcodeCount > 0n).toBe(true);
      expect(accumulatedTrace.opcodeCount).toBe(firstTrace.opcodeCount * 2n);
      expect(resetTrace.opcodeCount).toBe(firstTrace.opcodeCount);
    } finally {
      vm.dispose();
    }
  });

  it('cleans up loaded modules between repeated module-pack evaluations', async () => {
    const runtime = await createRuntime({
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    const vm = initializeDeterministicVm(
      runtime,
      BASE_PROGRAM,
      BASE_INPUT,
      TEST_GAS_LIMIT,
    );

    try {
      const first = parseEvalOutput(
        vm.evalModulePack(
          JSON.stringify([
            {
              specifier: './entry.js',
              source: 'export default 1;\n',
            },
          ]),
          './entry.js',
          'default',
        ),
      );
      const second = parseEvalOutput(
        vm.evalModulePack(
          JSON.stringify([
            {
              specifier: './entry.js',
              source: 'export default 2;\n',
            },
          ]),
          './entry.js',
          'default',
        ),
      );

      expect(first.kind).toBe('RESULT');
      expect(second.kind).toBe('RESULT');
      expect(first.value).toBe(1);
      expect(second.value).toBe(2);
    } finally {
      vm.dispose();
    }
  });

  it('defaults missing context blob keys to null', async () => {
    const runtime = await createRuntime({
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    runDeterministicInit(runtime, {
      manifestBytes: parseHexToBytes(HOST_V1_BYTES_HEX),
      manifestHash: HOST_V1_HASH,
      contextBlob: { event: { only: 'event' } },
      gasLimit: TEST_GAS_LIMIT,
    });

    try {
      const ptr = callEval(runtime, '(() => ({ event, eventCanonical, steps, currentContract, currentContractCanonical }))()');
      const parsed = parseEvalOutput(readAndFreeCString(runtime.module, ptr));
      expect(parsed.kind).toBe('RESULT');
      expect(parsed.value).toEqual({
        event: { only: 'event' },
        eventCanonical: null,
        steps: null,
        currentContract: null,
        currentContractCanonical: null,
      });
    } finally {
      runtime.module.cwrap('qjs_det_free', null, [])();
    }
  });

  it('rejects manifest bytes larger than 1 MiB', async () => {
    const runtime = await createRuntime({
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(() =>
      runDeterministicInit(runtime, {
        manifestBytes: new Uint8Array(1024 * 1024 + 1),
        manifestHash: '0'.repeat(64),
        contextBlob: null,
        gasLimit: TEST_GAS_LIMIT,
      }),
    ).toThrow(/manifest/i);
  });

  it('rejects context blobs larger than 5 MiB', async () => {
    const runtime = await createRuntime({
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    oversized.fill(0x61);

    expect(() =>
      runDeterministicInit(runtime, {
        manifestBytes: parseHexToBytes(HOST_V1_BYTES_HEX),
        manifestHash: HOST_V1_HASH,
        contextBlob: null,
        contextBlobBytes: oversized,
        gasLimit: TEST_GAS_LIMIT,
      }),
    ).toThrow(/context blob|blob/i);
  });
});

function createHandlers(
  overrides?: Partial<HostDispatcherHandlers>,
): HostDispatcherHandlers {
  return {
    document: {
      get:
        overrides?.document?.get ??
        ((path: string) => ({ ok: { path }, units: 5 })),
      getCanonical:
        overrides?.document?.getCanonical ??
        ((path: string) => ({ ok: { canonical: path }, units: 3 })),
    },
    emit:
      overrides?.emit ??
      (() => ({
        ok: null,
        units: 1,
      })),
  };
}

function parseEvalOutput(raw: string): {
  kind: 'RESULT' | 'ERROR';
  message: string;
  value: unknown;
  gasRemaining: number;
  gasUsed: number;
} {
  const match =
    /^(RESULT|ERROR)\s+(.+?)\s+GAS\s+remaining=(\d+)\s+used=(\d+)/.exec(
      raw.trim(),
    );
  if (!match) {
    throw new Error(`Unable to parse eval output: ${raw}`);
  }

  const [, kind, payload, remaining, used] = match;
  const value =
    kind === 'RESULT' ? decodeDv(parseHexToBytes(payload)) : payload.trim();

  return {
    kind: kind as 'RESULT' | 'ERROR',
    message: payload,
    value,
    gasRemaining: Number(remaining),
    gasUsed: Number(used),
  };
}

function runDeterministicInit(
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  options: {
    manifestBytes: Uint8Array;
    manifestHash: string;
    contextBlob: unknown | null;
    contextBlobBytes?: Uint8Array;
    gasLimit: bigint;
  },
): string {
  const init = runtime.module.cwrap('qjs_det_init', 'number', [
    'number',
    'number',
    'number',
    'number',
    'number',
    'bigint',
    'number',
  ]) as (
    manifestPtr: number,
    manifestLength: number,
    hashPtr: number,
    contextPtr: number,
    contextLength: number,
    gasLimit: bigint,
    featureFlags: number,
  ) => number;

  const manifestPtr = Number(
    writeBytes(runtime.module, runtime.module._malloc.bind(runtime.module), options.manifestBytes),
  );
  const hashPtr = Number(
    writeCString(runtime.module, runtime.module._malloc.bind(runtime.module), options.manifestHash),
  );
  const contextBytes =
    options.contextBlobBytes ??
    (options.contextBlob === null ? new Uint8Array() : encodeDv(options.contextBlob));
  const contextPtr =
    contextBytes.length > 0
      ? Number(
          writeBytes(
            runtime.module,
            runtime.module._malloc.bind(runtime.module),
            contextBytes,
          ),
        )
      : 0;

  try {
    const errorPtr = init(
      manifestPtr,
      options.manifestBytes.length,
      hashPtr,
      contextPtr,
      contextBytes.length,
      options.gasLimit,
      0,
    );
    if (errorPtr !== 0) {
      throw new Error(readAndFreeCString(runtime.module, errorPtr));
    }
    return 'ok';
  } finally {
    runtime.module._free(manifestPtr);
    runtime.module._free(hashPtr);
    if (contextPtr !== 0) {
      runtime.module._free(contextPtr);
    }
  }
}

function callEval(
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  code: string,
): number {
  const evalFn = runtime.module.cwrap('qjs_det_eval', 'number', [
    'string',
  ]) as (source: string) => number;
  return evalFn(code);
}

function readAndFreeCString(
  module: Awaited<ReturnType<typeof createRuntime>>['module'],
  ptr: number,
): string {
  const value = module.UTF8ToString(ptr);
  module._free(ptr);
  return value;
}

function parseGasTrace(raw: string): {
  opcodeCount: bigint;
  allocationCount: bigint;
} {
  const trace = JSON.parse(raw) as {
    opcodeCount?: string;
    allocationCount?: string;
  };
  if (
    typeof trace.opcodeCount !== 'string' ||
    typeof trace.allocationCount !== 'string'
  ) {
    throw new Error(`Unable to parse gas trace: ${raw}`);
  }
  return {
    opcodeCount: BigInt(trace.opcodeCount),
    allocationCount: BigInt(trace.allocationCount),
  };
}
