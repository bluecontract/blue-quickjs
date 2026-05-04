import { describe, it } from 'vitest';
import { expectHarnessFixture } from '../helpers/harness.mjs';

describe('deterministic runtime gas and GC', () => {
  it('enforces zero gas and gc-checkpoint budget limits', () => {
    expectHarnessFixture(
      'zero-precharge',
      'gas/zero-precharge.js',
      'ERROR OutOfGas: out of gas GAS remaining=0 used=0 STATE undefined',
      ['--gas-limit', '0', '--report-gas', '--dump-global', '__touched'],
    );
    expectHarnessFixture(
      'gc-checkpoint-budget',
      'gas/zero-precharge.js',
      'ERROR OutOfGas: out of gas GAS remaining=0 used=54 STATE undefined',
      ['--gas-limit', '54', '--report-gas', '--dump-global', '__touched'],
    );
  });

  it('reports opcode gas usage', () => {
    expectHarnessFixture(
      'addition-gas',
      'gas/addition.js',
      'RESULT 3 GAS remaining=66 used=39',
      ['--gas-limit', '105', '--report-gas'],
    );
  });

  it('includes allocation gas in traces', () => {
    expectHarnessFixture(
      'addition-trace',
      'gas/addition.js',
      'RESULT 3 GAS remaining=66 used=39 TRACE {"opcodeCount":5,"opcodeGas":5,"arrayCbBase":{"count":0,"gas":0},"arrayCbPerEl":{"count":0,"gas":0},"alloc":{"count":11,"bytes":1048,"gas":34},"jsonParse":{"count":0,"gas":0,"inputBytes":0,"values":0,"objectEntries":0,"arrayElements":0},"jsonStringify":{"count":0,"gas":0,"outputBytes":0,"values":0,"objectEntries":0,"arrayElements":0,"sortComparisons":0},"hostCallPre":{"count":0,"gas":0},"hostCallPost":{"count":0,"gas":0}}',
      ['--gas-limit', '105', '--report-gas', '--gas-trace'],
    );
  });

  it('runs deterministic gc checkpoints without spurious extra gas drift', () => {
    expectHarnessFixture(
      'gc-pending-trace',
      'gas/gc-pending.js',
      'RESULT 1200000 GAS remaining=39911 used=89 TRACE {"opcodeCount":18,"opcodeGas":18,"arrayCbBase":{"count":0,"gas":0},"arrayCbPerEl":{"count":0,"gas":0},"alloc":{"count":39,"bytes":2456,"gas":71},"jsonParse":{"count":0,"gas":0,"inputBytes":0,"values":0,"objectEntries":0,"arrayElements":0},"jsonStringify":{"count":0,"gas":0,"outputBytes":0,"values":0,"objectEntries":0,"arrayElements":0,"sortComparisons":0},"hostCallPre":{"count":0,"gas":0},"hostCallPost":{"count":0,"gas":0}}',
      ['--gas-limit', '40000', '--report-gas', '--gas-trace'],
    );
  });
});
