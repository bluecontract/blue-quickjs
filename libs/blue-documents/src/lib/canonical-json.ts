import { createHash } from 'node:crypto';

const UTF8_ENCODER = new TextEncoder();

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.entries(record)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => compareUtf8ByteOrder(left, right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(',')}}`;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function canonicalSha256(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function normalizeSourceText(source: string): string {
  return source.replace(/\r\n?/g, '\n');
}

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
