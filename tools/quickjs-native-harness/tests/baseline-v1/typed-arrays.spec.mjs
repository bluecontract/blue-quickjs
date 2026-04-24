import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('baseline-v1 binary surface', () => {
  it('disables typed arrays and related binary objects', () => {
    expectHarnessOutput(
      'ArrayBuffer disabled',
      'new ArrayBuffer(4)',
      'ERROR TypeError: ArrayBuffer is disabled in deterministic mode',
    );
    expectHarnessOutput(
      'SharedArrayBuffer disabled',
      'new SharedArrayBuffer(4)',
      'ERROR TypeError: SharedArrayBuffer is disabled in deterministic mode',
    );
    expectHarnessOutput(
      'DataView disabled',
      'new DataView()',
      'ERROR TypeError: DataView is disabled in deterministic mode',
    );
    expectHarnessOutput(
      'Typed arrays disabled',
      'new Uint8Array(4)',
      'ERROR TypeError: Typed arrays are disabled in deterministic mode',
    );
  });
});
