import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BINARY_LIBRARY_FIXTURES,
  DETERMINISM_FIXTURES,
  EXAMPLE_CORPUS,
  GAS_SAMPLE_FIXTURES,
  MODULE_PACK_FIXTURES,
} from '@blue-quickjs/test-harness';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, '../../../..');

describe('examples corpus coverage', () => {
  it('includes source files for all ten example categories', () => {
    expect(EXAMPLE_CORPUS).toHaveLength(10);
    const ids = new Set(EXAMPLE_CORPUS.map((entry) => entry.id));
    expect(ids.size).toBe(EXAMPLE_CORPUS.length);

    const sourcePaths = EXAMPLE_CORPUS.flatMap((entry) => entry.sourcePaths);
    const missing = sourcePaths.filter(
      (relativePath) => !fs.existsSync(path.join(workspaceRoot, relativePath)),
    );

    expect(missing).toEqual([]);
  });

  it('maps examples to existing fixture coverage', () => {
    const fixtureSets = {
      determinism: new Set(DETERMINISM_FIXTURES.map((fixture) => fixture.name)),
      'module-pack': new Set(MODULE_PACK_FIXTURES.map((fixture) => fixture.name)),
      'gas-sample': new Set(GAS_SAMPLE_FIXTURES.map((fixture) => fixture.name)),
      'gas-boundary': new Set(GAS_SAMPLE_FIXTURES.map((fixture) => fixture.name)),
      'binary-library': new Set(
        BINARY_LIBRARY_FIXTURES.map((fixture) => fixture.name),
      ),
      'chess-library': new Set(['chess-e2e6']),
    } as const;

    const missingTargets: string[] = [];
    for (const example of EXAMPLE_CORPUS) {
      for (const target of example.coverage) {
        if (!fixtureSets[target.suite].has(target.fixtureName)) {
          missingTargets.push(
            `${example.slug}:${target.suite}:${target.fixtureName}`,
          );
        }
      }
    }

    expect(missingTargets).toEqual([]);
  });
});
