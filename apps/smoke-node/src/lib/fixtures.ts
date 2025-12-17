import type { DV } from '@blue-quickjs/dv';
import { HOST_V1_HASH, HOST_V1_MANIFEST } from '@blue-quickjs/test-harness';
import type {
  HostDispatcherHandlers,
  InputEnvelope,
  ProgramArtifact,
} from '@blue-quickjs/quickjs-runtime';

export const SMOKE_PROGRAM: ProgramArtifact = {
  code: `
    (() => {
      const doc = document("path/to/doc");
      const canonicalDoc = document.canonical("path/to/doc");
      Host.v1.emit({ path: doc.path, canonical: canonicalDoc.canonical });
      return {
        marker: "smoke-node",
        doc,
        canonicalDoc,
        event,
        steps
      };
    })()
  `.trim(),
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
};

export const SMOKE_INPUT: InputEnvelope = {
  event: { type: 'demo', payload: { id: 1, state: 'ready' } },
  eventCanonical: { type: 'demo', payload: { id: 1, state: 'ready' } },
  steps: [
    { name: 'ingest', status: 'done' },
    { name: 'analyze', status: 'pending' },
  ],
  document: {
    id: 'doc-demo',
    hash: HOST_V1_HASH,
    epoch: 7,
  },
  hostContext: { requestId: 'smoke-node', locale: 'en-US' },
};

export const SMOKE_GAS_LIMIT = 50_000n;

export const SMOKE_MANIFEST = HOST_V1_MANIFEST;

export interface SmokeHostEnvironment {
  handlers: HostDispatcherHandlers;
  emitted: DV[];
}

export function createSmokeHost(input: InputEnvelope): SmokeHostEnvironment {
  const emitted: DV[] = [];
  const context = input.hostContext ?? {};
  const requestId =
    typeof context === 'object' &&
    context &&
    'requestId' in context &&
    typeof (context as Record<string, unknown>).requestId === 'string'
      ? String((context as Record<string, unknown>).requestId)
      : null;
  const snapshot: DV = {
    requestId,
    epoch: input.document.epoch ?? null,
  };
  const documentHash = input.document.hash ?? HOST_V1_HASH;

  const handlers: HostDispatcherHandlers = {
    document: {
      get: (path: string) => ({
        ok: {
          path,
          snapshot,
        },
        units: 9,
      }),
      getCanonical: (path: string) => ({
        ok: {
          canonical: path,
          hash: documentHash,
          snapshot,
        },
        units: 7,
      }),
    },
    emit: (value: DV) => {
      emitted.push(value);
      return { ok: null, units: 1 };
    },
  };

  return { handlers, emitted };
}
