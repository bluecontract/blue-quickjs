import {
  HOST_V1_HASH,
  HOST_V1_MANIFEST,
  HOST_V2_HASH,
  HOST_V2_MANIFEST,
  type AbiManifest,
} from '@blue-quickjs/abi-manifest';
import { type DV2, encodeDv2 } from '@blue-quickjs/dv';
import type {
  HostCallResult,
  HostDispatcherHandlers,
  ProgramArtifactV2,
} from '@blue-quickjs/quickjs-runtime';
import {
  evaluate,
  validateProgramArtifactV2,
} from '@blue-quickjs/quickjs-runtime';
import {
  loadQuickjsWasmBinary,
  loadQuickjsWasmMetadata,
} from '@blue-quickjs/quickjs-wasm';
import {
  DETERMINISM_INPUT,
  createDeterminismHost,
  serializeHostTape,
} from '@blue-quickjs/test-harness';
import type {
  EvidencePayload,
  HostEvent,
  HostPresetId,
  LoadedPlaygroundData,
  OogPayload,
  PlaygroundRunResult,
  RunSnapshot,
} from './types.js';

const CERTIFICATION_INPUT = {
  event: { type: 'ecosystem-certifier' },
  eventCanonical: { type: 'ecosystem-certifier' },
  steps: [],
  currentContract: { id: 'ecosystem-certifier' },
  currentContractCanonical: { id: { value: 'ecosystem-certifier' } },
};

const CERT_TEXT_DOCUMENTS = new Map<string, string>([
  [
    'pack/metadata.json',
    JSON.stringify(
      {
        packId: 'kp-2026-rc',
        release: '1.2.3',
        requires: ['>=1.2.0 <2.0.0', '^1.2.0'],
        links: ['docs/a.md', 'docs/b.md', 'docs/c.md', 'docs/d.md'],
      },
      null,
      2,
    ),
  ],
  [
    'pack/metadata.yaml',
    [
      'packId: kp-2026-rc',
      'release: 1.2.3',
      'requires:',
      '  - ">=1.2.0 <2.0.0"',
      '  - "^1.2.0"',
      'links:',
      '  - docs/a.md',
      '  - docs/b.md',
      '',
    ].join('\n'),
  ],
  ['docs/a.md', '# Alpha\n\nSee [Beta](docs/b.md).\n'],
  ['docs/b.md', '# Beta\n\nBacklink to [Alpha](docs/a.md).\n'],
  ['docs/c.md', '# Gamma\n\nCross-link to [Delta](docs/d.md).\n'],
  ['docs/d.md', '# Delta\n\nBack to [Alpha](docs/a.md).\n'],
  ['text/semver-case', '1.2.3'],
]);

const CERT_BINARY_DOCUMENTS = new Map<string, Uint8Array>([
  [
    'bytes/payload',
    Uint8Array.from(
      Array.from({ length: 64 }, (_, index) => (index * 17) % 251),
    ),
  ],
  [
    'bytes/flagship-extra',
    Uint8Array.from(
      Array.from({ length: 192 }, (_, index) => (index * 29 + 11) % 251),
    ),
  ],
]);

let runtimeAssetsPromise:
  | Promise<{
      metadata: Awaited<ReturnType<typeof loadQuickjsWasmMetadata>>;
      wasmBinary: Uint8Array;
    }>
  | undefined;

export async function loadPlaygroundData(): Promise<LoadedPlaygroundData> {
  const [examples, evidence, oog, red] = await Promise.all([
    loadJson('/generated/playground-examples.json'),
    loadJson('/generated/playground-evidence.json'),
    loadJson('/generated/playground-oog-boundaries.json'),
    loadJson('/generated/playground-red-fixtures.json'),
  ]);

  return {
    examples,
    evidence,
    oog,
    red,
  } as LoadedPlaygroundData;
}

export async function getRuntimeAssets() {
  if (!runtimeAssetsPromise) {
    runtimeAssetsPromise = (async () => {
      const metadata = await loadQuickjsWasmMetadata();
      const wasmBinary = await loadQuickjsWasmBinary(
        'wasm32',
        'release',
        metadata,
      );
      return { metadata, wasmBinary };
    })();
  }
  return runtimeAssetsPromise;
}

