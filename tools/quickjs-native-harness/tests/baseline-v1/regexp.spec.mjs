import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('baseline-v1 RegExp', () => {
  it('disables RegExp construction and regex literals', () => {
    expectHarnessOutput(
      'RegExp constructor disabled',
      "new RegExp('a')",
      'ERROR TypeError: RegExp is disabled in deterministic mode',
    );
    expectHarnessOutput(
      'RegExp literal disabled',
      "'abc'.match(/a/)",
      'ERROR TypeError: RegExp is disabled in deterministic mode',
    );
  });
});
