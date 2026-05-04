import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildDeterministicModulePack } from '@blue-quickjs/deterministic-bundler';
import {
  buildModulePackFromSources,
  computeModulePackGraphHash,
  ModulePackBuildError,
  normalizeModulePackSpecifier,
  validateModulePack,
  type ModulePackBuildDiagnosticCode,
} from '../index.js';
import type { ModulePackV1 } from '../lib/quickjs-runtime.js';

const SAMPLE_HASH =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('computeModulePackGraphHash', () => {
  it('is stable for differently ordered modules and matches the canonical payload', async () => {
    const unordered = modulePackWithoutHash({
      modules: [
        { specifier: './z.js', source: 'export const z = 1;\n' },
        { specifier: './entry.js', source: "import './z.js'; export default 1;\n" },
      ],
    });
    const reordered = modulePackWithoutHash({
      modules: [...unordered.modules].reverse(),
    });

    const first = await computeModulePackGraphHash(unordered);
    const second = await computeModulePackGraphHash(reordered);

    expect(first).toBe(second);
    expect(first).toBe(
      sha256Hex(
        stableStringify({
          version: unordered.version,
          entrySpecifier: unordered.entrySpecifier,
          entryExport: 'default',
          modules: [
            {
              specifier: './entry.js',
              source: "import './z.js'; export default 1;\n",
            },
            { specifier: './z.js', source: 'export const z = 1;\n' },
          ],
          builderVersion: unordered.builderVersion,
          dependencyIntegrity: unordered.dependencyIntegrity,
        }),
      ),
    );
  });

  it('matches buildDeterministicModulePack graph hashes for canonical ModulePack.v1 data', async () => {
    const fixtureDir = createFixtureDir();
    writeFixture(fixtureDir, 'helper.js', 'export const value = 5;\n');
    writeFixture(
      fixtureDir,
      'entry.js',
      "import { value } from './helper.js'; export default value;\n",
    );

    const built = await buildDeterministicModulePack({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.js',
      builderVersion: 'runtime-hash-comparison',
      dependencyIntegrity: SAMPLE_HASH,
    });

    await expect(computeModulePackGraphHash(built.modulePack)).resolves.toBe(
      built.modulePack.graphHash,
    );
  });
});

describe('validateModulePack', () => {
  it('accepts a valid module pack and rejects malformed packs', async () => {
    const pack = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      sources: { './entry.js': 'export default 1;\n' },
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(validateModulePack(pack)).toEqual(pack);
    expect(() => validateModulePack({ ...pack, graphHash: 'not-a-hash' })).toThrow(
      /graphHash/,
    );
  });
});

