import { plusOne } from './lib.js';

export default Promise.resolve(plusOne(41)).then((value) => {
  Host.v1.emit({ phase: 'async-lib', value });
  return value;
});
