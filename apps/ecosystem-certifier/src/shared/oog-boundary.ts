export interface OogBoundary {
  lastFailureGas: bigint;
  firstSuccessGas: bigint;
}

export async function searchOogBoundary(options: {
  low: bigint;
  high: bigint;
  runSuccess: (gasLimit: bigint) => Promise<boolean>;
}): Promise<OogBoundary> {
  let left = options.low;
  let right = options.high;
  const highSuccess = await options.runSuccess(right);
  if (!highSuccess) {
    throw new Error(
      `upper gas bound ${right.toString()} did not succeed during OOG boundary search`,
    );
  }

  while (left + 1n < right) {
    const mid = (left + right) / 2n;
    const success = await options.runSuccess(mid);
    if (success) {
      right = mid;
    } else {
      left = mid;
    }
  }

  return {
    lastFailureGas: left,
    firstSuccessGas: right,
  };
}

export function compareBoundaries(
  node: OogBoundary,
  browser: OogBoundary,
): { firstSuccessEqual: boolean; lastFailureEqual: boolean } {
  return {
    firstSuccessEqual: node.firstSuccessGas === browser.firstSuccessGas,
    lastFailureEqual: node.lastFailureGas === browser.lastFailureGas,
  };
}
