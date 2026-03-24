import { CERTIFIER_FIXTURES } from '../fixtures.js';

export const NEGATIVE_COMPAT_FIXTURES = CERTIFIER_FIXTURES.filter(
  (fixture) => fixture.kind === 'negative',
);
