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
import { evaluate } from '@blue-quickjs/quickjs-runtime';

describe('smoke-node chess.js reuse', () => {
  it('bundles chess.js and checks e2e6 legality', async () => {
    const workspaceRoot = path.resolve(process.cwd(), '../..');
    const bundled = await bundleDeterministicProgram({
      absWorkingDir: workspaceRoot,
      entryPath: CHESS_LIBRARY_ENTRY_PATH,
      profile: 'compat-regexp-v1',
    });

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

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.value).toBe(CHESS_E2E6_EXPECTED_LEGAL);
  });
});
