import { evaluate } from '@blue-quickjs/quickjs-runtime';
import { MODULE_PACK_FIXTURES } from '@blue-quickjs/test-harness';
import {
  loadQuickjsWasmBinary,
  loadQuickjsWasmMetadata,
} from '@blue-quickjs/quickjs-wasm';
import { expect, test } from '@playwright/test';
import { hashDv, hashTape } from '../src/app/hash-utils.js';
import { mapByName, readBrowserResults } from './fixture-utils.js';

type ModulePackFixtureSnapshot = {
  ok: boolean;
  valueHash: string | null;
  errorCode: string | null;
  errorTag: string | null;
  gasUsed: string;
  gasRemaining: string;
  tapeHash: string | null;
  tapeLength: number;
};

type ModulePackFixtureResult = {
  name: string;
  expectedOk: boolean;
  actual: ModulePackFixtureSnapshot;
};

test('browser module-pack fixtures match Node outputs', async ({ page }) => {
  const nodeResults = await runNodeFixtures();

  const browserResults = await readBrowserResults<ModulePackFixtureResult>(
    page,
    '/module-pack-fixtures.html',
    '__MODULE_PACK_FIXTURE_RESULTS__',
    'module-pack fixture',
  );

  const nodeByName = mapByName(nodeResults);
  const browserByName = mapByName(browserResults);

  expect(browserByName.size).toBe(nodeByName.size);

  for (const [name, node] of nodeByName) {
    const browser = browserByName.get(name);
    expect(browser, `missing browser fixture ${name}`).toBeTruthy();
    if (!browser) {
      continue;
    }

    expect(browser.expectedOk).toBe(node.expectedOk);
    expect(browser.actual).toEqual(node.actual);
  }
});

async function runNodeFixtures(): Promise<ModulePackFixtureResult[]> {
  const metadata = await loadQuickjsWasmMetadata();
  const wasmBinary = await loadQuickjsWasmBinary();
  const results: ModulePackFixtureResult[] = [];

  for (const fixture of MODULE_PACK_FIXTURES) {
    const host = fixture.createHost();
    const result = await evaluate({
      program: fixture.program,
      input: fixture.input,
      gasLimit: fixture.gasLimit,
      manifest: fixture.manifest,
      handlers: host.handlers,
      metadata,
      wasmBinary,
      tape: { capacity: 16 },
    });

    const tape = result.tape ?? [];
    const snapshot: ModulePackFixtureSnapshot = {
      ok: result.ok,
      valueHash: result.ok ? await hashDv(result.value) : null,
      errorCode: result.ok ? null : result.error.code,
      errorTag: result.ok
        ? null
        : 'tag' in result.error
          ? result.error.tag
          : null,
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
      tapeHash: await hashTape(tape),
      tapeLength: tape.length,
    };

    results.push({
      name: fixture.name,
      expectedOk: fixture.expected.ok,
      actual: snapshot,
    });
  }

  return results;
}
