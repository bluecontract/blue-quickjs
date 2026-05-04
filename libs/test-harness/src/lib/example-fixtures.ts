export type ExampleFixtureSuite =
  | 'gas-sample'
  | 'gas-boundary'
  | 'module-pack'
  | 'determinism'
  | 'chess-library'
  | 'binary-library';

export interface ExampleFixtureTarget {
  suite: ExampleFixtureSuite;
  fixtureName: string;
}

export interface ExampleCorpusEntry {
  id: number;
  slug: string;
  title: string;
  profile: string | string[];
  sourcePaths: string[];
  coverage: ExampleFixtureTarget[];
}

export const EXAMPLE_CORPUS: ExampleCorpusEntry[] = [
  {
    id: 1,
    slug: 'basic-script',
    title: 'Basic deterministic script',
    profile: 'baseline-v1',
    sourcePaths: ['examples/01-basic-script/program.js'],
    coverage: [{ suite: 'gas-sample', fixtureName: 'return-1' }],
  },
  {
    id: 2,
    slug: 'module-pack',
    title: 'Standard ESM module-pack',
    profile: 'baseline-v1',
    sourcePaths: [
      'examples/02-module-pack/entry.js',
      'examples/02-module-pack/values.js',
    ],
    coverage: [
      { suite: 'module-pack', fixtureName: 'module-pack-default-export' },
    ],
  },
  {
    id: 3,
    slug: 'library-reuse',
    title: 'Real npm library reuse',
    profile: ['compat-general-v1', 'compat-binary-v1'],
    sourcePaths: [
      'examples/03-library-reuse/chess-entry.ts',
      'examples/03-library-reuse/binary-base64-entry.ts',
    ],
    coverage: [
      { suite: 'chess-library', fixtureName: 'chess-e2e6' },
      { suite: 'binary-library', fixtureName: 'base64-js-roundtrip' },
      { suite: 'binary-library', fixtureName: 'noble-sha256-hex' },
    ],
  },
  {
    id: 4,
    slug: 'promises-async',
    title: 'Promises / async / microtasks',
    profile: 'compat-general-v1',
    sourcePaths: ['examples/04-promises-async/program.js'],
    coverage: [{ suite: 'determinism', fixtureName: 'async-promise-chain' }],
  },
  {
    id: 5,
    slug: 'promises-library-host',
    title: 'Promises + imported library + host call',
    profile: 'compat-general-v1',
    sourcePaths: [
      'examples/05-promises-library-host/entry.js',
      'examples/05-promises-library-host/lib.js',
    ],
    coverage: [
      {
        suite: 'module-pack',
        fixtureName: 'module-pack-async-import-host-call',
      },
    ],
  },
  {
    id: 6,
    slug: 'binary-host-v2',
    title: 'Binary / typed arrays / Host.v2 DV2',
    profile: 'compat-binary-v1',
    sourcePaths: ['examples/06-binary-host-v2/program.js'],
    coverage: [
      {
        suite: 'determinism',
        fixtureName: 'compat-binary-host-v2-bytes-roundtrip',
      },
    ],
  },
  {
    id: 7,
    slug: 'console-shim',
    title: 'Console shim determinism',
    profile: 'compat-general-v1',
    sourcePaths: ['examples/07-console-shim/program.js'],
    coverage: [{ suite: 'determinism', fixtureName: 'compat-console-shim' }],
  },
  {
    id: 8,
    slug: 'stable-sort',
    title: 'Stable sort determinism',
    profile: 'compat-general-v1',
    sourcePaths: ['examples/08-stable-sort/program.js'],
    coverage: [{ suite: 'determinism', fixtureName: 'compat-stable-sort' }],
  },
  {
    id: 9,
    slug: 'kitchen-sink',
    title: 'Kitchen sink app',
    profile: 'compat-general-v1',
    sourcePaths: [
      'examples/09-kitchen-sink/entry.js',
      'examples/09-kitchen-sink/workflow.js',
    ],
    coverage: [
      { suite: 'module-pack', fixtureName: 'module-pack-kitchen-sink' },
    ],
  },
  {
    id: 10,
    slug: 'max-gas-policy',
    title: 'Max-gas policy / OOG boundary',
    profile: 'baseline-v1',
    sourcePaths: ['examples/10-max-gas-policy/program.js'],
    coverage: [{ suite: 'gas-boundary', fixtureName: 'loop-10k' }],
  },
];
