import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('deterministic runtime Proxy', () => {
  it('disables Proxy', () => {
    expectHarnessOutput(
      'Proxy disabled',
      'new Proxy({}, {})',
      'ERROR TypeError: Proxy is disabled in deterministic mode',
    );
  });
});
