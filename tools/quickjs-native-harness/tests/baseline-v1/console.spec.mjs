import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('baseline-v1 console', () => {
  it('disables console', () => {
    expectHarnessOutput(
      'console disabled',
      "console.log('x')",
      'ERROR TypeError: console is disabled in deterministic mode',
    );
  });
});