export async function runArtifact(options: {
  artifact: ProgramArtifactV2;
  manifest: AbiManifest;
  gasLimit: bigint;
  hostPreset: HostPresetId;
}): Promise<PlaygroundRunResult> {
  const { metadata, wasmBinary } = await getRuntimeAssets();
  const host = createWrappedHost(options.hostPreset);
  const result = await evaluate({
    program: options.artifact,
    input:
      options.hostPreset === 'certification'
        ? CERTIFICATION_INPUT
        : DETERMINISM_INPUT,
    gasLimit: options.gasLimit,
    manifest: options.manifest,
    handlers: host.handlers,
    tape: { capacity: 128 },
    metadata,
    wasmBinary,
    releaseMode: true,
    expectedExecutionProfile: options.artifact.executionProfile,
  });

  return {
    ok: result.ok,
    snapshot: await toSnapshot(result),
    value: result.ok ? result.value : null,
    errorMessage: result.ok ? null : result.message,
    hostEvents: host.events,
    tape: result.tape ?? [],
    runtimeMetadata: {
      engineBuildHash:
        metadata.variants?.wasm32?.release?.engineBuildHash ??
        metadata.engineBuildHash ??
        null,
      gasVersion: metadata.gasVersion ?? null,
      executionProfile: options.artifact.executionProfile,
      sourceKind: options.artifact.sourceKind,
      abiId: options.artifact.abiId,
      moduleGraphHash: getModuleGraphHash(options.artifact),
    },
  };
}

export async function findOogBoundary(options: {
  artifact: ProgramArtifactV2;
  manifest: AbiManifest;
  hostPreset: HostPresetId;
  initialGasLimit: bigint;
}): Promise<OogPayload['boundaries'][string]> {
  let upperGas = options.initialGasLimit;
  let upper = await runArtifact({
    artifact: options.artifact,
    manifest: options.manifest,
    gasLimit: upperGas,
    hostPreset: options.hostPreset,
  });

  while (!upper.ok) {
    upperGas *= 2n;
    upper = await runArtifact({
      artifact: options.artifact,
      manifest: options.manifest,
      gasLimit: upperGas,
      hostPreset: options.hostPreset,
    });
  }

  let lowerGas = 0n;
  let lower = await runArtifact({
    artifact: options.artifact,
    manifest: options.manifest,
    gasLimit: lowerGas,
    hostPreset: options.hostPreset,
  });

  while (lowerGas + 1n < upperGas) {
    const mid = (lowerGas + upperGas) >> 1n;
    const current = await runArtifact({
      artifact: options.artifact,
      manifest: options.manifest,
      gasLimit: mid,
      hostPreset: options.hostPreset,
    });
    if (current.ok) {
      upperGas = mid;
      upper = current;
    } else {
      lowerGas = mid;
      lower = current;
    }
  }

  return {
    firstSuccessGas: upperGas.toString(),
    lastFailureGas: lowerGas.toString(),
    successGasUsed: upper.snapshot.gasUsed,
    successGasRemaining: upper.snapshot.gasRemaining,
    failureGasUsed: lower.snapshot.gasUsed,
    failureGasRemaining: lower.snapshot.gasRemaining,
    failureCode: lower.snapshot.errorCode,
    failureTag: lower.snapshot.errorTag,
  };
}

export function createScriptArtifact(
  code: string,
  profile: ProgramArtifactV2['executionProfile'],
  metadata: LoadedPlaygroundData['examples']['metadata'],
): ProgramArtifactV2 {
  const binary = profile === 'compat-binary-v1';
  return {
    version: 2,
    abiId: binary ? 'Host.v2' : 'Host.v1',
    abiVersion: binary ? 2 : 1,
    abiManifestHash: binary ? HOST_V2_HASH : HOST_V1_HASH,
    ...(metadata.engineBuildHash
      ? { engineBuildHash: metadata.engineBuildHash }
      : {}),
    ...(metadata.gasVersion !== null
      ? { gasVersion: metadata.gasVersion }
      : {}),
    executionProfile: profile,
    sourceKind: 'script',
    source: { code },
  };
}

export function defaultManifestForArtifact(
  artifact: ProgramArtifactV2,
): AbiManifest {
  return artifact.abiId === 'Host.v2' ? HOST_V2_MANIFEST : HOST_V1_MANIFEST;
}

export function parseArtifactJson(text: string): ProgramArtifactV2 {
  return validateProgramArtifactV2(JSON.parse(text));
}

export function compareAgainstEvidence(
  run: PlaygroundRunResult,
  evidence: EvidencePayload['evidence'][string] | undefined,
) {
  if (!evidence) {
    return {
      available: false,
      matches: false,
      differences: [],
    };
  }

  const differences = [
    ['stage', run.snapshot.stage, evidence.stage],
    ['resultHash', run.snapshot.resultHash, evidence.resultHash],
    ['errorCode', run.snapshot.errorCode, evidence.errorCode],
    ['errorTag', run.snapshot.errorTag, evidence.errorTag],
    ['gasUsed', run.snapshot.gasUsed, evidence.gasUsed],
    ['gasRemaining', run.snapshot.gasRemaining, evidence.gasRemaining],
    ['tapeHash', run.snapshot.tapeHash, evidence.tapeHash],
    ['tapeLength', run.snapshot.tapeLength, evidence.tapeLength],
  ].filter(([, actual, expected]) => actual !== expected);

  return {
    available: true,
    matches: differences.length === 0,
    differences,
  };
}

