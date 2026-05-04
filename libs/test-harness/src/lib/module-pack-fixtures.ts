import type { AbiManifest } from '@blue-quickjs/abi-manifest';
import type { DV } from '@blue-quickjs/dv';
import { HOST_V1_HASH, HOST_V1_MANIFEST } from './abi-manifest-fixtures.js';
import {
  createDeterminismHost,
  DETERMINISM_GAS_LIMIT,
  DETERMINISM_INPUT,
  type DeterminismHostEnvironment,
  type DeterminismInputEnvelope,
} from './determinism-fixtures.js';

export interface ModulePackV1FixtureModule {
  specifier: string;
  source: string;
  sourceMap?: string;
}

export interface ModulePackV1Fixture {
  version: 1;
  entrySpecifier: string;
  entryExport?: string;
  modules: ModulePackV1FixtureModule[];
  graphHash: string;
  builderVersion: string;
  dependencyIntegrity: string;
}

export interface ProgramArtifactV2ModulePackFixture {
  version: 2;
  abiId: string;
  abiVersion: number;
  abiManifestHash: string;
  executionProfile: 'baseline-v1' | 'compat-general-v1';
  sourceKind: 'module-pack';
  source: {
    modulePack: ModulePackV1Fixture;
  };
}

export type ModulePackFixtureExpected =
  | {
      ok: true;
      value: DV;
    }
  | {
      ok: false;
      errorCode:
        | 'MODULE_SPECIFIER_NOT_FOUND'
        | 'MODULE_EXPORT_MISSING'
        | 'MODULE_RESOLUTION_ERROR'
        | 'MODULE_EVALUATION_ERROR';
      errorTag: 'vm/module_pack';
    };

export interface ModulePackFixture {
  name: string;
  program: ProgramArtifactV2ModulePackFixture;
  input: DeterminismInputEnvelope;
  gasLimit: bigint;
  manifest: AbiManifest;
  createHost: () => DeterminismHostEnvironment;
  expected: ModulePackFixtureExpected;
}

const MODULE_PACK_BASE = {
  version: 2 as const,
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
  executionProfile: 'baseline-v1' as const,
  sourceKind: 'module-pack' as const,
};

const BUILDER_VERSION = 'deterministic-builder-v1';
const DEPENDENCY_INTEGRITY =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function createModulePack(options: {
  entrySpecifier: string;
  modules: ModulePackV1FixtureModule[];
  entryExport?: string;
  graphHash: string;
}): ModulePackV1Fixture {
  return {
    version: 1,
    entrySpecifier: options.entrySpecifier,
    ...(options.entryExport ? { entryExport: options.entryExport } : {}),
    modules: options.modules,
    graphHash: options.graphHash,
    builderVersion: BUILDER_VERSION,
    dependencyIntegrity: DEPENDENCY_INTEGRITY,
  };
}

