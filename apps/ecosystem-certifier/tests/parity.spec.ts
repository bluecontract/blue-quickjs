import { expect, test } from '@playwright/test';
import { compareSnapshots, isStrictParity } from '../src/shared/parity.js';
import {
  buildCaseByFixtureId,
  runBrowserSnapshot,
  runNodeSnapshot,
} from './fixture-helpers.js';

test('flagship fixture preserves strict node/browser parity snapshot', async ({
  page,
}) => {
  const certCase = await buildCaseByFixtureId('flagship-knowledge-pack');
  const nodeSnapshot = await runNodeSnapshot(certCase);
  const browserSnapshot = await runBrowserSnapshot(page, certCase);
  const parity = compareSnapshots(nodeSnapshot, browserSnapshot);

  expect(isStrictParity(parity)).toBe(true);
  expect(browserSnapshot).toEqual(nodeSnapshot);
});
