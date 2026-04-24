import { bundleDeterministicProgram } from '@blue-quickjs/deterministic-bundler';
import path from 'node:path';
import {
  CHESS_E2E6_EXPECTED_LEGAL,
  CHESS_LIBRARY_ENTRY_PATH,
  CHESS_LIBRARY_GAS_LIMIT,
  CHESS_LIBRARY_INPUT,
  CHESS_LIBRARY_MANIFEST,
  CHESS_LIBRARY_PROGRAM_BASE,
  createDeterminismHost,
} from '@blue-quickjs/test-harness';
import { evaluate } from '../lib/evaluate.js';

describe('library reuse: chess.js', () => {
  it('bundles chess fixture deterministically and evaluates legality for e2e6', async () => {
    const workspaceRoot = path.resolve(process.cwd(), '../..');
    const bundled = await bundleDeterministicProgram({
      absWorkingDir: workspaceRoot,
      entryPath: CHESS_LIBRARY_ENTRY_PATH,
      profile: 'compat-general-v1',
    });

    const run = async () => {
      const host = createDeterminismHost();
      const result = await evaluate({
        program: {
          ...CHESS_LIBRARY_PROGRAM_BASE,
          code: bundled.code,
        },
        input: CHESS_LIBRARY_INPUT,
        gasLimit: CHESS_LIBRARY_GAS_LIMIT,
        manifest: CHESS_LIBRARY_MANIFEST,
        handlers: host.handlers,
      });

      return result;
    };

    const first = await run();
    const second = await run();

    if (!first.ok || !second.ok) {
      const describe = (result: typeof first) =>
        result.ok
          ? 'ok'
          : `${result.type}:${result.error.code}:${result.message}`;
      throw new Error(
        `expected chess fixture runs to succeed: first=${describe(first)} second=${describe(second)}`,
      );
    }

    expect(first.value).toBe(CHESS_E2E6_EXPECTED_LEGAL);
    expect(second.value).toBe(CHESS_E2E6_EXPECTED_LEGAL);
    expect(first.gasUsed).toBe(second.gasUsed);
    expect(first.gasRemaining).toBe(second.gasRemaining);
  });
});
