import type { AbiManifest } from '@blue-quickjs/abi-manifest';
import type { DV, DV2 } from '@blue-quickjs/dv';
import {
  HOST_V1_HASH,
  HOST_V1_MANIFEST,
  HOST_V2_HASH,
  HOST_V2_MANIFEST,
} from './abi-manifest-fixtures.js';

export interface DeterminismProgramArtifact {
  code: string;
  abiId: string;
  abiVersion: number;
  abiManifestHash: string;
  executionProfile?:
    | 'baseline-v1'
    | 'compat-regexp-v1'
    | 'compat-general-v1'
    | 'compat-binary-v1';
  engineBuildHash?: string;
}

export interface DeterminismInputEnvelope {
  event: DV;
  eventCanonical: DV;
  steps: DV;
  currentContract: DV;
  currentContractCanonical: DV;
}

export const DETERMINISM_INPUT: DeterminismInputEnvelope = {
  event: { type: 'analysis', payload: { id: 42, mode: 'full' } },
  eventCanonical: { type: 'analysis', payload: { id: 42, mode: 'full' } },
  steps: [
    { name: 'ingest', status: 'done' },
    { name: 'review', status: 'queued' },
    { name: 'publish', status: 'pending' },
  ],
  currentContract: { id: 'contract-42', kind: 'determinism-fixture' },
  currentContractCanonical: {
    id: { value: 'contract-42' },
    kind: 'determinism-fixture',
  },
};

export const DETERMINISM_GAS_LIMIT = 50_000n;

export interface DeterminismHostHandlers {
  document: {
    get: (
      path: string,
    ) => { ok: DV2; units: number } | { err: HostError; units: number };
    getCanonical: (
      path: string,
    ) => { ok: DV2; units: number } | { err: HostError; units: number };
  };
  emit: (
    value: DV2,
  ) => { ok: null; units: number } | { err: HostError; units: number };
}

export interface DeterminismHostEnvironment {
  handlers: DeterminismHostHandlers;
  emitted: DV2[];
}

export interface DeterminismFixtureBaseline {
  resultHash: string | null;
  errorCode: string | null;
  errorTag: string | null;
  gasUsed: bigint;
  gasRemaining: bigint;
  tapeHash: string | null;
  tapeLength: number;
}

export interface DeterminismFixture {
  name: string;
  program: DeterminismProgramArtifact;
  input: DeterminismInputEnvelope;
  gasLimit: bigint;
  manifest: AbiManifest;
  createHost: () => DeterminismHostEnvironment;
  expected: DeterminismFixtureBaseline;
}

type HostError = {
  code: 'INVALID_PATH' | 'LIMIT_EXCEEDED' | 'NOT_FOUND';
  tag: 'host/invalid_path' | 'host/limit' | 'host/not_found';
};

const HOST_ERRORS: Record<string, HostError> = {
  invalid: { code: 'INVALID_PATH', tag: 'host/invalid_path' },
  limit: { code: 'LIMIT_EXCEEDED', tag: 'host/limit' },
  missing: { code: 'NOT_FOUND', tag: 'host/not_found' },
};

const ERROR_PATHS = new Map<string, HostError>([
  ['missing/doc', HOST_ERRORS.missing],
  ['invalid/path', HOST_ERRORS.invalid],
  ['limit/doc', HOST_ERRORS.limit],
]);

export function createDeterminismHost(): DeterminismHostEnvironment {
  const emitted: DV2[] = [];
  const documentHash = HOST_V1_HASH;

  const resolveError = (path: string): HostError | null =>
    ERROR_PATHS.get(path) ?? null;

  const handlers: DeterminismHostHandlers = {
    document: {
      get: (path: string) => {
        const error = resolveError(path);
        if (error) {
          return { err: error, units: 2 };
        }
        if (path === 'bytes/payload') {
          return { ok: Uint8Array.from([222, 173, 190, 239]), units: 11 };
        }
        return {
          ok: {
            path,
          },
          units: 9,
        };
      },
      getCanonical: (path: string) => {
        const error = resolveError(path);
        if (error) {
          return { err: error, units: 2 };
        }
        return {
          ok: {
            canonical: path,
            hash: documentHash,
          },
          units: 7,
        };
      },
    },
    emit: (value: DV2) => {
      emitted.push(value);
      return { ok: null, units: 1 };
    },
  };

  return { handlers, emitted };
}

const BASE_PROGRAM = {
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
} satisfies Omit<DeterminismProgramArtifact, 'code'>;

const BASE_PROGRAM_V2 = {
  abiId: 'Host.v2',
  abiVersion: 2,
  abiManifestHash: HOST_V2_HASH,
} satisfies Omit<DeterminismProgramArtifact, 'code'>;

