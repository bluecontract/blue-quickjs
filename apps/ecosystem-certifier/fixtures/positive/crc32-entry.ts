import CRC32 from 'crc-32';

const value = Host.v1.document.get('text/markdown-case');
const checksum = (CRC32.str(value) >>> 0).toString(16).padStart(8, '0');

export default {
  checksum,
  length: value.length,
};
