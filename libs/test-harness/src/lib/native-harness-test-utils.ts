import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  HOST_V1_BYTES_HEX,
  HOST_V1_HASH,
  HOST_V2_BYTES_HEX,
  HOST_V2_HASH,
} from './abi-manifest-fixtures.js';
import { serializeHostTape, type SmokeTapeRecord } from './smoke-fixtures.js';

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

export const nativeHarnessPath = path.join(
  repoRoot,
  'tools',
  'quickjs-native-harness',
  'dist',
  'quickjs-native-harness',
);

export const nativeHarnessFixturesRoot = path.join(
  repoRoot,
  'tools',
  'quickjs-native-harness',
  'fixtures',
);

export const hostManifestArgs = [
  '--abi-manifest-hex',
  HOST_V1_BYTES_HEX,
  '--abi-manifest-hash',
  HOST_V1_HASH,
] as const;

export const hostV2ManifestArgs = [
  '--abi-manifest-hex',
  HOST_V2_BYTES_HEX,
  '--abi-manifest-hash',
  HOST_V2_HASH,
] as const;

export interface NativeHarnessRunResult {
  stdout: string;
  stderr: string;
  status: number;
}

export interface NativeParitySnapshot {
  ok: boolean;
  valueHash: string | null;
  errorCode: string | null;
  errorTag: string | null;
  gasUsed: string;
  gasRemaining: string;
  tapeHash: string | null;
  tapeLength: number;
}

export function hasBuiltNativeHarness(): boolean {
  return existsSync(nativeHarnessPath);
}

export function runNativeHarness(
  args: string[],
  options?: { includeManifest?: boolean },
): NativeHarnessRunResult {
  const result = spawnSync(
    nativeHarnessPath,
    [
      ...(options?.includeManifest === false ? [] : hostManifestArgs),
      ...args,
    ],
    {
      encoding: 'utf8',
    },
  );

  if (result.error) {
    throw result.error;
  }

  return {
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
    status: result.status ?? 0,
  };
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hashTape(
  tape: SmokeTapeRecord[] | null | undefined,
): string | null {
  if (!Array.isArray(tape) || tape.length === 0) {
    return null;
  }

  return sha256Hex(Buffer.from(serializeHostTape(tape)));
}

export function normalizeNativeTape(tape: unknown): SmokeTapeRecord[] {
  if (!Array.isArray(tape)) {
    throw new Error(`native tape must be an array: ${JSON.stringify(tape)}`);
  }

  return tape.map((record) => {
    const entry = record as Record<string, unknown>;
    return {
      fnId: Number(entry.fnId),
      reqLen: Number(entry.reqLen),
      respLen: Number(entry.respLen),
      units: Number(entry.units),
      gasPre: BigInt(entry.gasPre as string | number | bigint),
      gasPost: BigInt(entry.gasPost as string | number | bigint),
      isError: Boolean(entry.isError),
      chargeFailed: Boolean(entry.chargeFailed),
      reqHash: String(entry.reqHash),
      respHash: String(entry.respHash),
    } satisfies SmokeTapeRecord;
  });
}

export function parseNativeParityOutput(
  stdout: string,
  options?: {
    valueToHash?: (value: unknown) => string;
    mapErrorCode?: (message: string) => string | null;
  },
): NativeParitySnapshot {
  const gasMatch = stdout.match(/ GAS remaining=(\d+)(?: used=(\d+))?/);
  if (!gasMatch || gasMatch.index == null) {
    throw new Error(`missing gas suffix in native output: ${stdout}`);
  }

  const tapeMarker = ' TAPE ';
  const tapeIndex = stdout.lastIndexOf(tapeMarker);
  if (tapeIndex < 0) {
    throw new Error(`missing tape suffix in native output: ${stdout}`);
  }

  const gasStart = gasMatch.index;
  const gasRemaining = gasMatch[1];
  const gasUsed = gasMatch[2] ?? '0';
  const tapeJson = stdout.slice(tapeIndex + tapeMarker.length).trim();
  const tape = normalizeNativeTape(JSON.parse(tapeJson));

  if (stdout.startsWith('RESULT ')) {
    const valueJson = stdout.slice('RESULT '.length, gasStart);
    const value = JSON.parse(valueJson);
    return {
      ok: true,
      valueHash: options?.valueToHash ? options.valueToHash(value) : null,
      errorCode: null,
      errorTag: null,
      gasUsed,
      gasRemaining,
      tapeHash: hashTape(tape),
      tapeLength: tape.length,
    };
  }

  if (stdout.startsWith('ERROR ')) {
    const message = stdout.slice('ERROR '.length, gasStart);
    const errorCode = options?.mapErrorCode?.(message) ?? message;
    return {
      ok: false,
      valueHash: null,
      errorCode,
      errorTag: errorCode === message ? null : 'vm/module_pack',
      gasUsed,
      gasRemaining,
      tapeHash: hashTape(tape),
      tapeLength: tape.length,
    };
  }

  throw new Error(`unexpected native output prefix: ${stdout}`);
}
