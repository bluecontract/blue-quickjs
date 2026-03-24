import type { FixtureSnapshot } from './types.js';

export interface SnapshotParity {
  stageEqual: boolean;
  resultHashEqual: boolean;
  errorCodeEqual: boolean;
  errorTagEqual: boolean;
  gasUsedEqual: boolean;
  gasRemainingEqual: boolean;
  tapeHashEqual: boolean;
  tapeLengthEqual: boolean;
}

export function compareSnapshots(
  node: FixtureSnapshot,
  browser: FixtureSnapshot | null,
): SnapshotParity {
  if (!browser) {
    return {
      stageEqual: false,
      resultHashEqual: false,
      errorCodeEqual: false,
      errorTagEqual: false,
      gasUsedEqual: false,
      gasRemainingEqual: false,
      tapeHashEqual: false,
      tapeLengthEqual: false,
    };
  }

  return {
    stageEqual: node.stage === browser.stage,
    resultHashEqual: node.resultHash === browser.resultHash,
    errorCodeEqual: node.errorCode === browser.errorCode,
    errorTagEqual: node.errorTag === browser.errorTag,
    gasUsedEqual: node.gasUsed === browser.gasUsed,
    gasRemainingEqual: node.gasRemaining === browser.gasRemaining,
    tapeHashEqual: node.tapeHash === browser.tapeHash,
    tapeLengthEqual: node.tapeLength === browser.tapeLength,
  };
}

export function isStrictParity(parity: SnapshotParity): boolean {
  return (
    parity.stageEqual &&
    parity.resultHashEqual &&
    parity.errorCodeEqual &&
    parity.errorTagEqual &&
    parity.gasUsedEqual &&
    parity.gasRemainingEqual &&
    parity.tapeHashEqual &&
    parity.tapeLengthEqual
  );
}
