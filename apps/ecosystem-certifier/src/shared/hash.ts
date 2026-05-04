import { createHash } from 'node:crypto';
import { encodeDv } from '@blue-quickjs/dv';
import { serializeHostTape } from '@blue-quickjs/test-harness';
import type { HostTapeRecord } from '@blue-quickjs/quickjs-runtime';

export function sha256Hex(input: Uint8Array | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return createHash('sha256').update(bytes).digest('hex');
}

export function hashDv(value: unknown): string {
  return sha256Hex(encodeDv(value));
}

export function hashTape(tape: HostTapeRecord[]): string | null {
  if (tape.length === 0) {
    return null;
  }
  return sha256Hex(serializeHostTape(tape));
}
