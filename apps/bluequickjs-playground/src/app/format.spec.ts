import {
  formatGas,
  formatStage,
  shortenHash,
  slugToLabel,
  toPrettyJson,
} from './format.js';

describe('playground format helpers', () => {
  it('formats gas values with grouping', () => {
    expect(formatGas('1000000')).toBe('1,000,000');
    expect(formatGas(74n)).toBe('74');
  });

  it('shortens hashes for UI display', () => {
    expect(shortenHash('a'.repeat(64), 6)).toBe('aaaaaa…aaaaaa');
    expect(shortenHash(null)).toBe('—');
  });

  it('formats failure stages for labels', () => {
    expect(formatStage('artifact_validation')).toBe('artifact validation');
  });

  it('converts slugs into labels', () => {
    expect(slugToLabel('ecosystem-green')).toBe('Ecosystem Green');
  });

  it('pretty prints json content', () => {
    expect(toPrettyJson({ ok: true })).toContain('"ok": true');
  });
});