export const DETERMINISM_FIXTURES: DeterminismFixture[] = [
  {
    name: 'doc-read',
    program: {
      ...BASE_PROGRAM,
      code: `
        (() => {
          const doc = document("path/to/doc");
          return {
            marker: "det-doc",
            doc,
            event,
            steps
          };
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        'b37ef077d8dbd7ca3b846595288f5f3c408f658b388aa27a09bca31ec260bd74',
      errorCode: null,
      errorTag: null,
      gasUsed: 727n,
      gasRemaining: 49273n,
      tapeHash:
        '497d3a537f25c9892ff8b211e4d10b534a15f3c4baee242ed78b275e6f4fbe95',
      tapeLength: 1,
    },
  },
  {
    name: 'doc-canonical',
    program: {
      ...BASE_PROGRAM,
      code: `
        (() => {
          const canonical = document.canonical("path/to/canonical");
          return {
            marker: "det-canonical",
            canonical,
            eventCanonical
          };
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        'f92ef306595931cdecb1c5e448a6dd343b70ef6ed52508e7007f918086349ae1',
      errorCode: null,
      errorTag: null,
      gasUsed: 759n,
      gasRemaining: 49241n,
      tapeHash:
        '92a9661491894b76b25edbdbfc5c50985edd19dcbce342b400053daf1ab77a28',
      tapeLength: 1,
    },
  },
  {
    name: 'multi-host',
    program: {
      ...BASE_PROGRAM,
      code: `
        (() => {
          const first = document("path/to/first");
          const second = document.canonical("path/to/second");
          Host.v1.emit({ first: first.path, canonical: second.canonical });
          const third = document("path/to/third");
          return {
            marker: "det-multi",
            first,
            second,
            third
          };
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        '55caac84e0b4ae1d4ba112253dffeeb3d380d18902846171b94c84533813842a',
      errorCode: null,
      errorTag: null,
      gasUsed: 1259n,
      gasRemaining: 48741n,
      tapeHash:
        '87ebafc74f16872c87953ac8856cc3403168b5040d7552cff6e0a74667da5e02',
      tapeLength: 4,
    },
  },
  {
    name: 'host-gas-paths',
    program: {
      ...BASE_PROGRAM,
      code: `
        (() => {
          const shortDoc = document("doc");
          const mediumDoc = document("path/to/medium");
          const longDoc = document.canonical("path/to/a/very/long/document/path");
          return {
            marker: "det-host-gas",
            shortDoc,
            mediumDoc,
            longDoc
          };
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        '95e87a4f23c4cf45119e800b24933e7549ddc878de6dcd4a13097a4a2970258a',
      errorCode: null,
      errorTag: null,
      gasUsed: 1128n,
      gasRemaining: 48872n,
      tapeHash:
        'bbc6919589461f5ee17a240edaf824f71ecb0269958273ddd815cb783aeb10e6',
      tapeLength: 3,
    },
  },
  {
    name: 'canon-ops',
    program: {
      ...BASE_PROGRAM,
      code: `
        (() => {
          const payloadId = canon.at(event, "/payload/id");
          const mode = canon.at(eventCanonical, "/payload/mode");
          const stepName = canon.at(steps, "/1/name");
          const cloned = canon.unwrap(event);
          return {
            marker: "det-canon",
            payloadId,
            mode,
            stepName,
            cloned
          };
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        'b19cd2f9dc8d93cb259a85f365378dd4e5b97f0a93adff0ac7d3f0b89c10ac2f',
      errorCode: null,
      errorTag: null,
      gasUsed: 1102n,
      gasRemaining: 48898n,
      tapeHash: null,
      tapeLength: 0,
    },
  },
  {
    name: 'async-promise-chain',
    program: {
      ...BASE_PROGRAM,
      executionProfile: 'compat-general-v1',
      code: `
        (() => Promise.resolve(40).then((value) => value + 2))()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        '7f83f7bda2d63959d34767689f06d47576683d378d9eb8d09386c9a020395c53',
      errorCode: null,
      errorTag: null,
      gasUsed: 561n,
      gasRemaining: 49439n,
      tapeHash: null,
      tapeLength: 0,
    },
  },
  {
    name: 'async-queue-microtask-host',
    program: {
      ...BASE_PROGRAM,
      executionProfile: 'compat-general-v1',
      code: `
        (() => {
          queueMicrotask(() => Host.v1.emit({ phase: 'microtask' }));
          return Promise.resolve({ ok: true });
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        '20a934991093b3d9bfcb5f3c05871eb1db002d19469c29ea3ae1ff7e4a29cd02',
      errorCode: null,
      errorTag: null,
      gasUsed: 650n,
      gasRemaining: 49350n,
      tapeHash:
        '43c068fe25380b52c96b71cbc266343a90afc80c928ebde6a7d967c8c57b6e5c',
      tapeLength: 1,
    },
  },
  {
    name: 'async-promise-rejection',
    program: {
      ...BASE_PROGRAM,
      executionProfile: 'compat-general-v1',
      code: `
        (() => Promise.reject(new Error('async-failure')))()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash: null,
      errorCode: 'UNKNOWN',
      errorTag: 'vm/unknown',
      gasUsed: 467n,
      gasRemaining: 49533n,
      tapeHash: null,
      tapeLength: 0,
    },
  },
  {
    name: 'compat-stable-sort',
    program: {
      ...BASE_PROGRAM,
      executionProfile: 'compat-general-v1',
      code: `
        (() => {
          const records = [
            { id: 'a', group: 1 },
            { id: 'b', group: 1 },
            { id: 'c', group: 2 },
            { id: 'd', group: 1 },
          ];
          records.sort((left, right) => left.group - right.group);
          return records.map((record) => record.id);
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        '950f57b0bb4280b09b5a63004acc9c50811ca16cea7c932494f47cb3cfb23c04',
      errorCode: null,
      errorTag: null,
      gasUsed: 1862n,
      gasRemaining: 48138n,
      tapeHash: null,
      tapeLength: 0,
    },
  },
  {
    name: 'compat-console-shim',
    program: {
      ...BASE_PROGRAM,
      executionProfile: 'compat-general-v1',
      code: `
        (() => {
          console.info('deterministic', 7);
          return { ok: true };
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        '20a934991093b3d9bfcb5f3c05871eb1db002d19469c29ea3ae1ff7e4a29cd02',
      errorCode: null,
      errorTag: null,
      gasUsed: 542n,
      gasRemaining: 49458n,
      tapeHash:
        'c481a1396ab5097cc8aa68fd11c1bb6e96d63259dba00b560bf49489fe5b2e3f',
      tapeLength: 1,
    },
  },
  {
    name: 'compat-binary-host-v2-bytes-roundtrip',
    program: {
      ...BASE_PROGRAM_V2,
      executionProfile: 'compat-binary-v1',
      code: `
        (() => {
          const payload = Host.v2.document.get('bytes/payload');
          Host.v2.emit(payload);
          let sum = 0;
          for (const byte of payload) {
            sum += byte;
          }
          return {
            length: payload.byteLength,
            first: payload[0],
            last: payload[payload.byteLength - 1],
            sum,
          };
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V2_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        'a538717d219fa0484c601ef7b5b63704c90cb9ae0406495b9f0083989a9fb2f8',
      errorCode: null,
      errorTag: null,
      gasUsed: 894n,
      gasRemaining: 49106n,
      tapeHash:
        'b2d3a3b07a1be6b39cd854077910a2bc839c281281275c2c137f6a704723a734',
      tapeLength: 2,
    },
  },
  {
    name: 'json-builtins',
    program: {
      ...BASE_PROGRAM,
      code: `
        (() => {
          return JSON.stringify(JSON.parse('{"aa":1,"b":2}'));
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash:
        'd3cabc4fcb3aaddef313e841cd56fec5936b96a44a7d45eff624b81dd9e221d8',
      errorCode: null,
      errorTag: null,
      gasUsed: 480n,
      gasRemaining: 49520n,
      tapeHash: null,
      tapeLength: 0,
    },
  },
  {
    name: 'host-error-invalid',
    program: {
      ...BASE_PROGRAM,
      code: `
        (() => {
          document("invalid/path");
          return { marker: "det-invalid" };
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash: null,
      errorCode: 'INVALID_PATH',
      errorTag: 'host/invalid_path',
      gasUsed: 573n,
      gasRemaining: 49427n,
      tapeHash:
        '79af1be3f347fffc766bbe0baef9a183f0d6ee206468954d8f2adb9c146b9ddc',
      tapeLength: 1,
    },
  },
  {
    name: 'host-error-limit',
    program: {
      ...BASE_PROGRAM,
      code: `
        (() => {
          document("limit/doc");
          return { marker: "det-limit" };
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash: null,
      errorCode: 'LIMIT_EXCEEDED',
      errorTag: 'host/limit',
      gasUsed: 570n,
      gasRemaining: 49430n,
      tapeHash:
        '4894237cf19c834c9bff793693a158be3443e56df132773f6c61c7aed456a088',
      tapeLength: 1,
    },
  },
  {
    name: 'host-error',
    program: {
      ...BASE_PROGRAM,
      code: `
        (() => {
          document("missing/doc");
          return { marker: "det-error" };
        })()
      `.trim(),
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      resultHash: null,
      errorCode: 'NOT_FOUND',
      errorTag: 'host/not_found',
      gasUsed: 568n,
      gasRemaining: 49432n,
      tapeHash:
        'a540c3ce0fd4043d8c3262e3c1ae2bc6bb50d3e17d0cc1dd2a8af8957eaca013',
      tapeLength: 1,
    },
  },
];
