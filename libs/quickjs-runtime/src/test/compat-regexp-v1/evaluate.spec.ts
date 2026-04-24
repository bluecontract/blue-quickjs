import {
  BASE_INPUT,
  BASE_PROGRAM,
  HOST_V1_MANIFEST,
  TEST_GAS_LIMIT,
  createHandlers,
  evaluate,
} from '../../lib/evaluate-test-helpers.js';

describe('evaluate compat-regexp-v1', () => {
  it('enables RegExp literals and constructors', async () => {
    const literal = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: '/a+/.test("aaa")',
        executionProfile: 'compat-regexp-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(literal.ok).toBe(true);
    if (!literal.ok) throw new Error(literal.message);
    expect(literal.value).toBe(true);

    const ctor = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: 'new RegExp("^a+$").test("aaa")',
        executionProfile: 'compat-regexp-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(ctor.ok).toBe(true);
    if (!ctor.ok) throw new Error(ctor.message);
    expect(ctor.value).toBe(true);
  });

  it('keeps Promise and queueMicrotask disabled', async () => {
    for (const code of ['Promise.resolve(1)', 'queueMicrotask(() => 1)']) {
      const result = await evaluate({
        program: {
          ...BASE_PROGRAM,
          code,
          executionProfile: 'compat-regexp-v1',
        },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected compat-regexp failure');
      expect(result.message).toMatch(
        code.startsWith('Promise')
          ? /promise is disabled/i
          : /queueMicrotask is disabled|'queueMicrotask' is not defined|queueMicrotask is not defined/i,
      );
    }
  });

  it('keeps console and stable sort disabled', async () => {
    const cases = [
      { code: `console.log('x')`, message: /console is disabled in deterministic mode/i },
      { code: `[3, 1, 2].sort()`, message: /sort is disabled/i },
    ];
    for (const testCase of cases) {
      const result = await evaluate({
        program: {
          ...BASE_PROGRAM,
          code: testCase.code,
          executionProfile: 'compat-regexp-v1',
        },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected compat-regexp failure');
      expect(result.message).toMatch(testCase.message);
    }
  });

  it('keeps binary intrinsics disabled', async () => {
    const cases = [
      { code: `new ArrayBuffer(4)`, message: /ArrayBuffer is disabled in deterministic mode/i },
      {
        code: `new DataView(new ArrayBuffer(8))`,
        message: /ArrayBuffer is disabled in deterministic mode|DataView is disabled in deterministic mode/i,
      },
      { code: `new Uint8Array(4)`, message: /Typed arrays are disabled in deterministic mode/i },
    ];
    for (const testCase of cases) {
      const result = await evaluate({
        program: {
          ...BASE_PROGRAM,
          code: testCase.code,
          executionProfile: 'compat-regexp-v1',
        },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected compat-regexp failure');
      expect(result.message).toMatch(testCase.message);
    }
  });
});
