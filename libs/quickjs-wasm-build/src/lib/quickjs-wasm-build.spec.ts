import { quickjsWasmBuild } from './quickjs-wasm-build.js';

describe('quickjsWasmBuild', () => {
  it('should work', () => {
    expect(quickjsWasmBuild()).toEqual('quickjs-wasm-build');
  });
});
