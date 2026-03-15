import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDeterministicModulePack } from '../index.js';

describe('deterministic-builder facade', () => {
  it('builds a module pack via deterministic-bundler implementation', async () => {
    const fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'det-builder-facade-fixture-'),
    );
    const entryPath = path.join(fixtureDir, 'entry.ts');
    fs.writeFileSync(entryPath, 'export default 7;', 'utf8');

    const built = await buildDeterministicModulePack({
      absWorkingDir: fixtureDir,
      entryPath: 'entry.ts',
    });

    expect(built.modulePack.version).toBe(1);
    expect(built.modulePack.graphHash).toMatch(/^[0-9a-f]{64}$/);
    expect(built.compatibility.ok).toBe(true);
  });
});
