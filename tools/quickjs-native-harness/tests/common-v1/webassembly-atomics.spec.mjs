import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('deterministic runtime WebAssembly and Atomics', () => {
  it('disables Atomics and WebAssembly', () => {
    expectHarnessOutput(
      'Atomics disabled',
      'Atomics()',
      'ERROR TypeError: Atomics is disabled in deterministic mode',
    );
    expectHarnessOutput(
      'WebAssembly disabled',
      'WebAssembly()',
      'ERROR TypeError: WebAssembly is disabled in deterministic mode',
    );
  });
});
