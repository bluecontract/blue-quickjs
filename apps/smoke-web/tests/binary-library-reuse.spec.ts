import { bundleDeterministicProgram } from '@blue-quickjs/deterministic-bundler';
import { evaluate } from '@blue-quickjs/quickjs-runtime';
import {
  BINARY_LIBRARY_FIXTURES,
  BINARY_LIBRARY_GAS_LIMIT,
  BINARY_LIBRARY_INPUT,
  BINARY_LIBRARY_MANIFEST,
  BINARY_LIBRARY_PROGRAM_BASE,
  createDeterminismHost,
} from '@blue-quickjs/test-harness';
import { expect, test } from '@playwright/test';

type BinaryReuseResult = {
  ok: boolean;
  value: Record<string, number | string> | null;
  gasUsed: string;
  gasRemaining: string;
  errorCode: string | null;
  errorTag: string | null;
};

for (const fixture of BINARY_LIBRARY_FIXTURES) {
  test(`browser matches node for ${fixture.name}`, async ({ page }) => {
    const bundled = await bundleDeterministicProgram({
      absWorkingDir: process.cwd(),
      entryPath: fixture.entryPath,
      profile: 'compat-binary-v1',
    });

    const nodeResult = await runNodeFixture(bundled.code);

    await page.addInitScript((code) => {
      (
        window as Window & { __BINARY_BUNDLED_CODE__?: string }
      ).__BINARY_BUNDLED_CODE__ = code;
    }, bundled.code);

    await page.goto('/binary-library-reuse.html');
    await page.waitForSelector('[data-runstate="done"]', { timeout: 30000 });

    const browserResult = (await page.evaluate(
      () =>
        (
          window as Window & {
            __BINARY_LIBRARY_REUSE_RESULT__?: BinaryReuseResult;
          }
        ).__BINARY_LIBRARY_REUSE_RESULT__,
    )) as BinaryReuseResult | undefined;

    expect(browserResult).toBeTruthy();
    expect(browserResult).toEqual(nodeResult);
    expect(browserResult?.ok).toBe(true);
    expect(browserResult?.value).toEqual(fixture.expectedValue);
  });
}

async function runNodeFixture(code: string): Promise<BinaryReuseResult> {
  const host = createDeterminismHost();
  const result = await evaluate({
    program: {
      ...BINARY_LIBRARY_PROGRAM_BASE,
      code,
    },
    input: BINARY_LIBRARY_INPUT,
    gasLimit: BINARY_LIBRARY_GAS_LIMIT,
    manifest: BINARY_LIBRARY_MANIFEST,
    handlers: host.handlers,
  });

  if (result.ok) {
    return {
      ok: true,
      value: result.value as Record<string, number | string>,
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
      errorCode: null,
      errorTag: null,
    };
  }

  return {
    ok: false,
    value: null,
    gasUsed: result.gasUsed.toString(),
    gasRemaining: result.gasRemaining.toString(),
    errorCode: result.error.code,
    errorTag: 'tag' in result.error ? result.error.tag : null,
  };
}
