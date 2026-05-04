import { expect, test } from '@playwright/test';
import {
  DeterministicBuilderError,
  buildDeterministicModulePack,
} from '@blue-quickjs/deterministic-builder';
import { HOST_V1_HASH } from '@blue-quickjs/abi-manifest';
import {
  buildCaseByFixtureId,
  getFixtureById,
  runBrowserSnapshot,
  runNodeSnapshot,
} from './fixture-helpers.js';

test('function-constructor fixture fails deterministically in both environments', async ({
  page,
}) => {
  const certCase = await buildCaseByFixtureId('red-function-constructor');
  const nodeSnapshot = await runNodeSnapshot(certCase);
  const browserSnapshot = await runBrowserSnapshot(page, certCase);

  expect(nodeSnapshot.stage).toBe('artifact_validation');
  expect(nodeSnapshot.errorCode).toBe('MODULE_EXPORT_MISSING');
  expect(nodeSnapshot.errorTag).toBe('vm/module_pack');
  expect(browserSnapshot).toEqual(nodeSnapshot);
});

test('proxy fixture is rejected at build stage with deterministic rule', async () => {
  const fixture = getFixtureById('red-proxy');
  let thrown: unknown = null;
  try {
    await buildDeterministicModulePack({
      absWorkingDir: process.cwd(),
      entryPath: fixture.entryPath,
      profile: fixture.profile,
      emitProgramArtifact: true,
      abiId: 'Host.v1',
      abiVersion: 1,
      abiManifestHash: HOST_V1_HASH,
    });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DeterministicBuilderError);
  if (thrown instanceof DeterministicBuilderError) {
    expect(
      thrown.diagnostics.some((entry) => entry.ruleId === 'proxy_disabled'),
    ).toBe(true);
  }
});
