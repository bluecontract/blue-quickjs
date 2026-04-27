import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildDeterministicModulePack,
  bundleDeterministicProgram,
  DeterministicBundlerError,
  scanCompatibility,
} from './deterministic-bundler.js';

describe('bundleDeterministicProgram', () => {
  it('produces deterministic code and hash for the same inputs', async () => {
    const fixtureDir = createFixtureDir();
    writeFixture(fixtureDir, 'util.ts', 'export const value = 7;');
    writeFixture(
      fixtureDir,
      'entry.ts',
      "import { value } from './util'; export default value;",
    );

    const first = await bundleDeterministicProgram({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
    });
    const second = await bundleDeterministicProgram({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
    });

    expect(first.code).toBe(second.code);
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.code).toContain(';__blueDeterministicBundle.default;');
    expect(first.meta.modulePaths).toEqual(second.meta.modulePaths);
    expect(first.meta.modulePaths).toHaveLength(2);
    expect(first.meta.compatibility.ok).toBe(true);
  });

  it('rejects baseline bundles that use RegExp literals', async () => {
    const fixtureDir = createFixtureDir();
    writeFixture(
      fixtureDir,
      'entry.ts',
      "export default /a/.test('a') && Math.random() > -1;",
    );

    const error = await bundleDeterministicProgram({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
    })
      .then(() => {
        throw new Error('expected compatibility failure');
      })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(DeterministicBundlerError);
    const bundlerError = error as DeterministicBundlerError;
    expect(
      bundlerError.diagnostics.some(
        (diagnostic) => diagnostic.ruleId === 'regexp_literal_disabled',
      ),
    ).toBe(true);
    expect(
      bundlerError.diagnostics.some(
        (diagnostic) => diagnostic.ruleId === 'math_random_disabled',
      ),
    ).toBe(true);
  });

  it('allows regexp usage under compat-regexp profile', async () => {
    const fixtureDir = createFixtureDir();
    writeFixture(fixtureDir, 'entry.ts', "export default /a/.test('a');");

    const bundled = await bundleDeterministicProgram({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
      profile: 'compat-regexp-v1',
    });

    expect(bundled.meta.compatibility.ok).toBe(true);
    expect(bundled.meta.profile).toBe('compat-regexp-v1');
  });

  it('bundles chess.js fixture only under compat-regexp profile', async () => {
    const workspaceRoot = path.resolve(process.cwd(), '../..');

    await expect(
      bundleDeterministicProgram({
        absWorkingDir: workspaceRoot,
        entryPath: 'libs/test-harness/fixtures/library-reuse/chess-entry.ts',
      }),
    ).rejects.toBeInstanceOf(DeterministicBundlerError);

    const bundled = await bundleDeterministicProgram({
      absWorkingDir: workspaceRoot,
      entryPath: 'libs/test-harness/fixtures/library-reuse/chess-entry.ts',
      profile: 'compat-regexp-v1',
    });

    expect(bundled.meta.compatibility.ok).toBe(true);
    expect(bundled.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(bundled.code.length).toBeGreaterThan(1000);
  });
});

describe('scanCompatibility', () => {
  it('detects dynamic import and node builtins deterministically', () => {
    const scan = scanCompatibility({
      sourceByPath: {
        '/tmp/sample.ts':
          "import fs from 'node:fs'; const x = import('./next.js'); export default x;",
      },
    });

    expect(scan.ok).toBe(false);
    expect(scan.diagnostics).toEqual([
      {
        filePath: '/tmp/sample.ts',
        ruleId: 'dynamic_import_disabled',
        message: 'dynamic import() is disabled in deterministic mode',
      },
      {
        filePath: '/tmp/sample.ts',
        ruleId: 'node_builtin_import',
        message: 'node builtin import is disabled: node:fs',
      },
    ]);
  });

  it('allows regexp and console usage under compat-general profile', () => {
    const scan = scanCompatibility({
      profile: 'compat-general-v1',
      sourceByPath: {
        '/tmp/sample.ts': "console.log(/a/.test('a')); export default true;",
      },
    });

    expect(scan.ok).toBe(true);
  });

  it('allows typed arrays under compat-binary profile', () => {
    const scan = scanCompatibility({
      profile: 'compat-binary-v1',
      sourceByPath: {
        '/tmp/sample.ts': 'export default new Uint8Array([1, 2, 3]).length;',
      },
    });

    expect(scan.ok).toBe(true);
  });
});

