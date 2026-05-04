import type { FixtureSnapshot } from './types.js';
import { runRepeatability } from './repeatability.js';

describe('repeatability helper', () => {
  it('reports zero drift for stable snapshots', async () => {
    const snapshot: FixtureSnapshot = {
      stage: 'success',
      resultHash: 'stable',
      errorCode: null,
      errorTag: null,
      gasUsed: '10',
      gasRemaining: '90',
      tapeHash: null,
      tapeLength: 0,
    };
    const result = await runRepeatability({
      iterations: 5,
      runSnapshot: async () => ({ ...snapshot }),
    });
    expect(result.driftCount).toBe(0);
    expect(result.totalRuns).toBe(5);
  });
});
