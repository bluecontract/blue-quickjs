import {
  BASE_INPUT,
  BASE_PROGRAM,
  HOST_V1_MANIFEST,
  TEST_GAS_LIMIT,
  createHandlers,
  evaluate,
} from '../evaluate-test-helpers.js';

describe('evaluate baseline-v1', () => {
  it('keeps baseline deterministic globals disabled', async () => {
    const cases = [
      {
        code: `eval('1 + 1')`,
        message: /eval is disabled in deterministic mode/i,
      },
      {
        code: `(new Function('return 7'))()`,
        message: /Function is disabled in deterministic mode/i,
      },
      {
        code: `Math.random()`,
        message: /Math\.random is disabled in deterministic mode/i,
      },
      {
        code: `console.log('x')`,
        message: /console is disabled in deterministic mode/i,
      },
      {
        code: `print('x')`,
        message: /print is disabled in deterministic mode/i,
      },
      {
        code: `new ArrayBuffer(4)`,
        message: /ArrayBuffer is disabled in deterministic mode/i,
      },
      {
        code: `new SharedArrayBuffer(4)`,
        message: /SharedArrayBuffer is disabled in deterministic mode/i,
      },
      {
        code: `new DataView()`,
        message: /DataView is disabled in deterministic mode/i,
      },
      {
        code: `new Uint8Array(4)`,
        message: /Typed arrays are disabled in deterministic mode/i,
      },
      {
        code: `Atomics()`,
        message: /Atomics is disabled in deterministic mode/i,
      },
      {
        code: `WebAssembly()`,
        message: /WebAssembly is disabled in deterministic mode/i,
      },
      {
        code: `new Proxy({}, {})`,
        message: /Proxy is disabled in deterministic mode/i,
      },
    ];
    for (const testCase of cases) {
      const result = await evaluate({
        program: { ...BASE_PROGRAM, code: testCase.code },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected deterministic-disabled failure');
      expect(result.message).toMatch(testCase.message);
    }
  });

  it('keeps RegExp disabled in baseline profile', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: '/a/.test("a")' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected baseline regexp failure');
    expect(result.message).toMatch(/regexp is disabled/i);
  });

  it('keeps Promise disabled in baseline profile', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: 'Promise.resolve(1)' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected baseline Promise failure');
    expect(result.message).toMatch(/promise is disabled/i);
  });

  it('keeps sort disabled in baseline', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: '[3, 1, 2].sort()' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected baseline sort failure');
    expect(result.message).toMatch(/sort is disabled/i);
  });
});
