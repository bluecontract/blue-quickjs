import {
  BASE_INPUT,
  BASE_PROGRAM,
  HOST_V1_MANIFEST,
  TEST_GAS_LIMIT,
  createHandlers,
  evaluate,
  vi,
} from '../evaluate-test-helpers.js';

describe('evaluate compat-general-v1', () => {
  it('enables RegExp', async () => {
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: '/a/.test("a")',
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(compat.ok).toBe(true);
    if (!compat.ok) throw new Error(compat.message);
    expect(compat.value).toBe(true);
  });

  it('drains Promise jobs', async () => {
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: 'Promise.resolve(41).then((value) => value + 1)',
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(compat.ok).toBe(true);
    if (!compat.ok) throw new Error(compat.message);
    expect(compat.value).toBe(42);
  });

  it('runs queueMicrotask deterministically', async () => {
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `(() => { const events = []; queueMicrotask(() => events.push('first')); queueMicrotask(() => events.push('second')); return Promise.resolve().then(() => events.join(',')); })()`,
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(compat.ok).toBe(true);
    if (!compat.ok) throw new Error(compat.message);
    expect(compat.value).toBe('first,second');
  });

  it('validates queueMicrotask callbacks', async () => {
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: 'queueMicrotask(123)',
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(compat.ok).toBe(false);
    if (compat.ok)
      throw new Error('expected queueMicrotask validation failure');
    expect(compat.message).toMatch(/queueMicrotask callback must be callable/i);
  });

  it('routes compat-general console shim calls through Host.v1.emit', async () => {
    const handlers = createHandlers();
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `(() => { console.log('hello', 7); return null; })()`,
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers,
    });
    expect(compat.ok).toBe(true);
    if (!compat.ok) throw new Error(compat.message);
    expect(handlers.emit).toHaveBeenCalledWith({
      type: 'console',
      level: 'log',
      args: ['hello', 7],
    });
  });

  it('routes all compat console levels through Host emit', async () => {
    const handlers = createHandlers();
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `(() => { console.info('i'); console.warn('w'); console.error('e'); console.debug('d'); return null; })()`,
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers,
    });
    expect(compat.ok).toBe(true);
    if (!compat.ok) throw new Error(compat.message);
    const emitMock = handlers.emit as ReturnType<typeof vi.fn>;
    expect(emitMock.mock.calls).toEqual([
      [{ type: 'console', level: 'info', args: ['i'] }],
      [{ type: 'console', level: 'warn', args: ['w'] }],
      [{ type: 'console', level: 'error', args: ['e'] }],
      [{ type: 'console', level: 'debug', args: ['d'] }],
    ]);
  });

  it('enables stable sort', async () => {
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `(() => { const records = [{ id: 'a', group: 1 }, { id: 'b', group: 1 }, { id: 'c', group: 2 }, { id: 'd', group: 1 }]; records.sort((left, right) => left.group - right.group); return records.map((record) => record.id).join(','); })()`,
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(compat.ok).toBe(true);
    if (!compat.ok) throw new Error(compat.message);
    expect(compat.value).toBe('a,b,d,c');
  });

  it('validates stable sort compare functions', async () => {
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: '[3, 1, 2].sort(123)',
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(compat.ok).toBe(false);
    if (compat.ok) throw new Error('expected sort compareFunction failure');
    expect(compat.message).toMatch(/compareFunction must be a function/i);
  });
});
