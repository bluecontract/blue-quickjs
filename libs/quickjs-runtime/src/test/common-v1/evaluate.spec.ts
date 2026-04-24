import {
  BASE_INPUT,
  BASE_PROGRAM,
  BASE_PROGRAM_V2_SCRIPT,
  HOST_V1_MANIFEST,
  TEST_GAS_LIMIT,
  createHandlers,
  createModulePack,
  createModulePackProgram,
  evaluate,
  getFnId,
  vi,
} from '../../lib/evaluate-test-helpers.js';
import type { HostDispatcherHandlers } from '../../lib/host-dispatcher.js';

describe('evaluate common-v1', () => {
  it('evaluates raw script mode using final expression result', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: 'const n = 2; n + 3' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toBe(5);
  });

  it('evaluates ProgramArtifact.v2 script source', async () => {
    const result = await evaluate({
      program: {
        ...BASE_PROGRAM_V2_SCRIPT,
        source: { code: 'const n = 10; n + 4;' },
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toBe(14);
  });

  it('evaluates ProgramArtifact.v2 module-pack default export', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      modules: [{ specifier: './entry.js', source: 'export default 1;\n' }],
    });
    const result = await evaluate({
      program: createModulePackProgram(modulePack),
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toBe(1);
  });

  it('evaluates module-pack entryExport for named exports', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      entryExport: 'answer',
      modules: [{ specifier: './entry.js', source: 'export const answer = 42;\n' }],
    });
    const result = await evaluate({
      program: createModulePackProgram(modulePack),
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toBe(42);
  });

  it('evaluates cyclic module-pack imports deterministically', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      modules: [
        {
          specifier: './entry.js',
          source: "import { valueFromA } from './b.js'; export default valueFromA;\n",
        },
        {
          specifier: './a.js',
          source:
            "import { getB } from './b.js'; export function getA() { return 40 + getB(); }\n",
        },
        {
          specifier: './b.js',
          source:
            "import { getA } from './a.js'; export function getB() { return 2; } export const valueFromA = getA();\n",
        },
      ],
    });
    const result = await evaluate({
      program: createModulePackProgram(modulePack),
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toBe(42);
  });

  it('maps missing entry module to deterministic module-pack error', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './missing.js',
      modules: [{ specifier: './entry.js', source: 'export default 1;\n' }],
    });
    const result = await evaluate({
      program: createModulePackProgram(modulePack),
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected module-pack failure');
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('module-pack');
    if (result.error.kind !== 'module-pack') throw new Error('expected module-pack error kind');
    expect(result.error.code).toBe('MODULE_SPECIFIER_NOT_FOUND');
  });

  it('maps missing module export to deterministic module-pack error', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      entryExport: 'missing',
      modules: [{ specifier: './entry.js', source: 'export const value = 1;\n' }],
    });
    const result = await evaluate({
      program: createModulePackProgram(modulePack),
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected module-pack failure');
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('module-pack');
    if (result.error.kind !== 'module-pack') throw new Error('expected module-pack error kind');
    expect(result.error.code).toBe('MODULE_EXPORT_MISSING');
  });

  it('rejects module-pack artifacts with graph hash mismatch', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      modules: [{ specifier: './entry.js', source: 'export default 1;\n' }],
    });
    await expect(
      evaluate({
        program: {
          ...createModulePackProgram({
            ...modulePack,
            graphHash: 'b'.repeat(64),
          }),
        },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
      }),
    ).rejects.toThrow(/MODULE_PACK_HASH_MISMATCH/);
  });

  it('classifies top-level return as execution surface mismatch', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: 'return 1' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected vm failure');
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('execution-surface-mismatch');
    expect(result.error.code).toBe('EXECUTION_SURFACE_MISMATCH');
  });

  it('supports emit side effects in raw script mode', async () => {
    const handlers = createHandlers();
    const result = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: 'emit({ marker: "raw-script" }); ({ status: "ok" })',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toEqual({ status: 'ok' });
    expect(handlers.emit).toHaveBeenCalledWith({ marker: 'raw-script' });
  });

  it('replays identical script evaluations deterministically', async () => {
    const handlersA = createHandlers();
    const handlersB = createHandlers();
    const program = {
      ...BASE_PROGRAM,
      code: 'emit({ marker: "replay" }); ({ ok: true, payload: event.payload.id })',
    };

    const first = await evaluate({
      program,
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: handlersA,
      tape: {},
      gasTrace: true,
    });
    const second = await evaluate({
      program,
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: handlersB,
      tape: {},
      gasTrace: true,
    });

    expect(first).toEqual(second);
  });

  it('replays identical module-pack evaluations deterministically', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      modules: [
        {
          specifier: './entry.js',
          source:
            "Host.v1.emit({ kind: 'module-pack-replay' }); export default { answer: 42 };",
        },
      ],
    });

    const run = () =>
      evaluate({
        program: createModulePackProgram(modulePack),
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
        tape: {},
        gasTrace: true,
      });

    const first = await run();
    const second = await run();

    expect(first).toEqual(second);
  });

  it('installs hardened Host globals and ergonomic wrappers', async () => {
    const result = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `
          (() => {
            const before = Host;
            Host = 123;
            const after = Host;
            let added = false;
            try {
              Host.v1.added = 1;
              added = Object.prototype.hasOwnProperty.call(Host.v1, 'added');
            } catch (_) {
              added = false;
            }
            const desc = Object.getOwnPropertyDescriptor(globalThis, 'Host');
            return {
              configurable: desc ? desc.configurable : null,
              enumerable: desc ? desc.enumerable : null,
              writable: desc ? desc.writable : null,
              sameRef: before === after,
              hostType: typeof Host,
              hostNullProto: Object.getPrototypeOf(Host) === null,
              v1Type: typeof Host.v1,
              v1NullProto: Object.getPrototypeOf(Host.v1) === null,
              hostIsExtensible: Object.isExtensible(Host),
              hostV1Extensible: Object.isExtensible(Host.v1),
              added,
              documentType: typeof document,
              emitType: typeof emit
            };
          })()
        `,
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toEqual({
      configurable: false,
      enumerable: false,
      writable: false,
      sameRef: true,
      hostType: 'object',
      hostNullProto: true,
      v1Type: 'object',
      v1NullProto: true,
      hostIsExtensible: false,
      hostV1Extensible: false,
      added: false,
      documentType: 'function',
      emitType: 'function',
    });
  });

  it('supports canon.at JSON Pointer lookups and canon.unwrap shallow vs deep', async () => {
    const result = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `
          (() => {
            const deep = canon.unwrap(currentContractCanonical);
            const shallow = canon.unwrap(currentContractCanonical, false);
            return {
              payloadId: canon.at(event, '/payload/id'),
              stepName: canon.at(steps, '/0/name'),
              missingIsUndefined: typeof canon.at(event, '/payload/missing') === 'undefined',
              deep,
              shallow,
              deepRootFrozen: Object.isFrozen(deep),
              deepIdFrozen: Object.isFrozen(deep.id),
              shallowRootFrozen: Object.isFrozen(shallow),
              shallowIdFrozen: Object.isFrozen(shallow.id)
            };
          })()
        `,
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toEqual({
      payloadId: 1,
      stepName: 'first',
      missingIsUndefined: true,
      deep: { id: 'contract-1' },
      shallow: { id: { value: 'contract-1' } },
      deepRootFrozen: true,
      deepIdFrozen: true,
      shallowRootFrozen: true,
      shallowIdFrozen: false,
    });
  });

  it('rejects invalid canon.at pointer forms deterministically', async () => {
    const cases = [
      {
        code: `canon.at(event, ['payload', 'id'])`,
        message: /JSON Pointer string \(array paths are no longer supported\)/i,
      },
      {
        code: `canon.at(event, '#/payload/id')`,
        message: /fragment form is not supported/i,
      },
      {
        code: `canon.at(steps, '/-')`,
        message: /path index '-' is not allowed/i,
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
      if (result.ok) throw new Error('expected canon.at failure');
      expect(result.type).toBe('vm-error');
      expect(result.error.kind).toBe('js-exception');
      expect(result.message).toMatch(testCase.message);
    }
  });

  it('returns DV results with gas accounting', async () => {
    const handlers = createHandlers();
    const result = await evaluate({
      program: BASE_PROGRAM,
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toEqual({ path: 'path/to/doc' });
    expect(handlers.document.get).toHaveBeenCalledTimes(1);
  });

  it('maps VM errors to a structured failure', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: 'document(123)' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected VM failure');
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('js-exception');
  });

  it('rejects unsupported return types at the VM boundary', async () => {
    for (const code of ['undefined', '(() => {})', 'Symbol("x")', '1n']) {
      const result = await evaluate({
        program: { ...BASE_PROGRAM, code },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected VM failure');
      expect(result.type).toBe('vm-error');
      expect(result.error.kind).toBe('js-exception');
    }
  });

  it('includes human-readable DV tag names in unsupported output errors', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: 'Symbol("x")' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected unsupported DV type failure');
    expect(result.message).toMatch(/unsupported DV type: symbol/i);
  });

  it('applies output DV limits to returned payloads', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: '"hello world"' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      outputDvLimits: { maxEncodedBytes: 4 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected invalid output');
    expect(result.type).toBe('invalid-output');
  });

  it('maps HostError failures to code/tag using the manifest', async () => {
    const handlers = createHandlers({
      document: {
        get: vi.fn(() => ({
          err: { code: 'NOT_FOUND', tag: 'host/not_found' },
          units: 2,
        })),
      },
    });
    const result = await evaluate({
      program: BASE_PROGRAM,
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected host error');
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('host-error');
    if (result.error.kind !== 'host-error') throw new Error('expected host-error');
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('maps host transport failures to a stable code/tag', async () => {
    const handlers = createHandlers({
      document: {
        get: vi.fn(
          () =>
            ({
              ok: { path: 'path/to/doc' },
            }) as unknown as ReturnType<HostDispatcherHandlers['document']['get']>,
        ),
      },
    });
    const result = await evaluate({
      program: BASE_PROGRAM,
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected host transport error');
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('host-error');
    if (result.error.kind !== 'host-error') throw new Error('expected host-error');
    expect(result.error.code).toBe('HOST_TRANSPORT');
  });

  it('surfaces OutOfGas as a stable code/tag', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: 'let n = 0; while (true) { n += 1; }' },
      input: BASE_INPUT,
      gasLimit: 50n,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected OOG');
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('out-of-gas');
  });

  it('rejects engine build hash mismatches', async () => {
    await expect(
      evaluate({
        program: { ...BASE_PROGRAM, engineBuildHash: '0'.repeat(64) },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
      }),
    ).rejects.toThrow(/enginebuildhash/i);
  });

  it('rejects gasVersion mismatches', async () => {
    await expect(
      evaluate({
        program: { ...BASE_PROGRAM, gasVersion: 0 },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
      }),
    ).rejects.toThrow(/gasversion/i);
  });

  it('requires engine/gas/profile pins in release mode', async () => {
    await expect(
      evaluate({
        program: BASE_PROGRAM,
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
        releaseMode: true,
      }),
    ).rejects.toThrow(/release-mode requires/i);
  });

  it('requires expectedExecutionProfile in release mode', async () => {
    await expect(
      evaluate({
        program: {
          ...BASE_PROGRAM,
          engineBuildHash: '0'.repeat(64),
          gasVersion: 0,
          executionProfile: 'baseline-v1',
        },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
        releaseMode: true,
      }),
    ).rejects.toThrow(/expectedexecutionprofile/i);
  });

  it('rejects executionProfile pin mismatches when expected profile is provided', async () => {
    await expect(
      evaluate({
        program: { ...BASE_PROGRAM, executionProfile: 'baseline-v1' },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
        expectedExecutionProfile: 'compat-general-v1',
      }),
    ).rejects.toThrow(/executionprofile mismatch/i);
  });

  it('accepts matching expected executionProfile pin', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, executionProfile: 'baseline-v1' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      expectedExecutionProfile: 'baseline-v1',
    });
    expect(result.ok).toBe(true);
  });

  it('returns host-call tape when requested', async () => {
    const result = await evaluate({
      program: BASE_PROGRAM,
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      tape: { capacity: 8 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    const [record] = result.tape ?? [];
    expect(record.fnId).toBe(getFnId('document.get'));
  });

  it('returns gas charge tape when requested', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: '1 + 2' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      gasChargeTape: { capacity: 128 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect((result.gasChargeTape ?? []).length).toBeGreaterThan(0);
  });

  it('tags gas charge tape events for host calls and deterministic JSON', async () => {
    const hostResult = await evaluate({
      program: BASE_PROGRAM,
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      gasChargeTape: { capacity: 256 },
    });
    expect(hostResult.ok).toBe(true);
    if (!hostResult.ok) throw new Error(hostResult.message);
    const hostSiteIds = new Set((hostResult.gasChargeTape ?? []).map((r) => r.siteId));
    expect(hostSiteIds.has(2001)).toBe(true);
    expect(hostSiteIds.has(2002)).toBe(true);
  });

  it('returns gas trace when requested', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: '1 + 2' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      gasTrace: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect((result.gasTrace?.opcodeCount ?? 0n) >= 0n).toBe(true);
  });

  it('tracks host-call gas in the gas trace', async () => {
    const result = await evaluate({
      program: BASE_PROGRAM,
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      gasTrace: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.gasTrace?.hostCallPreCount).toBe(1n);
    expect(result.gasTrace?.hostCallPostCount).toBe(1n);
  });

  it('supports deterministic JSON parse and canonical stringify', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: `JSON.stringify(JSON.parse('{"aa":1,"b":2}'))` },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      gasTrace: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toBe('{"b":2,"aa":1}');
  });

  it('rejects unsupported deterministic JSON options', async () => {
    const cases = [
      { code: `JSON.parse('[]', () => 1)`, message: /reviver is not supported/i },
      { code: `JSON.stringify({ aa: 1, b: 2 }, [])`, message: /replacer is not supported/i },
      { code: `JSON.stringify({ aa: 1, b: 2 }, null, 2)`, message: /space is not supported/i },
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
      if (result.ok) throw new Error('expected deterministic JSON option failure');
      expect(result.message).toMatch(testCase.message);
    }
  });

  it('rejects malformed deterministic JSON strings and keys', async () => {
    const cases = [
      { code: `JSON.parse('"\\ud800"')`, message: /string contains lone surrogate code points/i },
      { code: `JSON.parse('{"\\ud800":1}')`, message: /key contains lone surrogate code points/i },
      { code: `JSON.stringify('\\ud800')`, message: /string contains lone surrogate code points/i },
      {
        code: `(() => { const key = '\\ud800'; return JSON.stringify({ [key]: 1 }); })()`,
        message: /key contains lone surrogate code points/i,
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
      if (result.ok) throw new Error('expected malformed deterministic JSON failure');
      expect(result.message).toMatch(testCase.message);
    }
  });

  it('rejects deeply nested deterministic JSON before parser stack overflow', async () => {
    const depth = 10_000;
    const json = '['.repeat(depth) + '0' + ']'.repeat(depth);
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: `JSON.parse(${JSON.stringify(json)})` },
      input: BASE_INPUT,
      gasLimit: 200_000n,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected deterministic JSON depth failure');
    expect(result.message).toMatch(/maxDepth 64 exceeded/i);
  });

  it('rejects oversized deterministic JSON arrays before building the full parse result', async () => {
    const length = 66_000;
    const json = '[' + '0,'.repeat(length - 1) + '0]';
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: `JSON.parse(${JSON.stringify(json)})` },
      input: BASE_INPUT,
      gasLimit: 2_000_000n,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      gasTrace: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected deterministic JSON array length failure');
    expect(result.message).toMatch(/array length exceeds maxArrayLength/i);
  });

  it('rejects oversized deterministic JSON strings before materializing full tokens', async () => {
    const cases = [
      { code: `JSON.parse('"' + 'a'.repeat(262_145) + '"')`, message: /string exceeds maxStringBytes/i },
      { code: `JSON.parse('{"' + 'a'.repeat(262_145) + '":1}')`, message: /key exceeds maxStringBytes/i },
    ];
    for (const testCase of cases) {
      const result = await evaluate({
        program: { ...BASE_PROGRAM, code: testCase.code },
        input: BASE_INPUT,
        gasLimit: 2_000_000n,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
        gasTrace: true,
      });
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected deterministic JSON string length failure');
      expect(result.message).toMatch(testCase.message);
    }
  });

  it('rejects accessor properties during deterministic JSON stringify', async () => {
    const cases = [
      { code: `JSON.stringify({ get a() { return 1; } })`, message: /accessor properties/i },
      {
        code: `(() => { const arr = [1]; Object.defineProperty(arr, 0, { get() { return 1; }, enumerable: true }); return JSON.stringify(arr); })()`,
        message: /accessor properties/i,
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
      if (result.ok) throw new Error('expected deterministic JSON accessor failure');
      expect(result.message).toMatch(testCase.message);
    }
  });

  it('serializes sparse arrays without consulting the prototype chain', async () => {
    const result = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `(() => {
          let getterCalls = 0;
          Object.defineProperty(Array.prototype, 0, {
            get() { getterCalls += 1; return 1; },
            configurable: true,
          });
          try { return [JSON.stringify([,]), getterCalls]; } finally { delete Array.prototype[0]; }
        })()`,
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toEqual(['[null]', 0]);
  });
});