function createWrappedHost(hostPreset: HostPresetId): {
  handlers: HostDispatcherHandlers;
  events: HostEvent[];
} {
  const base =
    hostPreset === 'certification'
      ? createInlineCertificationHost()
      : createDeterminismHost();
  const events: HostEvent[] = [];

  const handlers: HostDispatcherHandlers = {
    document: {
      get: (docPath: string): HostCallResult => {
        const result = base.handlers.document.get(docPath);
        events.push({
          fn: 'document.get',
          request: docPath,
          response: previewHostResult(result),
          units: result.units,
        });
        return result;
      },
      getCanonical: (docPath: string): HostCallResult => {
        const result = base.handlers.document.getCanonical(docPath);
        events.push({
          fn: 'document.getCanonical',
          request: docPath,
          response: previewHostResult(result),
          units: result.units,
        });
        return result;
      },
    },
  };

  const emitHandler = base.handlers.emit;
  if (emitHandler) {
    handlers.emit = (value: DV2): HostCallResult<null> => {
      const result = emitHandler(value);
      events.push({
        fn: 'emit',
        request: previewValue(value),
        response: previewHostResult(result),
        units: result.units,
      });
      return result;
    };
  }

  return { handlers, events };
}

function createInlineCertificationHost(): {
  handlers: HostDispatcherHandlers;
  emitted: DV2[];
} {
  const emitted: DV2[] = [];
  return {
    emitted,
    handlers: {
      document: {
        get: (docPath: string): HostCallResult => {
          const binaryDoc = CERT_BINARY_DOCUMENTS.get(docPath);
          if (binaryDoc) {
            return { ok: binaryDoc, units: 6 };
          }
          const textDoc = CERT_TEXT_DOCUMENTS.get(docPath);
          if (textDoc) {
            return { ok: textDoc, units: 2 };
          }
          return {
            err: { code: 'NOT_FOUND', tag: 'host/not_found' },
            units: 1,
          };
        },
        getCanonical: (docPath: string): HostCallResult => {
          const textDoc = CERT_TEXT_DOCUMENTS.get(docPath);
          if (textDoc) {
            return { ok: textDoc, units: 2 };
          }
          const binaryDoc = CERT_BINARY_DOCUMENTS.get(docPath);
          if (binaryDoc) {
            return { ok: binaryDoc, units: 6 };
          }
          return {
            err: { code: 'NOT_FOUND', tag: 'host/not_found' },
            units: 1,
          };
        },
      },
      emit: (value: DV2): HostCallResult<null> => {
        emitted.push(value);
        return { ok: null, units: 1 };
      },
    },
  };
}

function previewHostResult(result: HostCallResult): unknown {
  if ('ok' in result) {
    return { ok: previewValue(result.ok), units: result.units };
  }
  return { err: result.err, units: result.units };
}

function previewValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return {
      type: 'Uint8Array',
      length: value.byteLength,
      hexPreview: Array.from(value.slice(0, 16))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    };
  }
  return value;
}

async function toSnapshot(
  result: Awaited<ReturnType<typeof evaluate>>,
): Promise<RunSnapshot> {
  const tape = result.tape ?? [];
  const tapeHash =
    tape.length > 0 ? await sha256Hex(serializeHostTape(tape)) : null;
  if (result.ok) {
    return {
      stage: 'success',
      resultHash: await sha256Hex(encodeDv2(result.value)),
      errorCode: null,
      errorTag: null,
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
      tapeHash,
      tapeLength: tape.length,
    };
  }
  return {
    stage: normalizeFailureStage(result.error.kind),
    resultHash: null,
    errorCode: result.error.code,
    errorTag: 'tag' in result.error ? result.error.tag : null,
    gasUsed: result.gasUsed.toString(),
    gasRemaining: result.gasRemaining.toString(),
    tapeHash,
    tapeLength: tape.length,
  };
}

function normalizeFailureStage(kind: string): RunSnapshot['stage'] {
  if (kind === 'module-pack') {
    return 'artifact_validation';
  }
  if (kind === 'execution-surface-mismatch') {
    return 'pin_enforcement';
  }
  return 'runtime_error';
}

function getModuleGraphHash(artifact: ProgramArtifactV2): string | null {
  if (artifact.sourceKind !== 'module-pack') {
    return null;
  }
  return 'modulePack' in artifact.source
    ? artifact.source.modulePack.graphHash
    : null;
}

async function sha256Hex(input: Uint8Array | string): Promise<string> {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength &&
    bytes.buffer instanceof ArrayBuffer
  ) {
    return bytes.buffer;
  }
  return bytes.slice().buffer;
}

async function loadJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to load ${url}: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}
