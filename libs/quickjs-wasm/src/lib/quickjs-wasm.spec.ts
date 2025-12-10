import { quickjsWasm } from './quickjs-wasm.js';

describe('quickjsWasm', () => {
  it('should work', () => {
    expect(quickjsWasm()).toEqual('quickjs-wasm');
  });
});
