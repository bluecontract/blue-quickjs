import { smokeNode } from './smoke-node.js';

describe('smokeNode', () => {
  it('should work', () => {
    expect(smokeNode()).toEqual('smoke-node');
  });
});
