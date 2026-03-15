import { bundleDeterministicProgram } from '@blue-quickjs/deterministic-bundler';
import path from 'node:path';
import {
  BINARY_LIBRARY_FIXTURES,
  BINARY_LIBRARY_GAS_LIMIT,
  BINARY_LIBRARY_INPUT,
  BINARY_LIBRARY_MANIFEST,
  BINARY_LIBRARY_PROGRAM_BASE,
  createDeterminismHost,
} from '@blue-quickjs/test-harness';
import { evaluate } from './evaluate.js';

describe('library reuse: binary packages', () => {
  for (const fixture of BINARY_LIBRARY_FIXTURES) {
    it(`bundles ${fixture.name} deterministically`, async () => {
      const workspaceRoot = path.resolve(process.cwd(), '../..');
      const bundled = await bundleDeterministicProgram({
        absWorkingDir: workspaceRoot,
        entryPath: fixture.entryPath,
        profile: 'compat-binary-v1',
      });

      const run = async () => {
        const host = createDeterminismHost();
        return evaluate({
          program: {
            ...BINARY_LIBRARY_PROGRAM_BASE,
            code: bundled.code,
          },
          input: BINARY_LIBRARY_INPUT,
          gasLimit: BINARY_LIBRARY_GAS_LIMIT,
          manifest: BINARY_LIBRARY_MANIFEST,
          handlers: host.handlers,
        });
      };

      const first = await run();
      const second = await run();

      if (!first.ok || !second.ok) {
        const describe = (result: typeof first) =>
          result.ok
            ? 'ok'
            : `${result.type}:${result.error.code}:${result.message}`;
        throw new Error(
          `expected binary fixture runs to succeed: first=${describe(first)} second=${describe(second)}`,
        );
      }

      expect(first.value).toEqual(fixture.expectedValue);
      expect(second.value).toEqual(fixture.expectedValue);
      expect(first.gasUsed).toBe(second.gasUsed);
      expect(first.gasRemaining).toBe(second.gasRemaining);
    });
  }
});
