import { abiManifest } from './abi-manifest.js';

describe('abiManifest', () => {
  it('should work', () => {
    expect(abiManifest()).toEqual('abi-manifest');
  });
});
