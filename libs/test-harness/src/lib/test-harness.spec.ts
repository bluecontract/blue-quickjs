import { testHarness } from './test-harness.js';

describe('testHarness', () => {
  it('should work', () => {
    expect(testHarness()).toEqual('test-harness');
  });
});
