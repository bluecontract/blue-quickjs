import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
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
});

function createFixtureDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'det-bundler-fixture-'));
}

function writeFixture(dir: string, relativePath: string, contents: string): void {
  const filePath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}
