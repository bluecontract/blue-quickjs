import { CERTIFIER_FIXTURES } from '../fixtures.js';

export const FLAGSHIP_FIXTURE_IDS = ['flagship-knowledge-pack'] as const;

export const FLAGSHIP_FIXTURES = CERTIFIER_FIXTURES.filter((fixture) =>
  FLAGSHIP_FIXTURE_IDS.includes(
    fixture.id as (typeof FLAGSHIP_FIXTURE_IDS)[number],
  ),
);
