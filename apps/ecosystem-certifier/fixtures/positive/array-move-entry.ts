import { arrayMoveImmutable } from 'array-move';

const values = ['wasm-node', 'chromium', 'firefox', 'webk-it'];
const reordered = arrayMoveImmutable(values, 3, 1);

export default {
  reordered,
  original: values,
};
