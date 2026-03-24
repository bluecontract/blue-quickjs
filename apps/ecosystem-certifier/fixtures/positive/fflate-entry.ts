import { strToU8, zlibSync, unzlibSync } from 'fflate';

const text = Host.v1.document.get('text/markdown-case');
const compressed = zlibSync(strToU8(text));
const roundTrip = unzlibSync(compressed);

export default {
  compressedLength: compressed.length,
  restoredLength: roundTrip.length,
};
