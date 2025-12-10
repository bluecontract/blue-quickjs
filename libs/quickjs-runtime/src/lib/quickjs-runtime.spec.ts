import { quickjsRuntime } from './quickjs-runtime.js';

describe('quickjsRuntime', () => {
  it('should work', () => {
    expect(quickjsRuntime()).toEqual('quickjs-runtime');
  });
});
