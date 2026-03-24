import {
  GAS_SAMPLE_FIXTURES,
  type GasFixture,
} from '@blue-quickjs/test-harness';
import { evaluate, type EvaluateResult } from '@blue-quickjs/quickjs-runtime';
import {
  loadQuickjsWasmBinary,
  loadQuickjsWasmMetadata,
} from '@blue-quickjs/quickjs-wasm';
import { expect, test } from '@playwright/test';
import { mapByName, readBrowserResults } from './fixture-utils.js';

type BoundaryFixtureResult = {
  name: string;
  firstSuccessGas: string;
  lastFailureGas: string;
  successGasUsed: string;
  successGasRemaining: string;
  failureGasUsed: string;
  failureGasRemaining: string;
  failureCode: string | null;
  failureTag: string | null;
};

const GAS_BOUNDARY_FIXTURE_NAMES = new Set([
  'return-1',
  'loop-1k',
  'loop-10k',
  'string-concat',
  'object-alloc',
  'array-ops',
]);

test('browser and node share exact OOG boundaries', async ({ page }) => {
  const nodeResults = await runNodeBoundaries();
  const browserResults = await readBrowserResults<BoundaryFixtureResult>(
    page,
    '/gas-samples.html',
    '__GAS_BOUNDARY_RESULTS__',
    'gas boundary',
  );

  const nodeByName = mapByName(nodeResults);
  const browserByName = mapByName(browserResults);
  expect(browserByName.size).toBe(nodeByName.size);

  for (const [name, node] of nodeByName) {
    const browser = browserByName.get(name);
    expect(browser, `missing browser boundary fixture ${name}`).toBeTruthy();
    if (!browser) {
      continue;
    }
    expect(browser).toEqual(node);
  }
});

async function runNodeBoundaries(): Promise<BoundaryFixtureResult[]> {
  const metadata = await loadQuickjsWasmMetadata();
  const wasmBinary = await loadQuickjsWasmBinary();
  const selected = GAS_SAMPLE_FIXTURES.filter((fixture) =>
    GAS_BOUNDARY_FIXTURE_NAMES.has(fixture.name),
  );

  const results: BoundaryFixtureResult[] = [];
  for (const fixture of selected) {
    results.push(await findOutOfGasBoundary(fixture, metadata, wasmBinary));
  }
  return results;
}

async function findOutOfGasBoundary(
  fixture: GasFixture,
  metadata: Awaited<ReturnType<typeof loadQuickjsWasmMetadata>>,
  wasmBinary: Uint8Array,
): Promise<BoundaryFixtureResult> {
  let upperGas = fixture.expected.gasUsed;
  let upper = await runFixtureAtGasLimit(
    fixture,
    upperGas,
    metadata,
    wasmBinary,
  );
  while (!upper.ok) {
    upperGas *= 2n;
    upper = await runFixtureAtGasLimit(fixture, upperGas, metadata, wasmBinary);
  }

  let lowerGas = 0n;
  let lower = await runFixtureAtGasLimit(
    fixture,
    lowerGas,
    metadata,
    wasmBinary,
  );
  while (lowerGas + 1n < upperGas) {
    const mid = (lowerGas + upperGas) >> 1n;
    const current = await runFixtureAtGasLimit(
      fixture,
      mid,
      metadata,
      wasmBinary,
    );
    if (current.ok) {
      upperGas = mid;
      upper = current;
    } else {
      lowerGas = mid;
      lower = current;
    }
  }

  if (!upper.ok) {
    throw new Error(
      `boundary search failed for ${fixture.name}: no successful gas limit found`,
    );
  }
  if (lower.ok) {
    throw new Error(
      `boundary search failed for ${fixture.name}: expected failing gas limit`,
    );
  }

  return {
    name: fixture.name,
    firstSuccessGas: upperGas.toString(),
    lastFailureGas: lowerGas.toString(),
    successGasUsed: upper.gasUsed.toString(),
    successGasRemaining: upper.gasRemaining.toString(),
    failureGasUsed: lower.gasUsed.toString(),
    failureGasRemaining: lower.gasRemaining.toString(),
    failureCode: lower.error.code,
    failureTag: 'tag' in lower.error ? lower.error.tag : null,
  };
}

async function runFixtureAtGasLimit(
  fixture: GasFixture,
  gasLimit: bigint,
  metadata: Awaited<ReturnType<typeof loadQuickjsWasmMetadata>>,
  wasmBinary: Uint8Array,
): Promise<EvaluateResult> {
  const host = fixture.createHost();
  return evaluate({
    program: fixture.program,
    input: fixture.input,
    gasLimit,
    manifest: fixture.manifest,
    handlers: host.handlers,
    metadata,
    wasmBinary,
  });
}
