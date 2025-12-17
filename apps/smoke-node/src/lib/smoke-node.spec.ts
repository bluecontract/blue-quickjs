import { SMOKE_PROGRAM } from './fixtures.js';
import { runSmokeNode } from './smoke-node.js';

describe('smokeNode', () => {
  it('runs the sample fixture and reports a stable summary', async () => {
    const log: string[] = [];
    const summary = await runSmokeNode({ log: (line) => log.push(line) });

    expect(summary.status).toBe('ok');
    expect(summary.manifestHash).toBe(SMOKE_PROGRAM.abiManifestHash);
    expect(summary.resultHash).toMatch(/^[0-9a-f]{64}$/);
    expect(summary.gasUsed > 0n).toBe(true);
    expect(summary.tapeCount).toBeGreaterThan(0);
    expect(summary.emitted.length).toBe(1);
    expect(summary.value).toMatchObject({ marker: 'smoke-node' });
    expect(log.some((line) => line.includes('result hash'))).toBe(true);
  });
});
