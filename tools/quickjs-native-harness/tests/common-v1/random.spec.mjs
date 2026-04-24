import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('deterministic runtime Math.random', () => {
  it('disables Math.random', () => {
    expectHarnessOutput(
      'Math.random disabled',
      'Math.random()',
      'ERROR TypeError: Math.random is disabled in deterministic mode',
    );
  });
});
