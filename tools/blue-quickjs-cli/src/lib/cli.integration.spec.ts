import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HOST_V2_HASH } from '@blue-quickjs/abi-manifest';
import { runCli } from './cli.js';

describe('blue-quickjs-cli integration behavior', () => {
  it('prints help for help and no-command invocations', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Suppress expected CLI help output.
    });

    try {
      await expect(runCli(['help'])).resolves.toBe(0);
      await expect(runCli([])).resolves.toBe(2);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    } finally {
      logSpy.mockRestore();
    }
  });

  it('returns a controlled error for unknown commands', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected CLI error output.
    });

    try {
      await expect(runCli(['unknown-command'])).resolves.toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('unknown command: unknown-command'),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('builds a Host.v2 ProgramArtifact without falling back to Host.v1', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Suppress expected CLI JSON output.
    });
    const tempDir = mkdtempSync(path.join(tmpdir(), 'blue-qjs-cli-build-'));
    const entryPath = path.join(tempDir, 'entry.js');
    const outPath = path.join(tempDir, 'program.json');
    writeFileSync(
      entryPath,
      'export default function main(input) { return input.value ?? 42; }\n',
      'utf8',
    );

    try {
      const exitCode = await runCli([
        'build',
        '--entry',
        entryPath,
        '--cwd',
        tempDir,
        '--out',
        outPath,
        '--profile',
        'compat-binary-v1',
        '--abi-id',
        'Host.v2',
        '--abi-version',
        '2',
      ]);

      expect(exitCode).toBe(0);
      const payload = JSON.parse(readFileSync(outPath, 'utf8'));
      expect(payload.programArtifact.abiId).toBe('Host.v2');
      expect(payload.programArtifact.abiVersion).toBe(2);
      expect(payload.programArtifact.abiManifestHash).toBe(HOST_V2_HASH);
      expect(payload.programArtifact.sourceKind).toBe('module-pack');
      expect(payload.modulePack.graphHash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      logSpy.mockRestore();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects unsupported ABI IDs before writing an artifact', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected CLI error output.
    });
    const tempDir = mkdtempSync(path.join(tmpdir(), 'blue-qjs-cli-bad-abi-'));
    const entryPath = path.join(tempDir, 'entry.js');
    const outPath = path.join(tempDir, 'program.json');
    writeFileSync(
      entryPath,
      'export default function main() { return 1; }\n',
      'utf8',
    );

    try {
      const exitCode = await runCli([
        'build',
        '--entry',
        entryPath,
        '--cwd',
        tempDir,
        '--out',
        outPath,
        '--abi-id',
        'Host.v22',
      ]);

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('unsupported ABI Host.v22'),
      );
      expect(existsSync(outPath)).toBe(false);
    } finally {
      errorSpy.mockRestore();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('maps raw VM errors through explain-error', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
      // Suppress expected CLI JSON output.
    });

    try {
      await expect(
        runCli([
          'explain-error',
          '--raw',
          'ERROR ModuleSpecifierNotFound: ./missing.js at ./entry.js:3:1 GAS remaining=10',
        ]),
      ).resolves.toBe(0);

      const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]));
      expect(output.kind).toBe('module-pack');
      expect(output.code).toBe('MODULE_SPECIFIER_NOT_FOUND');
      expect(output.mappedLocations).toEqual([
        { source: './entry.js', line: 3, column: 1 },
      ]);
    } finally {
      logSpy.mockRestore();
    }
  });
});
