import type { FixtureSnapshot } from './types.js';
import { compareSnapshots, isStrictParity } from './parity.js';

describe('parity helpers', () => {
  const snapshot: FixtureSnapshot = {
    stage: 'success',
    resultHash: 'abc',
    errorCode: null,
    errorTag: null,
    gasUsed: '10',
    gasRemaining: '90',
    tapeHash: 'def',
    tapeLength: 1,
  };

  it('returns strict parity for equal snapshots', () => {
    const parity = compareSnapshots(snapshot, { ...snapshot });
    expect(isStrictParity(parity)).toBe(true);
  });

  it('returns parity mismatch for different gas', () => {
    const parity = compareSnapshots(snapshot, {
      ...snapshot,
      gasUsed: '11',
      gasRemaining: '89',
    });
    expect(isStrictParity(parity)).toBe(false);
    expect(parity.gasUsedEqual).toBe(false);
  });
});
