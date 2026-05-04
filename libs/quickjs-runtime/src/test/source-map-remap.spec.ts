import { remapModulePackErrorPayload } from '../lib/source-map-remap.js';
import type { ModulePackV1 } from '../lib/quickjs-runtime.js';

function createModulePack(sourceMap?: string): ModulePackV1 {
  return {
    version: 1,
    entrySpecifier: './entry.js',
    entryExport: 'default',
    modules: [
      {
        specifier: './entry.js',
        source: 'const x = 1;\nthrow new Error("boom");\n',
        ...(sourceMap ? { sourceMap } : {}),
      },
    ],
    graphHash: '0'.repeat(64),
    builderVersion: 'deterministic-builder-v1',
    dependencyIntegrity: '1'.repeat(64),
  };
}

describe('source-map remap', () => {
  it('remaps module-pack stack locations to original sources', () => {
    const sourceMap = JSON.stringify({
      version: 3,
      file: 'entry.js',
      sources: ['src/entry.ts'],
      names: [],
      mappings: 'AAAA;AACA',
    });
    const payload =
      'ModuleEvaluationError: Error: boom at ./entry.js:2:7 and ./entry.js:1:1';

    const remapped = remapModulePackErrorPayload(
      payload,
      createModulePack(sourceMap),
    );

    expect(remapped.payload).toContain('src/entry.ts:2:1');
    expect(remapped.payload).toContain('src/entry.ts:1:1');
    expect(remapped.locations).toHaveLength(2);
    expect(remapped.locations[0]).toMatchObject({
      generatedSpecifier: './entry.js',
      generatedLine: 2,
      generatedColumn: 7,
      source: 'src/entry.ts',
      line: 2,
      column: 1,
    });
  });

  it('leaves payload unchanged when no source map is present', () => {
    const payload = 'ModuleEvaluationError: Error: boom at ./entry.js:2:7';
    const remapped = remapModulePackErrorPayload(payload, createModulePack());
    expect(remapped.payload).toBe(payload);
    expect(remapped.locations).toEqual([]);
  });
});
