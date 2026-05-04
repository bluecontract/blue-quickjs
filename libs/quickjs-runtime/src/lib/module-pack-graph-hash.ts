import type { ModulePackV1, ModulePackV1Module } from './quickjs-runtime.js';

export type ModulePackGraphHashInput = Omit<ModulePackV1, 'graphHash'> & {
  readonly graphHash?: string;
};

export async function computeModulePackGraphHash(
  pack: ModulePackV1 | Omit<ModulePackV1, 'graphHash'>,
): Promise<string> {
  const canonical = {
    version: pack.version,
    entrySpecifier: pack.entrySpecifier,
    entryExport: pack.entryExport ?? 'default',
    modules: [...pack.modules]
      .sort((left, right) =>
        compareUtf8ByteOrder(left.specifier, right.specifier),
      )
      .map((module) => canonicalizeModuleForGraphHash(module)),
    builderVersion: pack.builderVersion,
    dependencyIntegrity: pack.dependencyIntegrity,
  };
  return sha256HexUtf8(stableStringify(canonical));
}

export function canonicalizeModuleForGraphHash(
  module: ModulePackV1Module,
): Pick<ModulePackV1Module, 'specifier' | 'source' | 'sourceMap'> {
  return {
    specifier: module.specifier,
    source: module.source,
    ...(module.sourceMap ? { sourceMap: module.sourceMap } : {}),
  };
}

export async function sha256HexUtf8(input: string): Promise<string> {
  const payload = new TextEncoder().encode(input);
  const subtle = getSubtleCrypto();
  if (subtle) {
    const digest = await subtle.digest('SHA-256', payload);
    return bytesToHex(new Uint8Array(digest));
  }

  try {
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(input, 'utf8').digest('hex');
  } catch (error) {
    throw new Error(
      `MODULE_PACK_HASH_MISMATCH: no SHA-256 implementation is available for graph hash verification: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function stableStringify(value: unknown): string {
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

export function compareUtf8ByteOrder(left: string, right: string): number {
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

type SubtleDigestApi = {
  digest(
    algorithm: string,
    data: ArrayBuffer | ArrayBufferView,
  ): Promise<ArrayBuffer>;
};

function getSubtleCrypto(): SubtleDigestApi | null {
  const subtle =
    globalThis.crypto && 'subtle' in globalThis.crypto
      ? globalThis.crypto.subtle
      : null;
  return subtle;
}