describe('buildModulePackFromSources', () => {
  it('builds an entry-only module pack', async () => {
    const pack = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      sources: { './entry.js': 'export default 1;\n' },
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(pack.entrySpecifier).toBe('./entry.js');
    expect(pack.entryExport).toBe('default');
    expect(pack.modules.map((module) => module.specifier)).toEqual([
      './entry.js',
    ]);
    await expect(computeModulePackGraphHash(pack)).resolves.toBe(pack.graphHash);
  });

  it('builds a reachable graph for an entry importing ./helper.js', async () => {
    const pack = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      sources: {
        './unused.js': 'export default 0;\n',
        './helper.js': 'export const value = 41;\n',
        './entry.js':
          "import { value } from './helper.js'; export default value + 1;\n",
      },
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(pack.modules.map((module) => module.specifier)).toEqual([
      './entry.js',
      './helper.js',
    ]);
  });

  it('resolves nested relative imports using POSIX semantics', async () => {
    const pack = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      sources: {
        './entry.js':
          "import { value } from './lib/a.js'; export default value;\n",
        './lib/a.js': "import { value } from './b.js'; export { value };\n",
        './lib/b.js': 'export const value = 7;\n',
      },
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(pack.modules.map((module) => module.specifier)).toEqual([
      './entry.js',
      './lib/a.js',
      './lib/b.js',
    ]);
  });

  it('allows cyclic static imports', async () => {
    const pack = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      sources: {
        './entry.js': "import { value } from './a.js'; export default value;\n",
        './a.js':
          "import { value as b } from './b.js'; export const value = b + 1;\n",
        './b.js':
          "import { value as a } from './a.js'; export const value = 1; export const seen = a;\n",
      },
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(pack.modules.map((module) => module.specifier)).toEqual([
      './a.js',
      './b.js',
      './entry.js',
    ]);
  });

  it('uses a named entryExport when requested', async () => {
    const pack = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      entryExport: 'answer',
      sources: { './entry.js': 'export const answer = 42;\n' },
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(pack.entryExport).toBe('answer');
  });

  it('includes unreachable modules only when explicitly requested', async () => {
    const pack = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      includeUnreachable: true,
      sources: {
        './entry.js': 'export default 1;\n',
        './unused.js': 'export default 2;\n',
      },
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(pack.modules.map((module) => module.specifier)).toEqual([
      './entry.js',
      './unused.js',
    ]);
    expect(pack.diagnosticsMeta?.unreachableModulePaths).toEqual([
      './unused.js',
    ]);
  });

  it('supports explicit bare import aliases', async () => {
    const pack = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      importAliases: { '@lib/value': './lib/value.js' },
      sources: {
        './entry.js':
          "import { value } from '@lib/value'; export default value;\n",
        './lib/value.js': 'export const value = 9;\n',
      },
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(pack.modules.map((module) => module.specifier)).toEqual([
      './entry.js',
      './lib/value.js',
    ]);
  });

  it('normalizes CRLF and LF sources to the same graph hash', async () => {
    const lf = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      sources: { './entry.js': 'const value = 1;\nexport default value;\n' },
      dependencyIntegrity: SAMPLE_HASH,
    });
    const crlf = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      sources: { './entry.js': 'const value = 1;\r\nexport default value;\r\n' },
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(crlf.modules[0].source).toBe(lf.modules[0].source);
    expect(crlf.graphHash).toBe(lf.graphHash);
  });

  it('returns compatibility metadata when rejectIncompatible is false', async () => {
    const pack = await buildModulePackFromSources({
      entrySpecifier: './entry.js',
      rejectIncompatible: false,
      sources: { './entry.js': 'export default Date.now();\n' },
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(pack.diagnosticsMeta?.compatibilityDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'COMPATIBILITY_ERROR' }),
      ]),
    );
  });

  const rejectionCases = [
    ['missing import', "import './missing.js'; export default 1;", 'MISSING_IMPORT'],
    [
      'dynamic import',
      "export default import('./next.js');",
      'DYNAMIC_IMPORT_DISABLED',
    ],
    [
      'CommonJS require',
      "const x = require('./x.js'); export default x;",
      'COMMONJS_REQUIRE_DISABLED',
    ],
    [
      'Node builtin import',
      "import fs from 'node:fs'; export default fs;",
      'NODE_BUILTIN_IMPORT_DISABLED',
    ],
    [
      'bare import',
      "import value from 'pkg'; export default value;",
      'BARE_IMPORT_DISABLED',
    ],
  ] satisfies Array<[string, string, ModulePackBuildDiagnosticCode]>;

  it.each(rejectionCases)(
    'rejects %s before runtime evaluation',
    async (_name, source, code) => {
      await expectBuildError(
        {
          entrySpecifier: './entry.js',
          sources: { './entry.js': source },
          dependencyIntegrity: SAMPLE_HASH,
        },
        code,
      );
    },
  );

  it('rejects duplicate normalized specifiers', async () => {
    await expectBuildError(
      {
        entrySpecifier: './entry.js',
        sources: [
          { specifier: './entry.js', source: 'export default 1;' },
          { specifier: './lib/./value.js', source: 'export default 1;' },
          { specifier: './lib/value.js', source: 'export default 2;' },
        ],
        dependencyIntegrity: SAMPLE_HASH,
      },
      'DUPLICATE_SPECIFIER',
    );
  });

  it.each([
    ['./../entry.js'],
    ['./lib/../entry.js'],
    ['.\\entry.js'],
  ])('rejects invalid source specifier %s', async (specifier) => {
    await expectBuildError(
      {
        entrySpecifier: './entry.js',
        sources: [
          { specifier: './entry.js', source: 'export default 1;' },
          { specifier, source: 'export default 2;' },
        ],
        dependencyIntegrity: SAMPLE_HASH,
      },
      'INVALID_SPECIFIER',
    );
  });

  it('rejects baseline compatibility violations by default', async () => {
    await expectBuildError(
      {
        entrySpecifier: './entry.js',
        sources: { './entry.js': 'export default Math.random();\n' },
        dependencyIntegrity: SAMPLE_HASH,
      },
      'COMPATIBILITY_ERROR',
    );
  });

  it('normalizes public module-pack specifier helpers', () => {
    expect(normalizeModulePackSpecifier('./lib/./value.js')).toBe(
      './lib/value.js',
    );
    expect(() => normalizeModulePackSpecifier('./lib/../value.js')).toThrow(
      ModulePackBuildError,
    );
  });
});

async function expectBuildError(
  options: Parameters<typeof buildModulePackFromSources>[0],
  expectedCode: ModulePackBuildDiagnosticCode,
): Promise<void> {
  const error = await buildModulePackFromSources(options)
    .then(() => {
      throw new Error('expected ModulePackBuildError');
    })
    .catch((caught) => caught);

  expect(error).toBeInstanceOf(ModulePackBuildError);
  const buildError = error as ModulePackBuildError;
  expect(buildError.diagnostics).toEqual(
    expect.arrayContaining([expect.objectContaining({ code: expectedCode })]),
  );
}

function modulePackWithoutHash(
  overrides: Partial<Omit<ModulePackV1, 'graphHash'>>,
): Omit<ModulePackV1, 'graphHash'> {
  return {
    version: 1,
    entrySpecifier: './entry.js',
    modules: [{ specifier: './entry.js', source: 'export default 1;\n' }],
    builderVersion: 'test-builder',
    dependencyIntegrity: SAMPLE_HASH,
    ...overrides,
  };
}

function createFixtureDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'quickjs-runtime-builder-'));
}

function writeFixture(
  dir: string,
  relativePath: string,
  contents: string,
): void {
  const filePath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
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
