import type { FixtureSnapshot } from './types.js';

export interface RepeatabilityResult {
  baseline: FixtureSnapshot;
  driftCount: number;
  totalRuns: number;
}

export async function runRepeatability(options: {
  iterations: number;
  runSnapshot: () => Promise<FixtureSnapshot>;
}): Promise<RepeatabilityResult> {
  if (options.iterations < 1) {
    throw new Error('repeatability iterations must be >= 1');
  }

  const baseline = await options.runSnapshot();
  let driftCount = 0;
  const baselineJson = JSON.stringify(baseline);

  for (let index = 1; index < options.iterations; index += 1) {
    const snapshot = await options.runSnapshot();
    if (JSON.stringify(snapshot) !== baselineJson) {
      driftCount += 1;
    }
  }

  return {
    baseline,
    driftCount,
    totalRuns: options.iterations,
  };
}
