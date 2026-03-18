export interface BuilderDeterminismFixture {
  graphHash: string;
  canonicalHash: string;
}

export interface BuilderDeterminismReport {
  checks: {
    graphHashEqual: boolean;
    canonicalHashEqual: boolean;
  };
  fixtures: BuilderDeterminismFixture[];
}

export function compareBuilderReports(
  baseline: BuilderDeterminismReport,
  candidate: BuilderDeterminismReport,
): { graphHashMismatchCount: number; canonicalHashMismatchCount: number } {
  let graphHashMismatchCount = 0;
  let canonicalHashMismatchCount = 0;

  const fixtureCount = Math.min(
    baseline.fixtures.length,
    candidate.fixtures.length,
  );
  for (let index = 0; index < fixtureCount; index += 1) {
    if (
      baseline.fixtures[index].graphHash !== candidate.fixtures[index].graphHash
    ) {
      graphHashMismatchCount += 1;
    }
    if (
      baseline.fixtures[index].canonicalHash !==
      candidate.fixtures[index].canonicalHash
    ) {
      canonicalHashMismatchCount += 1;
    }
  }

  return {
    graphHashMismatchCount,
    canonicalHashMismatchCount,
  };
}
