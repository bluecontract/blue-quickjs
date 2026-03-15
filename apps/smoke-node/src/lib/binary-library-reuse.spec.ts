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
import { evaluate } from '@blue-quickjs/quickjs-runtime';

describe('smoke-node binary library reuse', () => {
  it('bundles binary-heavy npm packages and matches expected results', async () => {
    const workspaceRoot = path.resolve(process.cwd(), '../..');

    for (const fixture of BINARY_LIBRARY_FIXTURES) {
      const bundled = await bundleDeterministicProgram({
        absWorkingDir: workspaceRoot,
        entryPath: fixture.entryPath,
        profile: 'compat-binary-v1',
      });

      const host = createDeterminismHost();
      const result = await evaluate({
        program: {
          ...BINARY_LIBRARY_PROGRAM_BASE,
          code: bundled.code,
        },
        input: BINARY_LIBRARY_INPUT,
        gasLimit: BINARY_LIBRARY_GAS_LIMIT,
        manifest: BINARY_LIBRARY_MANIFEST,
        handlers: host.handlers,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(
          `${fixture.name} failed: ${result.error.code}: ${result.message}`,
        );
      }

      expect(result.value).toEqual(fixture.expectedValue);
    }
  });
});
