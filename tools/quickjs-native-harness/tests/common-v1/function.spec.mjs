import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('deterministic runtime Function', () => {
  it('disables the Function global', () => {
    expectHarnessOutput(
      'Function disabled',
      "(new Function('return 7'))()",
      'ERROR TypeError: Function is disabled in deterministic mode',
    );
  });

  it('blocks Function constructor escape paths', () => {
    expectHarnessOutput(
      'Function ctor via Function.prototype.constructor',
      "(() => { const RealFunction = (function () {}).constructor; return RealFunction('return 3')(); })()",
      'ERROR TypeError: Function constructor is disabled in deterministic mode',
    );

    expectHarnessOutput(
      'Function ctor via arrow constructor',
      "(() => { const RealFunction = (() => {}).constructor; return RealFunction('return 4')(); })()",
      'ERROR TypeError: Function constructor is disabled in deterministic mode',
    );

    expectHarnessOutput(
      'Function ctor via generator constructor',
      "(() => { const GenFunction = (function* () {}).constructor; return GenFunction('return 5')(); })()",
      'ERROR TypeError: Function constructor is disabled in deterministic mode',
    );
  });
});
