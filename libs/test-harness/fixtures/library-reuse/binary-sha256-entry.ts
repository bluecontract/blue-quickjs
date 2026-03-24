import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

const digest = sha256(
  Uint8Array.from([
    98, 108, 117, 101, 45, 113, 117, 105, 99, 107, 106, 115, 45, 98, 105, 110,
    97, 114, 121, 45, 102, 105, 120, 116, 117, 114, 101,
  ]),
);

export default {
  hex: bytesToHex(digest),
  length: digest.length,
  first: digest[0],
  last: digest[digest.length - 1],
};