describe('buildDeterministicModulePack', () => {
  it('builds deterministic module-pack output for workspace TS fixture', async () => {
    const fixtureDir = createFixtureDir();
    writeFixture(fixtureDir, 'lib/util.ts', 'export const value = 11;');
    writeFixture(
      fixtureDir,
      'entry.ts',
      "import { value } from './lib/util'; export default value;",
    );

    const first = await buildDeterministicModulePack({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
      emitScriptArtifact: true,
    });
    const second = await buildDeterministicModulePack({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
      emitScriptArtifact: true,
    });

    expect(first.modulePack.version).toBe(1);
    expect(first.modulePack.entryExport).toBe('default');
    expect(first.modulePack.modules.length).toBeGreaterThanOrEqual(1);
    expect(first.modulePack.graphHash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.modulePack.graphHash).toBe(first.modulePack.graphHash);
    expect(second.modulePack.modules).toEqual(first.modulePack.modules);
    expect(first.compatibility.ok).toBe(true);
    expect(first.compatibilityReport.version).toBe(1);
    expect(first.compatibilityReport.profile).toBe('baseline-v1');
    expect(first.compatibilityReport.moduleCount).toBe(
      first.modulePack.modules.length,
    );
    expect(first.scriptArtifact?.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('builds module-pack for external npm ESM fixture', async () => {
    const fixtureDir = createFixtureDir();
    writeFixture(
      fixtureDir,
      'node_modules/esm-lib/package.json',
      JSON.stringify(
        {
          name: 'esm-lib',
          version: '1.0.0',
          type: 'module',
          exports: './index.js',
        },
        null,
        2,
      ),
    );
    writeFixture(
      fixtureDir,
      'node_modules/esm-lib/index.js',
      'export const value = 41; export default value;',
    );
    writeFixture(
      fixtureDir,
      'entry.ts',
      "import { value } from 'esm-lib'; export default value + 1;",
    );

    const built = await buildDeterministicModulePack({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
      profile: 'compat-regexp-v1',
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(built.compatibility.ok).toBe(true);
    expect(
      built.modulePack.modules.some(
        (module) => module.originMeta?.packageName === 'esm-lib',
      ),
    ).toBe(true);
    expect(
      built.modulePack.modules.every(
        (module) => !module.source.includes(normalizePath(fixtureDir)),
      ),
    ).toBe(true);
  });

  it('builds module-pack for external npm CJS fixture', async () => {
    const fixtureDir = createFixtureDir();
    writeFixture(
      fixtureDir,
      'node_modules/cjs-lib/package.json',
      JSON.stringify(
        {
          name: 'cjs-lib',
          version: '2.0.0',
          main: 'index.cjs',
        },
        null,
        2,
      ),
    );
    writeFixture(
      fixtureDir,
      'node_modules/cjs-lib/index.cjs',
      "module.exports = { isValid: (value) => value === '1.2.3' };",
    );
    writeFixture(
      fixtureDir,
      'entry.ts',
      "import lib from 'cjs-lib'; export default lib.isValid('1.2.3');",
    );

    const built = await buildDeterministicModulePack({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
      profile: 'compat-regexp-v1',
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(built.compatibility.ok).toBe(true);
    expect(
      built.modulePack.modules.some(
        (module) => module.originMeta?.packageName === 'cjs-lib',
      ),
    ).toBe(true);
    expect(
      built.modulePack.modules.every((module) =>
        module.sourceMap
          ? !module.sourceMap.includes(normalizePath(fixtureDir))
          : true,
      ),
    ).toBe(true);
  });

  it('emits ProgramArtifact.v2 when requested', async () => {
    const fixtureDir = createFixtureDir();
    writeFixture(fixtureDir, 'entry.ts', 'export default 99;');

    const built = await buildDeterministicModulePack({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
      emitProgramArtifact: true,
      abiManifestHash: SAMPLE_HASH,
      engineBuildHash: SAMPLE_HASH,
    });

    expect(built.programArtifact).toEqual({
      version: 2,
      abiId: 'Host.v1',
      abiVersion: 1,
      abiManifestHash: SAMPLE_HASH,
      engineBuildHash: SAMPLE_HASH,
      executionProfile: 'baseline-v1',
      sourceKind: 'module-pack',
      source: {
        modulePack: built.modulePack,
      },
    });
  });

  it('keeps graphHash stable for a golden fixture', async () => {
    const fixtureDir = createFixtureDir();
    writeFixture(fixtureDir, 'lib/value.ts', 'export const value = 5;');
    writeFixture(
      fixtureDir,
      'entry.ts',
      "import { value } from './lib/value'; export default value * 2;",
    );

    const built = await buildDeterministicModulePack({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
      builderVersion: 'golden-builder',
      dependencyIntegrity: SAMPLE_HASH,
    });

    expect(built.modulePack.graphHash).toBe(
      '191c77a4a6235a20f460887a4bdad13b09ab34bf0f841fcad68504e3e757b6b4',
    );
  });

  it('keeps dependency integrity stable across lockfile line endings', async () => {
    const lfRoot = createFixtureDir();
    const crlfRoot = createFixtureDir();
    writeFixture(lfRoot, 'pnpm-lock.yaml', 'lockfileVersion: 9.0\n');
    writeFixture(crlfRoot, 'pnpm-lock.yaml', 'lockfileVersion: 9.0\r\n');
    writeFixture(lfRoot, 'fixture/entry.ts', 'export default 1;');
    writeFixture(crlfRoot, 'fixture/entry.ts', 'export default 1;');

    const lfBuilt = await buildDeterministicModulePack({
      absWorkingDir: path.join(lfRoot, 'fixture'),
      entryPath: 'entry.ts',
    });
    const crlfBuilt = await buildDeterministicModulePack({
      absWorkingDir: path.join(crlfRoot, 'fixture'),
      entryPath: 'entry.ts',
    });

    expect(crlfBuilt.modulePack.dependencyIntegrity).toBe(
      lfBuilt.modulePack.dependencyIntegrity,
    );
    expect(crlfBuilt.modulePack.graphHash).toBe(lfBuilt.modulePack.graphHash);
  });

  it('rejects non-hex dependencyIntegrity overrides', async () => {
    const fixtureDir = createFixtureDir();
    writeFixture(fixtureDir, 'entry.ts', 'export default 1;');

    await expect(
      buildDeterministicModulePack({
        absWorkingDir: fixtureDir,
        entryPath: 'entry.ts',
        dependencyIntegrity: 'test-integrity',
      }),
    ).rejects.toThrow(
      'dependencyIntegrity must be a lowercase 64-char hex string',
    );
  });
});

function createFixtureDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'det-bundler-fixture-'));
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

function normalizePath(input: string): string {
  return input.split(path.sep).join('/');
}

const SAMPLE_HASH =
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
