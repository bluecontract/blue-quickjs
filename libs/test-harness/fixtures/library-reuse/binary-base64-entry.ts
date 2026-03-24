import { fromByteArray, toByteArray } from 'base64-js';

const bytes = toByteArray('AQIDBAUGBwg=');
const sum = bytes.reduce((acc, value) => acc + value, 0);

export default {
  length: bytes.length,
  sum,
  first: bytes[0],
  last: bytes[bytes.length - 1],
  reencoded: fromByteArray(bytes),
};
