import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('baseline-v1 Promise', () => {
  it('disables Promise in baseline mode', () => {
    expectHarnessOutput(
      'Promise disabled',
      'Promise.resolve(1)',
      'ERROR TypeError: Promise is disabled in deterministic mode',
    );
  });
});
