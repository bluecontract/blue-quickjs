import { fromByteArray, toByteArray } from 'base64-js';

const payload = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
const encoded = fromByteArray(payload);
const decoded = toByteArray(encoded);
const sum = decoded.reduce((acc, value) => acc + value, 0);

export default {
  length: decoded.length,
  sum,
  first: decoded[0],
  last: decoded[decoded.length - 1],
  reencoded: encoded,
};
