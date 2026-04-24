import {
  hasBuiltNativeHarness,
  runNativeHarness,
} from './native-harness-test-utils.js';

interface HostGasCase {
  name: string;
  code: string;
  requestExpr: string;
  responseExpr: string;
  units: number;
  expectedStatus: number;
  gas: {
    base: number;
    kArg: number;
    kRet: number;
    kUnits: number;
  };
}

interface HostGasTrace {
  opcodeGas?: number;
  arrayCbBase?: { gas?: number };
  arrayCbPerEl?: { gas?: number };
  alloc?: { gas?: number };
  jsonParse?: { gas?: number };
  jsonStringify?: { gas?: number };
}

const cases: HostGasCase[] = [
  {
    name: 'document-get-ok',
    code: "Host.v1.document.get('foo')",
    requestExpr: "['foo']",
    responseExpr: "({ ok: 'foo', units: 1 })",
    units: 1,
    expectedStatus: 0,
    gas: { base: 20, kArg: 1, kRet: 1, kUnits: 1 },
  },
  {
    name: 'document-get-error',
    code: "Host.v1.document.get('missing')",
    requestExpr: "['missing']",
    responseExpr: "({ err: { code: 'NOT_FOUND' }, units: 2 })",
    units: 2,
    expectedStatus: 1,
    gas: { base: 20, kArg: 1, kRet: 1, kUnits: 1 },
  },
  {
    name: 'emit-null',
    code: 'Host.v1.emit({ a: 1 })',
    requestExpr: '[{ a: 1 }]',
    responseExpr: '({ ok: null, units: 0 })',
    units: 0,
    expectedStatus: 0,
    gas: { base: 5, kArg: 1, kRet: 0, kUnits: 1 },
  },
];

describe('host gas', () => {
  it('has a built native harness available', () => {
    expect(hasBuiltNativeHarness()).toBe(true);
  });

  test.each(cases)('$name charges the documented host gas formula', (testCase) => {
    const reqLen = dvLength(testCase.requestExpr);
    const respLen = dvLength(testCase.responseExpr);
    const expectedHostGas =
      testCase.gas.base +
      testCase.gas.kArg * reqLen +
      testCase.gas.kRet * respLen +
      testCase.gas.kUnits * testCase.units;

    const result = runNativeHarness([
      '--gas-limit',
      '10000',
      '--report-gas',
      '--gas-trace',
      '--eval',
      testCase.code,
    ]);

    expect(result.status).toBe(testCase.expectedStatus);
    expect(result.stderr).toBe('');

    const usedMatch = result.stdout.match(/used=(\d+)/);
    const traceMatch = result.stdout.match(/TRACE (\{.*\})/);

    expect(usedMatch).not.toBeNull();
    expect(traceMatch).not.toBeNull();

    const used = Number(usedMatch![1]);
    const trace = JSON.parse(traceMatch![1]) as HostGasTrace;
    const nonHostGas = computeNonHostGas(trace);

    expect(used - nonHostGas).toBe(expectedHostGas);
  });
});

function dvLength(expr: string): number {
  const result = runNativeHarness(
    ['--dv-encode', '--eval', expr],
    { includeManifest: false },
  );
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');

  const match = result.stdout.match(/^DV\s+([0-9a-fA-F]+)$/);
  expect(match).not.toBeNull();
  return match![1].replace(/\s+/g, '').length / 2;
}

function computeNonHostGas(trace: HostGasTrace): number {
  return (
    Number(trace.opcodeGas || 0) +
    Number(trace.arrayCbBase?.gas || 0) +
    Number(trace.arrayCbPerEl?.gas || 0) +
    Number(trace.alloc?.gas || 0) +
    Number(trace.jsonParse?.gas || 0) +
    Number(trace.jsonStringify?.gas || 0)
  );
}
