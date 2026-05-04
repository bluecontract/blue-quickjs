import { CERTIFIER_FIXTURES } from './fixtures.js';

describe('ecosystem certifier fixture catalog', () => {
  it('includes flagship, positive, and negative fixtures', () => {
    const kinds = new Set(CERTIFIER_FIXTURES.map((fixture) => fixture.kind));
    expect(kinds.has('flagship')).toBe(true);
    expect(kinds.has('positive')).toBe(true);
    expect(kinds.has('negative')).toBe(true);
  });

  it('uses unique ids', () => {
    const ids = CERTIFIER_FIXTURES.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
