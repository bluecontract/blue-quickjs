import {
  BINARY_LIBRARY_FIXTURES,
  EXAMPLE_CORPUS,
} from '@blue-quickjs/test-harness';
import { expect, test } from '@playwright/test';
import { mapByName, readBrowserResults } from './fixture-utils.js';

type NamedFixtureResult = {
  name: string;
};

test('browser fixture suites cover example corpus mappings', async ({
  page,
}) => {
  const determinismResults = await readBrowserResults<NamedFixtureResult>(
    page,
    '/determinism.html',
    '__DETERMINISM_RESULTS__',
    'determinism',
  );
  const gasSampleResults = await readBrowserResults<NamedFixtureResult>(
    page,
    '/gas-samples.html',
    '__GAS_SAMPLE_RESULTS__',
    'gas sample',
  );
  const gasBoundaryResults = await readBrowserResults<NamedFixtureResult>(
    page,
    '/gas-samples.html',
    '__GAS_BOUNDARY_RESULTS__',
    'gas boundary',
  );
  const modulePackResults = await readBrowserResults<NamedFixtureResult>(
    page,
    '/module-pack-fixtures.html',
    '__MODULE_PACK_FIXTURE_RESULTS__',
    'module-pack fixture',
  );

  const suiteFixtureNames = {
    determinism: new Set(mapByName(determinismResults).keys()),
    'gas-sample': new Set(mapByName(gasSampleResults).keys()),
    'gas-boundary': new Set(mapByName(gasBoundaryResults).keys()),
    'module-pack': new Set(mapByName(modulePackResults).keys()),
    'chess-library': new Set(['chess-e2e6']),
    'binary-library': new Set(BINARY_LIBRARY_FIXTURES.map((f) => f.name)),
  } as const;

  const missingTargets: string[] = [];
  for (const example of EXAMPLE_CORPUS) {
    for (const target of example.coverage) {
      if (!suiteFixtureNames[target.suite].has(target.fixtureName)) {
        missingTargets.push(
          `${example.slug}:${target.suite}:${target.fixtureName}`,
        );
      }
    }
  }

  expect(missingTargets).toEqual([]);
});
