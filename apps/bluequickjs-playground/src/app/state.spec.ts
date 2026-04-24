import {
  getInitialExample,
  getProfileSummary,
  groupExamples,
} from './state.js';
import type { LoadedPlaygroundData } from './types.js';

const DATA = {
  examples: {
    generatedAt: '2026-03-21T00:00:00.000Z',
    metadata: {
      engineBuildHash: 'a'.repeat(64),
      gasVersion: 8,
      wasmVariant: 'wasm32',
      wasmBuildType: 'release',
    },
    examples: [
      {
        id: 'example-basic-script',
        title: 'Basic deterministic script',
        kind: 'example',
        badge: 'Example 1',
        description: 'Basic deterministic script',
        certified: true,
        executionProfile: 'baseline-v1',
        sourceKind: 'script',
        abiId: 'Host.v1',
        gasLimit: '1000000',
        sourcePaths: ['examples/01-basic-script/program.js'],
        sourceText: '(() => 1)();',
        hostPreset: 'determinism',
        hostSummary: {
          label: 'Determinism fixture host',
          description: 'stable host',
          documents: [],
        },
        docsLinks: [],
        supportsOogSearch: true,
        program: {
          version: 2,
          abiId: 'Host.v1',
          abiVersion: 1,
          abiManifestHash: 'b'.repeat(64),
          engineBuildHash: 'a'.repeat(64),
          gasVersion: 8,
          executionProfile: 'baseline-v1',
          sourceKind: 'script',
          source: { code: '(() => 1)();' },
        },
        manifest: {
          abi_id: 'Host.v1',
          abi_version: 1,
          functions: [],
        },
      },
      {
        id: 'green-semver',
        title: 'semver',
        kind: 'ecosystem-green',
        badge: 'Green ecosystem fixture',
        description: 'semver fixture',
        certified: true,
        executionProfile: 'compat-general-v1',
        sourceKind: 'module-pack',
        abiId: 'Host.v1',
        gasLimit: '1000000',
        sourcePaths: [
          'apps/ecosystem-certifier/fixtures/positive/semver-entry.ts',
        ],
        sourceText: 'export default 1;',
        hostPreset: 'certification',
        hostSummary: {
          label: 'Certification host',
          description: 'cert host',
          documents: [],
        },
        docsLinks: [],
        supportsOogSearch: false,
        program: {
          version: 2,
          abiId: 'Host.v1',
          abiVersion: 1,
          abiManifestHash: 'b'.repeat(64),
          engineBuildHash: 'a'.repeat(64),
          gasVersion: 8,
          executionProfile: 'compat-general-v1',
          sourceKind: 'module-pack',
          source: {
            modulePack: {
              version: 1,
              entrySpecifier: './entry.js',
              modules: [],
              graphHash: 'c'.repeat(64),
              builderVersion: 'deterministic-builder-v1',
              dependencyIntegrity: 'd'.repeat(64),
            },
          },
        },
        manifest: {
          abi_id: 'Host.v1',
          abi_version: 1,
          functions: [],
        },
      },
    ],
  },
  evidence: {
    generatedAt: '',
    metadata: { engineBuildHash: 'a'.repeat(64), gasVersion: 8 },
    evidence: {},
  },
  oog: {
    generatedAt: '',
    metadata: { engineBuildHash: 'a'.repeat(64), gasVersion: 8 },
    boundaries: {},
  },
  red: {
    generatedAt: '',
    metadata: { engineBuildHash: 'a'.repeat(64), gasVersion: 8 },
    fixtures: [],
  },
} satisfies LoadedPlaygroundData;

describe('playground state helpers', () => {
  it('returns the first example as initial selection', () => {
    expect(getInitialExample(DATA).id).toBe('example-basic-script');
  });

  it('groups gallery entries by kind', () => {
    const groups = groupExamples(DATA.examples.examples);
    expect(groups.example).toHaveLength(1);
    expect(groups['ecosystem-green']).toHaveLength(1);
  });

  it('summarizes profile capabilities', () => {
    expect(getProfileSummary('baseline-v1')).toContain(
      'Minimal consensus baseline',
    );
    expect(getProfileSummary('compat-general-v1')).toContain('promiseJobs');
  });
});
