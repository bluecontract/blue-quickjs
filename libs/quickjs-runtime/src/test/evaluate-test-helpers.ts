import {
  HOST_V1_HASH,
  HOST_V1_MANIFEST,
  HOST_V2_HASH,
  HOST_V2_MANIFEST,
} from '@blue-quickjs/abi-manifest';
import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import { evaluate } from '../lib/evaluate.js';
import type { HostDispatcherHandlers } from '../lib/host-dispatcher.js';
import type {
  InputEnvelope,
  ProgramArtifact,
  ProgramArtifactV2,
} from '../lib/quickjs-runtime.js';

export { evaluate, vi, HOST_V1_MANIFEST, HOST_V2_MANIFEST };

export const TEST_GAS_LIMIT = 50_000n;

export const BASE_PROGRAM: ProgramArtifact = {
  code: 'document("path/to/doc")',
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
};

export const BASE_PROGRAM_V2_SCRIPT: ProgramArtifactV2 = {
  version: 2,
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
  executionProfile: 'baseline-v1',
  sourceKind: 'script',
  source: {
    code: 'document("path/to/doc")',
  },
};

export const BASE_PROGRAM_V2_BINARY: ProgramArtifact = {
  code: 'Host.v2.document.get("bytes/payload").byteLength',
  abiId: 'Host.v2',
  abiVersion: 2,
  abiManifestHash: HOST_V2_HASH,
  executionProfile: 'compat-binary-v1',
};

export const BASE_INPUT: InputEnvelope = {
  event: { type: 'create', payload: { id: 1 } },
  eventCanonical: { type: 'create', payload: { id: 1 } },
  steps: [{ name: 'first' }],
  currentContract: { id: 'contract-1' },
  currentContractCanonical: { id: { value: 'contract-1' } },
};

export function createModulePackProgram(
  modulePack: ReturnType<typeof createModulePack>,
): ProgramArtifactV2 {
  return {
    ...BASE_PROGRAM_V2_SCRIPT,
    sourceKind: 'module-pack',
    source: {
      modulePack,
    },
  };
}

export function createHandlers(
  overrides?: Partial<{
    document: Partial<HostDispatcherHandlers['document']>;
    emit: HostDispatcherHandlers['emit'];
  }>,
): HostDispatcherHandlers {
  return {
    document: {
      get:
        overrides?.document?.get ??
        vi.fn((path: string) => ({ ok: { path }, units: 5 })),
      getCanonical:
        overrides?.document?.getCanonical ??
        vi.fn((path: string) => ({ ok: { canonical: path }, units: 3 })),
    },
    emit:
      overrides?.emit ??
      vi.fn(() => ({
        ok: null,
        units: 1,
      })),
  };
}

export function getFnId(path: string): number {
  const fn = HOST_V1_MANIFEST.functions.find(
    (entry) => entry.js_path.join('.') === path,
  );
  if (!fn) {
    throw new Error(`missing fn_id for ${path}`);
  }
  return fn.fn_id;
}

export function createModulePack(options: {
  entrySpecifier: string;
  modules: Array<{ specifier: string; source: string; sourceMap?: string }>;
  entryExport?: string;
}) {
  const base = {
    version: 1 as const,
    entrySpecifier: options.entrySpecifier,
    ...(options.entryExport ? { entryExport: options.entryExport } : {}),
    modules: options.modules,
    builderVersion: 'deterministic-builder-v1',
    dependencyIntegrity:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
  const canonical = {
    version: base.version,
    entrySpecifier: base.entrySpecifier,
    entryExport: base.entryExport ?? 'default',
    modules: [...base.modules]
      .sort((left, right) =>
        compareUtf8ByteOrder(left.specifier, right.specifier),
      )
      .map((module) => ({
        specifier: module.specifier,
        source: module.source,
        ...(module.sourceMap ? { sourceMap: module.sourceMap } : {}),
      })),
    builderVersion: base.builderVersion,
    dependencyIntegrity: base.dependencyIntegrity,
  };
  const graphHash = createHash('sha256')
    .update(stableStringify(canonical), 'utf8')
    .digest('hex');
  return {
    ...base,
    graphHash,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => compareUtf8ByteOrder(left, right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

const UTF8_ENCODER = new TextEncoder();

function compareUtf8ByteOrder(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const leftBytes = UTF8_ENCODER.encode(left);
  const rightBytes = UTF8_ENCODER.encode(right);
  const limit = Math.min(leftBytes.length, rightBytes.length);

  for (let index = 0; index < limit; index += 1) {
    const delta = leftBytes[index] - rightBytes[index];
    if (delta !== 0) {
      return delta;
    }
  }

  return leftBytes.length - rightBytes.length;
}
