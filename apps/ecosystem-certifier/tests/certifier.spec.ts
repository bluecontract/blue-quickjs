import { HOST_V1_HASH, HOST_V1_MANIFEST } from '@blue-quickjs/abi-manifest';
import { expect, test } from '@playwright/test';
import type {
  BrowserEvaluationCase,
  FixtureParityRecord,
} from '../src/shared/types.js';

test('browser certifier executes injected evaluation cases', async ({
  page,
}) => {
  const cases: BrowserEvaluationCase[] = [
    {
      id: 'sample-script-case',
      title: 'sample script',
      kind: 'positive',
      gasLimit: '100000',
      manifest: HOST_V1_MANIFEST,
      program: {
        version: 2,
        abiId: 'Host.v1',
        abiVersion: 1,
        abiManifestHash: HOST_V1_HASH,
        executionProfile: 'baseline-v1',
        sourceKind: 'script',
        source: {
          code: '42',
        },
      },
    },
  ];

  await page.addInitScript((payload) => {
    window.__ECOSYSTEM_CERT_CASES__ = payload;
  }, cases);

  await page.goto('/');
  await page.waitForSelector('[data-runstate="done"]', { timeout: 60000 });

  const results = await page.evaluate<FixtureParityRecord[]>(
    () => window.__ECOSYSTEM_CERT_RESULTS__ ?? [],
  );
  expect(results).toHaveLength(1);
  const [firstResult] = results;
  if (!firstResult) {
    throw new Error('expected one browser certifier result');
  }
  expect(firstResult.id).toBe('sample-script-case');
  expect(firstResult.browser?.stage).toBe('success');
  expect(firstResult.browser?.errorCode).toBeNull();
});
