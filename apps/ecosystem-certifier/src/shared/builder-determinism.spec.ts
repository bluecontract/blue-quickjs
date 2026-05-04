import { compareBuilderReports } from './builder-determinism.js';

describe('builder determinism helpers', () => {
  it('detects hash mismatches between reports', () => {
    const result = compareBuilderReports(
      {
        checks: { graphHashEqual: true, canonicalHashEqual: true },
        fixtures: [
          { graphHash: 'a', canonicalHash: 'b' },
          { graphHash: 'c', canonicalHash: 'd' },
        ],
      },
      {
        checks: { graphHashEqual: false, canonicalHashEqual: false },
        fixtures: [
          { graphHash: 'a', canonicalHash: 'x' },
          { graphHash: 'z', canonicalHash: 'd' },
        ],
      },
    );

    expect(result.graphHashMismatchCount).toBe(1);
    expect(result.canonicalHashMismatchCount).toBe(1);
  });
});
