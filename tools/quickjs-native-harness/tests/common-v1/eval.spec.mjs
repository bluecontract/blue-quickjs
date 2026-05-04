import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('deterministic runtime eval', () => {
  it('keeps basic evaluation working', () => {
    expectHarnessOutput('basic addition', '1 + 2', 'RESULT 3');
  });

  it('disables eval', () => {
    expectHarnessOutput(
      'eval disabled',
      "eval('1 + 1')",
      'ERROR TypeError: eval is disabled in deterministic mode',
    );
  });
});
