import { expect, test } from '@playwright/test';
import { runRepeatability } from '../src/shared/repeatability.js';
import {
  buildCaseByFixtureId,
  runBrowserSnapshot,
  runNodeSnapshot,
} from './fixture-helpers.js';

test('stress corpus snapshot is stable across repeated node/browser runs', async ({
  page,
}) => {
  const certCase = await buildCaseByFixtureId('green-stress-corpus');

  const nodeRepeatability = await runRepeatability({
    iterations: 8,
    runSnapshot: async () => runNodeSnapshot(certCase),
  });
  const browserRepeatability = await runRepeatability({
    iterations: 8,
    runSnapshot: async () => runBrowserSnapshot(page, certCase),
  });

  expect(nodeRepeatability.driftCount).toBe(0);
  expect(browserRepeatability.driftCount).toBe(0);
  expect(browserRepeatability.baseline).toEqual(nodeRepeatability.baseline);
});