export const MODULE_PACK_FIXTURES: ModulePackFixture[] = [
  {
    name: 'module-pack-default-export',
    program: {
      ...MODULE_PACK_BASE,
      source: {
        modulePack: createModulePack({
          entrySpecifier: './entry.js',
          graphHash:
            '68df8be0dee6f4df62f54776c08a61cd42f9b39c74a4968d0217fc748b8b7863',
          modules: [
            {
              specifier: './entry.js',
              source:
                "import { base } from './values.js'; export default base + 1;\n",
            },
            {
              specifier: './values.js',
              source: 'export const base = 6;\n',
            },
          ],
        }),
      },
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      ok: true,
      value: 7,
    },
  },
  {
    name: 'module-pack-named-export',
    program: {
      ...MODULE_PACK_BASE,
      source: {
        modulePack: createModulePack({
          entrySpecifier: './entry.js',
          entryExport: 'answer',
          graphHash:
            '212edbf5272cae51f21fbb306b41103ab57d94b37c0f0f90f0b234f4a8a81df8',
          modules: [
            {
              specifier: './entry.js',
              source:
                "import { left, right } from './parts.js'; export const answer = left + right;\n",
            },
            {
              specifier: './parts.js',
              source: 'export const left = 20; export const right = 22;\n',
            },
          ],
        }),
      },
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      ok: true,
      value: 42,
    },
  },
  {
    name: 'module-pack-cyclic-imports',
    program: {
      ...MODULE_PACK_BASE,
      source: {
        modulePack: createModulePack({
          entrySpecifier: './entry.js',
          graphHash:
            '4f66500f07dd2bbc0be1a9fb8121a3f9e30c633afdbc4753c269f5110f5d8ba4',
          modules: [
            {
              specifier: './entry.js',
              source:
                "import { valueFromB } from './b.js'; export default valueFromB;\n",
            },
            {
              specifier: './a.js',
              source:
                "import { getB } from './b.js'; export function getA() { return 40 + getB(); }\n",
            },
            {
              specifier: './b.js',
              source:
                "import { getA } from './a.js'; export function getB() { return 2; } export const valueFromB = getA();\n",
            },
          ],
        }),
      },
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      ok: true,
      value: 42,
    },
  },
  {
    name: 'module-pack-host-call-tape',
    program: {
      ...MODULE_PACK_BASE,
      source: {
        modulePack: createModulePack({
          entrySpecifier: './entry.js',
          graphHash:
            '2cad30ee71aa78376357c526292004b4efc4864af0c93b0196a84a8e2730e67d',
          modules: [
            {
              specifier: './entry.js',
              source:
                "globalThis.Host.v1.emit({ kind: 'module-pack', path: 'path/to/module-pack-doc' });\nexport default { path: 'path/to/module-pack-doc', len: 23 };\n",
            },
          ],
        }),
      },
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      ok: true,
      value: { path: 'path/to/module-pack-doc', len: 23 },
    },
  },
  {
    name: 'module-pack-async-import-host-call',
    program: {
      ...MODULE_PACK_BASE,
      executionProfile: 'compat-general-v1',
      source: {
        modulePack: createModulePack({
          entrySpecifier: './entry.js',
          graphHash:
            '629b89a6e192c62e9d7d0a1b6b2debd9bcad6b9110389e949ba5d86156bd000b',
          modules: [
            {
              specifier: './entry.js',
              source:
                'import { plusOne } from "./lib.js";\nexport default Promise.resolve(plusOne(41)).then((value) => { Host.v1.emit({ phase: "async-lib", value }); return value; });\n',
            },
            {
              specifier: './lib.js',
              source: 'export const plusOne = (value) => value + 1;\n',
            },
          ],
        }),
      },
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      ok: true,
      value: 42,
    },
  },
  {
    name: 'module-pack-kitchen-sink',
    program: {
      ...MODULE_PACK_BASE,
      executionProfile: 'compat-general-v1',
      source: {
        modulePack: createModulePack({
          entrySpecifier: './entry.js',
          graphHash:
            'ce277312313ac06e3488d98b33b59213baf0d989beca4681b93cff31ba2532be',
          modules: [
            {
              specifier: './entry.js',
              source:
                'import { summarize } from "./workflow.js";\nexport default (async () => {\n  const doc = document("path/to/doc");\n  const canonical = document.canonical("path/to/doc");\n  const result = await summarize(doc.path, canonical.canonical);\n  Host.v1.emit({ kind: "kitchen", result });\n  return result;\n})();\n',
            },
            {
              specifier: './workflow.js',
              source:
                'export async function summarize(path, canonical) {\n  const queue = [];\n  queueMicrotask(() => queue.push("micro"));\n  await Promise.resolve();\n  const records = [\n    { id: "b", rank: 2 },\n    { id: "a", rank: 1 },\n    { id: "c", rank: 2 },\n  ];\n  records.sort((left, right) => left.rank - right.rank);\n  return {\n    path,\n    canonical,\n    order: records.map((record) => record.id).join(","),\n    queue: queue.join(","),\n  };\n}\n',
            },
          ],
        }),
      },
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      ok: true,
      value: {
        path: 'path/to/doc',
        canonical: 'path/to/doc',
        order: 'a,b,c',
        queue: 'micro',
      },
    },
  },
  {
    name: 'module-pack-missing-entry-specifier',
    program: {
      ...MODULE_PACK_BASE,
      source: {
        modulePack: createModulePack({
          entrySpecifier: './missing.js',
          graphHash:
            'd5708a847d11a9574dc665168733100dd503239075a444809380458ca05e608f',
          modules: [
            {
              specifier: './entry.js',
              source: 'export default 1;\n',
            },
          ],
        }),
      },
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      ok: false,
      errorCode: 'MODULE_SPECIFIER_NOT_FOUND',
      errorTag: 'vm/module_pack',
    },
  },
  {
    name: 'module-pack-missing-export',
    program: {
      ...MODULE_PACK_BASE,
      source: {
        modulePack: createModulePack({
          entrySpecifier: './entry.js',
          entryExport: 'missing',
          graphHash:
            '44d6a5d503fe3ddc0c932d2e0dbbaab85f996253d58ff0cfeb0eee905ff9d60e',
          modules: [
            {
              specifier: './entry.js',
              source: 'export const value = 1;\n',
            },
          ],
        }),
      },
    },
    input: DETERMINISM_INPUT,
    gasLimit: DETERMINISM_GAS_LIMIT,
    manifest: HOST_V1_MANIFEST,
    createHost: createDeterminismHost,
    expected: {
      ok: false,
      errorCode: 'MODULE_EXPORT_MISSING',
      errorTag: 'vm/module_pack',
    },
  },
];
