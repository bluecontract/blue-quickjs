import { compareBoundaries, searchOogBoundary } from './oog-boundary.js';

describe('OOG boundary search', () => {
  it('finds exact boundary with binary search', async () => {
    const boundary = await searchOogBoundary({
      low: 1n,
      high: 200n,
      runSuccess: async (gasLimit) => gasLimit >= 77n,
    });
    expect(boundary.lastFailureGas).toBe(76n);
    expect(boundary.firstSuccessGas).toBe(77n);
  });

  it('compares boundaries', () => {
    const parity = compareBoundaries(
      { lastFailureGas: 76n, firstSuccessGas: 77n },
      { lastFailureGas: 76n, firstSuccessGas: 77n },
    );
    expect(parity.firstSuccessEqual).toBe(true);
    expect(parity.lastFailureEqual).toBe(true);
  });
});
