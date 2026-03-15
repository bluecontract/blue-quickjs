import { bundleDeterministicProgram } from '@blue-quickjs/deterministic-bundler';
import { evaluate } from '@blue-quickjs/quickjs-runtime';
import {
  CHESS_E2E6_EXPECTED_LEGAL,
  CHESS_LIBRARY_ENTRY_PATH,
  CHESS_LIBRARY_GAS_LIMIT,
  CHESS_LIBRARY_INPUT,
  CHESS_LIBRARY_MANIFEST,
  CHESS_LIBRARY_PROGRAM_BASE,
  createDeterminismHost,
} from '@blue-quickjs/test-harness';
import { expect, test } from '@playwright/test';

type ChessReuseResult = {
  ok: boolean;
  value: boolean | null;
  gasUsed: string;
  gasRemaining: string;
  errorCode: string | null;
  errorTag: string | null;
};

test('browser matches node for bundled chess.js e2e6 legality', async ({
  page,
}) => {
  const bundled = await bundleDeterministicProgram({
    absWorkingDir: process.cwd(),
    entryPath: CHESS_LIBRARY_ENTRY_PATH,
    profile: 'compat-regexp-v1',
  });

  const nodeResult = await runNodeFixture(bundled.code);

  await page.addInitScript((code) => {
    (window as Window & { __CHESS_BUNDLED_CODE__?: string }).__CHESS_BUNDLED_CODE__ =
      code;
  }, bundled.code);

  await page.goto('/chess-library-reuse.html');
  await page.waitForSelector('[data-runstate="done"]', { timeout: 30000 });

  const browserResult = (await page.evaluate(() =>
    (window as Window & { __CHESS_LIBRARY_REUSE_RESULT__?: ChessReuseResult })
      .__CHESS_LIBRARY_REUSE_RESULT__,
  )) as ChessReuseResult | undefined;

  expect(browserResult).toBeTruthy();
  expect(browserResult).toEqual(nodeResult);
  expect(browserResult?.ok).toBe(true);
  expect(browserResult?.value).toBe(CHESS_E2E6_EXPECTED_LEGAL);
});

async function runNodeFixture(code: string): Promise<ChessReuseResult> {
  const host = createDeterminismHost();
  const result = await evaluate({
    program: {
      ...CHESS_LIBRARY_PROGRAM_BASE,
      code,
    },
    input: CHESS_LIBRARY_INPUT,
    gasLimit: CHESS_LIBRARY_GAS_LIMIT,
    manifest: CHESS_LIBRARY_MANIFEST,
    handlers: host.handlers,
  });

  if (result.ok) {
    return {
      ok: true,
      value: result.value as boolean,
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
