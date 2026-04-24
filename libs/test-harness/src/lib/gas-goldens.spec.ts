import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

const harnessRoot = path.join(repoRoot, 'tools', 'quickjs-native-harness');
const fixturesRoot = path.join(harnessRoot, 'fixtures');
const binPath = path.join(harnessRoot, 'dist', 'quickjs-native-harness');
const goldensPath = path.join(
  repoRoot,
  'libs',
  'test-harness',
  'fixtures',
  'gas-goldens.json',
);
const manifestHex = readFileSync(
  path.join(
    repoRoot,
    'libs',
    'test-harness',
    'fixtures',
    'abi-manifest',
    'host-v1.bytes.hex',
  ),
  'utf8',
).replace(/[\r\n\s]+/g, '');
const manifestHash = readFileSync(
  path.join(
    repoRoot,
    'libs',
    'test-harness',
    'fixtures',
    'abi-manifest',
    'host-v1.hash',
  ),
  'utf8',
).trim();

interface GasGoldenCase {
  name: string;
  fixture: string;
  args?: string[];
  expected: string;
}

interface ParsedHarnessOutput {
  kind: 'RESULT' | 'ERROR';
  payload: string;
  gasRemaining: bigint;
  gasUsed: bigint;
  state?: string;
  trace?: unknown;
}

const cases = JSON.parse(
  readFileSync(goldensPath, 'utf8'),
) as GasGoldenCase[];

describe('gas goldens', () => {
  it('has a built native harness available', () => {
    expect(existsSync(binPath)).toBe(true);
  });

  test.each(cases)('$name', ({ fixture, args = [], expected }) => {
    const code = readFileSync(path.join(fixturesRoot, fixture), 'utf8');
    const result = spawnSync(
      binPath,
      [
        '--abi-manifest-hex',
        manifestHex,
        '--abi-manifest-hash',
        manifestHash,
        ...args,
        '--eval',
        code,
      ],
      { encoding: 'utf8' },
    );

    if (result.error) {
      throw result.error;
    }

    const actual = (result.stdout || '').trim();
    expect(parseHarnessOutput(actual)).toEqual(parseHarnessOutput(expected));
  });
});

function parseHarnessOutput(raw: string): ParsedHarnessOutput {
  const trimmed = raw.trim();
  const match =
    /^(RESULT|ERROR)\s+(.+?)\s+GAS\s+remaining=(\d+)\s+used=(\d+)(?:\s+STATE\s+(.+?))?(?:\s+TRACE\s+(\{.+\}))?$/.exec(
      trimmed,
    );

  if (!match) {
    throw new Error(`Unable to parse harness output: ${trimmed}`);
  }

  const [, kind, payload, remaining, used, state, trace] = match;
  return {
    kind: kind as 'RESULT' | 'ERROR',
    payload,
    gasRemaining: BigInt(remaining),
    gasUsed: BigInt(used),
    ...(state !== undefined ? { state } : {}),
    ...(trace !== undefined ? { trace: JSON.parse(trace) } : {}),
  };
}
