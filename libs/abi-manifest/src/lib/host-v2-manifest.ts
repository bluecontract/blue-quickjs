import { bytesToHex } from '@noble/hashes/utils';
import type { AbiManifest } from './abi-manifest.js';
import { hashAbiManifest } from './abi-manifest.js';
import { HOST_V1_MANIFEST } from './host-v1-manifest.js';

export const HOST_V2_MANIFEST: AbiManifest = {
  ...HOST_V1_MANIFEST,
  abi_id: 'Host.v2',
  abi_version: 2,
};

const HOST_V2_CANONICAL = hashAbiManifest(HOST_V2_MANIFEST);

export const HOST_V2_BYTES = HOST_V2_CANONICAL.bytes;
export const HOST_V2_HASH = HOST_V2_CANONICAL.hash;
export const HOST_V2_BYTES_HEX = bytesToHex(HOST_V2_BYTES);
