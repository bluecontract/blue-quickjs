import { decodeDv, encodeDv } from '@blue-quickjs/dv';
import { HOST_V1_MANIFEST } from '@blue-quickjs/test-harness';
import { type HostDispatcherHandlers } from './host-dispatcher.js';
import { createRuntime } from './runtime.js';

const DOC_GET_ID = getFnId('document.get');

describe('createRuntime', () => {
  it('instantiates the wasm module and evaluates code', async () => {
    const runtime = await createRuntime({
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    const evalFn = runtime.module.cwrap('qjs_eval', 'number', [
      'string',
      'bigint',
    ]);
    const freeFn = runtime.module.cwrap('qjs_free_output', null, ['number']);

    const ptr = evalFn('1 + 2', BigInt(500));
    const ptrNumber = normalizePtr(ptr);
    const output = runtime.module.UTF8ToString(ptrNumber);
    freeFn(ptrNumber);

    expect(output.trim()).toContain('RESULT 3');
  });

  it('wires host_call to the manifest-backed dispatcher', async () => {
    const handlers = createHandlers();
    const runtime = await createRuntime({
      manifest: HOST_V1_MANIFEST,
      handlers,
    });

    const requestBytes = encodeDv(['path/to/doc']);
    const reqPtr = runtime.module._malloc(requestBytes.length);
    const respPtr = runtime.module._malloc(512);

    const heap = new Uint8Array(runtime.module.HEAPU8.buffer);
    heap.subarray(reqPtr, reqPtr + requestBytes.length).set(requestBytes);

    const written = runtime.hostCall(
      DOC_GET_ID,
      reqPtr,
      requestBytes.length,
      respPtr,
      512,
    );
    expect(typeof written).toBe('number');
    expect(written).toBeGreaterThan(0);

    const envelope = decodeDv(
      heap.subarray(respPtr, respPtr + Number(written)),
    ) as {
      ok?: unknown;
      units: number;
    };

    expect(envelope).toEqual({
      ok: { path: 'path/to/doc' },
      units: 5,
    });
    expect(handlers.document.get).toHaveBeenCalledTimes(1);

    runtime.module._free(reqPtr);
    runtime.module._free(respPtr);
  });
});

function createHandlers(
  overrides?: Partial<HostDispatcherHandlers>,
): HostDispatcherHandlers {
  return {
    document: {
      get:
        overrides?.document?.get ??
        vi.fn((path: string) => ({
          ok: { path },
          units: 5,
        })),
      getCanonical:
        overrides?.document?.getCanonical ??
        vi.fn((path: string) => ({
          ok: { canonical: path },
          units: 3,
        })),
    },
    emit:
      overrides?.emit ??
      vi.fn(() => ({
        ok: null,
        units: 1,
      })),
  };
}

function normalizePtr(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Pointer exceeds JS safe integer range');
    }
    return Number(value);
  }
  throw new Error(`Unexpected pointer type: ${typeof value}`);
}

function getFnId(path: string): number {
  const fn = HOST_V1_MANIFEST.functions.find(
    (entry) => entry.js_path.join('.') === path,
  );
  if (!fn) {
    throw new Error(`missing fn_id for ${path}`);
  }
  return fn.fn_id;
}
