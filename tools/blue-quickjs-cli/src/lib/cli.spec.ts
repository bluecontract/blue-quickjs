import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HOST_V1_HASH, HOST_V2_HASH } from '@blue-quickjs/abi-manifest';
import {
  buildConsensusReportArgs,
  buildNativeArchiveArgs,
  buildNativeParityArgs,
  extractStackLocations,
  parseArgMap,
  resolveBuildAbiOptions,
  runCli,
} from './cli.js';

describe('blue-quickjs-cli argument parsing', () => {
  it('parses command and key/value options', () => {
    const parsed = parseArgMap([
      'build',
      '--entry',
      'src/main.ts',
      '--profile',
      'compat-binary-v1',
      '--allow-incompatible',
    ]);

    expect(parsed.command).toBe('build');
    expect(parsed.options.get('entry')).toBe('src/main.ts');
    expect(parsed.options.get('profile')).toBe('compat-binary-v1');
    expect(parsed.options.get('allow-incompatible')).toBe(true);
  });

  it('throws on unexpected positional options', () => {
    expect(() => parseArgMap(['run', '--artifact', 'a.json', 'extra'])).toThrow(
      /unexpected positional argument/i,
    );
  });

  it('extracts and de-duplicates stack locations', () => {
    const locations = extractStackLocations(
      'ModuleEvaluationError: Error at src/app.ts:12:4 and src/app.ts:12:4, helper ./entry.js:3:1',
    );

    expect(locations).toEqual([
      { source: 'src/app.ts', line: 12, column: 4 },
      { source: './entry.js', line: 3, column: 1 },
    ]);
  });

  it('builds consensus-report forwarded arguments', () => {
    const { options } = parseArgMap([
      'consensus-report',
      '--out-dir',
      'artifacts/custom',
      '--base-url',
      'http://127.0.0.1:4300',
      '--browser',
      'firefox',
      '--reuse-server',
    ]);

    expect(buildConsensusReportArgs(options)).toEqual([
      '--out-dir',
      'artifacts/custom',
      '--base-url',
      'http://127.0.0.1:4300',
      '--browser',
      'firefox',
      '--reuse-server',
    ]);
  });

  it('builds native-report forwarded arguments', () => {
    const { options } = parseArgMap([
      'native-report',
      '--strict',
      '--out-dir',
      'artifacts/native',
      '--gas-charge-tape-capacity',
      '512',
    ]);

    expect(buildNativeArchiveArgs(options)).toEqual([
      '--strict',
      '--out-dir',
      'artifacts/native',
      '--gas-charge-tape-capacity',
      '512',
    ]);
  });

  it('builds native-parity forwarded arguments', () => {
    const { options } = parseArgMap([
      'native-parity',
      '--out',
      'parity.json',
      '--compare',
      'baseline.json',
      '--gas-charge-tape-capacity',
      '128',
      '--assert-match',
      '--include-gas-trace',
      '--include-gas-charge-tape',
    ]);

    expect(buildNativeParityArgs(options)).toEqual([
      '--out',
      'parity.json',
      '--compare',
      'baseline.json',
      '--gas-charge-tape-capacity',
      '128',
      '--assert-match',
      '--include-gas-trace',
      '--include-gas-charge-tape',
    ]);
  });

  it('resolves Host.v1@1 to the Host.v1 manifest hash', () => {
    const { options } = parseArgMap(['build', '--entry', 'src/main.ts']);

    expect(resolveBuildAbiOptions(options)).toEqual({
      abiId: 'Host.v1',
      abiVersion: 1,
      abiManifestHash: HOST_V1_HASH,
    });
  });

  it('resolves Host.v2@2 to the Host.v2 manifest hash', () => {
    const { options } = parseArgMap([
      'build',
      '--entry',
      'src/main.ts',
      '--abi-id',
      'Host.v2',
    ]);

    expect(resolveBuildAbiOptions(options)).toEqual({
      abiId: 'Host.v2',
      abiVersion: 2,
      abiManifestHash: HOST_V2_HASH,
    });
  });

  it('rejects unsupported ABI id/version pairs', () => {
    const cases = [
      [
        'build',
        '--entry',
        'src/main.ts',
        '--abi-id',
        'Host.v2',
        '--abi-version',
        '1',
      ],
      [
        'build',
        '--entry',
        'src/main.ts',
        '--abi-id',
        'Host.v1',
        '--abi-version',
        '2',
      ],
      [
        'build',
        '--entry',
        'src/main.ts',
        '--abi-id',
        'Host.v3',
        '--abi-version',
        '3',
      ],
      ['build', '--entry', 'src/main.ts', '--abi-id', 'Host.v22'],
    ];

    for (const args of cases) {
      const { options } = parseArgMap(args);
      expect(() => resolveBuildAbiOptions(options)).toThrow(/unsupported ABI/i);
    }
  });

  it('rejects explicit ABI manifest hashes that do not match the selected ABI pair', () => {
    const { options } = parseArgMap([
      'build',
      '--entry',
      'src/main.ts',
      '--abi-id',
      'Host.v2',
      '--abi-version',
      '2',
      '--abi-manifest-hash',
      HOST_V1_HASH,
    ]);

    expect(() => resolveBuildAbiOptions(options)).toThrow(
      /abi manifest hash mismatch/i,
    );
  });

  it('fails unsupported ABI builds before writing an artifact', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected CLI error output for this negative-path test.
    });
    const tempDir = mkdtempSync(path.join(tmpdir(), 'blue-qjs-cli-'));
    const outPath = path.join(tempDir, 'unsupported-abi.program.json');
    expect(existsSync(outPath)).toBe(false);

    try {
      const exitCode = await runCli([
        'build',
        '--entry',
        'missing-entry.ts',
        '--abi-id',
        'Host.v3',
        '--abi-version',
        '3',
        '--out',
        outPath,
      ]);

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('unsupported ABI Host.v3@3'),
      );
      expect(existsSync(outPath)).toBe(false);
    } finally {
      errorSpy.mockRestore();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
