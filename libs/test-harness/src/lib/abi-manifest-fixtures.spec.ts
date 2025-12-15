import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  HOST_V1_BYTES,
  HOST_V1_BYTES_HEX,
  HOST_V1_HASH,
  HOST_V1_MANIFEST,
} from './abi-manifest-fixtures.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(here, '../../fixtures/abi-manifest');

const readText = (filename: string): string =>
  readFileSync(path.join(fixturesDir, filename), 'utf8').trim();

describe('abi-manifest fixture parity', () => {
  it('matches the checked-in host-v1 files', () => {
    const fileManifest = JSON.parse(readText('host-v1.json'));
    expect(HOST_V1_MANIFEST).toEqual(fileManifest);

    const fileHex = readText('host-v1.bytes.hex');
    expect(HOST_V1_BYTES_HEX).toEqual(fileHex);

    const fileHash = readText('host-v1.hash');
    expect(HOST_V1_HASH).toEqual(fileHash);

    const fileBytes = Uint8Array.from(
      fileHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
    );
    expect(HOST_V1_BYTES).toEqual(fileBytes);
  });
});
