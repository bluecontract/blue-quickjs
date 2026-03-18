import { CERTIFIER_FIXTURES } from '../fixtures.js';

export const POSITIVE_COMPAT_FIXTURES = CERTIFIER_FIXTURES.filter(
  (fixture) => fixture.kind === 'positive',
);
