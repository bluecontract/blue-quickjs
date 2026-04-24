import {
  BASE_INPUT,
  BASE_PROGRAM_V2_BINARY,
  HOST_V2_MANIFEST,
  TEST_GAS_LIMIT,
  createHandlers,
  evaluate,
  vi,
} from '../evaluate-test-helpers.js';

describe('evaluate compat-binary-v1', () => {
  it('supports Host.v2 DV2 byte roundtrips', async () => {
    const handlers = createHandlers({
      document: {
        get: vi.fn((path: string) => {
          if (path !== 'bytes/payload') {
            return {
              err: { code: 'NOT_FOUND', tag: 'host/not_found' },
              units: 1,
            };
          }
          return { ok: Uint8Array.from([222, 173, 190, 239]), units: 2 };
        }),
      },
      emit: vi.fn(() => ({ ok: null, units: 1 })),
    });
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM_V2_BINARY,
        code: `(() => { const payload = Host.v2.document.get('bytes/payload'); Host.v2.emit(payload); return 1; })()`,
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V2_MANIFEST,
      handlers,
    });
    expect(compat.ok).toBe(true);
    if (!compat.ok) throw new Error(compat.message);
    expect(compat.value).toBe(1);
  });

  it('preserves Host.v2 byte-string slice boundaries', async () => {
    const handlers = createHandlers({
      document: {
        get: vi.fn(() => {
          const backing = Uint8Array.from([0, 0xde, 0xad, 0, 0]);
          return { ok: backing.subarray(1, 3), units: 2 };
        }),
      },
      emit: vi.fn(() => ({ ok: null, units: 1 })),
    });
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM_V2_BINARY,
        code: `(() => { const payload = Host.v2.document.get('bytes/payload'); return [payload.byteLength, payload[0], payload[1]]; })()`,
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V2_MANIFEST,
      handlers,
    });
    expect(compat.ok).toBe(true);
    if (!compat.ok) throw new Error(compat.message);
    expect(compat.value).toEqual([2, 222, 173]);
  });
});
