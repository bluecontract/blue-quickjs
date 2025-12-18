import { encodeDv } from '@blue-quickjs/dv';
import { serializeHostTape } from '@blue-quickjs/test-harness';
import type { HostTapeRecord } from '@blue-quickjs/quickjs-runtime';

const TEXT_ENCODER = new TextEncoder();

export async function hashDv(value: unknown): Promise<string> {
  const encoded = encodeDv(value);
  return sha256Hex(encoded);
}

export async function hashTape(tape: HostTapeRecord[]): Promise<string | null> {
  if (tape.length === 0) {
    return null;
  }
  return sha256Hex(serializeHostTape(tape));
}

export async function sha256Hex(input: Uint8Array | string): Promise<string> {
  const bytes = typeof input === 'string' ? TEXT_ENCODER.encode(input) : input;
  if (!globalThis.crypto?.subtle) {
    throw new Error('crypto.subtle is not available for hashing');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return bufferToHex(new Uint8Array(digest));
}

function bufferToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}
