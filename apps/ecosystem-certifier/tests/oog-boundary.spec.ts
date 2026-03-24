import { expect, test } from '@playwright/test';
import {
  compareBoundaries,
  searchOogBoundary,
} from '../src/shared/oog-boundary.js';
import {
  buildCaseByFixtureId,
  runBrowserSnapshot,
  runNodeSnapshot,
} from './fixture-helpers.js';

test('node and browser share exact OOG boundary for semver fixture', async ({
  page,
}) => {
  const certCase = await buildCaseByFixtureId('green-semver');
  const maxGas = BigInt(certCase.gasLimit);

  const nodeBoundary = await searchOogBoundary({
    low: 1n,
    high: maxGas,
    runSuccess: async (gasLimit) => {
      const snapshot = await runNodeSnapshot(certCase, gasLimit.toString());
      return snapshot.stage === 'success';
    },
  });
  const browserBoundary = await searchOogBoundary({
    low: 1n,
    high: maxGas,
    runSuccess: async (gasLimit) => {
      const snapshot = await runBrowserSnapshot(page, certCase, gasLimit.toString());
      return snapshot.stage === 'success';
    },
  });

  const parity = compareBoundaries(nodeBoundary, browserBoundary);
  expect(parity.firstSuccessEqual).toBe(true);
  expect(parity.lastFailureEqual).toBe(true);
});
