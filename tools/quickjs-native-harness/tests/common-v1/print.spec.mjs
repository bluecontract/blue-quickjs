import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('deterministic runtime print', () => {
  it('disables print', () => {
    expectHarnessOutput(
      'print disabled',
      "print('x')",
      'ERROR TypeError: print is disabled in deterministic mode',
    );
  });
});
