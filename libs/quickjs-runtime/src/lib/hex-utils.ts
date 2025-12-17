/**
 * Parse a lowercase hex string into a byte array with optional max-length enforcement.
 */
export function parseHexToBytes(
  payload: string,
  maxBytes?: number,
): Uint8Array {
  const normalized = payload.trim();
  if (normalized.length === 0) {
    throw new Error('payload is empty');
  }
  if (normalized.length % 2 !== 0) {
    throw new Error('payload length is not even');
  }
  if (!/^[0-9a-f]+$/.test(normalized)) {
    throw new Error('payload is not lowercase hex');
  }

  const byteLength = normalized.length / 2;
  if (maxBytes !== undefined && byteLength > maxBytes) {
    throw new Error(`payload exceeds maxBytes (${byteLength} > ${maxBytes})`);
  }

  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}
