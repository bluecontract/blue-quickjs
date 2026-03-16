import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BINARY_LIBRARY_FIXTURES,
  DETERMINISM_FIXTURES,
  GAS_SAMPLE_FIXTURES,
  MODULE_PACK_FIXTURES,
} from '@blue-quickjs/test-harness';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, '../../../..');

const REQUIRED_EXAMPLE_PATHS = [
  'examples/01-basic-script/program.js',
  'examples/02-module-pack/entry.js',
  'examples/02-module-pack/values.js',
  'examples/03-library-reuse/chess-entry.ts',
  'examples/03-library-reuse/binary-base64-entry.ts',
  'examples/04-promises-async/program.js',
  'examples/05-promises-library-host/entry.js',
  'examples/05-promises-library-host/lib.js',
  'examples/06-binary-host-v2/program.js',
  'examples/07-console-shim/program.js',
  'examples/08-stable-sort/program.js',
  'examples/09-kitchen-sink/entry.js',
  'examples/09-kitchen-sink/workflow.js',
  'examples/10-max-gas-policy/program.js',
];

describe('examples corpus coverage', () => {
  it('includes source files for all ten example categories', () => {
    const missing = REQUIRED_EXAMPLE_PATHS.filter(
      (relativePath) => !fs.existsSync(path.join(workspaceRoot, relativePath)),
    );

    expect(missing).toEqual([]);
  });

  it('maps examples to existing fixture coverage', () => {
    const determinismNames = new Set(DETERMINISM_FIXTURES.map((f) => f.name));
    const modulePackNames = new Set(MODULE_PACK_FIXTURES.map((f) => f.name));
    const gasNames = new Set(GAS_SAMPLE_FIXTURES.map((f) => f.name));
    const binaryNames = new Set(BINARY_LIBRARY_FIXTURES.map((f) => f.name));

    expect(determinismNames.has('async-promise-chain')).toBe(true);
    expect(determinismNames.has('compat-binary-host-v2-bytes-roundtrip')).toBe(
      true,
    );
    expect(determinismNames.has('compat-console-shim')).toBe(true);
    expect(determinismNames.has('compat-stable-sort')).toBe(true);
    expect(modulePackNames.has('module-pack-default-export')).toBe(true);
    expect(modulePackNames.has('module-pack-async-import-host-call')).toBe(
      true,
    );
    expect(modulePackNames.has('module-pack-kitchen-sink')).toBe(true);
    expect(gasNames.has('return-1')).toBe(true);
    expect(gasNames.has('loop-10k')).toBe(true);
    expect(binaryNames.has('base64-js-roundtrip')).toBe(true);
  });
});
