import { HOST_V1_HASH, HOST_V1_MANIFEST } from '@blue-quickjs/abi-manifest';
import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import { evaluate } from './evaluate.js';
import type { HostDispatcherHandlers } from './host-dispatcher.js';
import type {
  InputEnvelope,
  ProgramArtifact,
  ProgramArtifactV2,
} from './quickjs-runtime.js';

const TEST_GAS_LIMIT = 50_000n;

const BASE_PROGRAM: ProgramArtifact = {
  code: 'document("path/to/doc")',
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
};

const BASE_PROGRAM_V2_SCRIPT: ProgramArtifactV2 = {
  version: 2,
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
  executionProfile: 'baseline-v1',
  sourceKind: 'script',
  source: {
    code: 'document("path/to/doc")',
  },
};

const BASE_INPUT: InputEnvelope = {
  event: { type: 'create', payload: { id: 1 } },
  eventCanonical: { type: 'create', payload: { id: 1 } },
  steps: [{ name: 'first' }],
  currentContract: { id: 'contract-1' },
  currentContractCanonical: { id: { value: 'contract-1' } },
};

describe('evaluate', () => {
  it('evaluates raw script mode using final expression result', async () => {
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: 'const n = 2; n + 3' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.value).toBe(5);
  });

  it('evaluates ProgramArtifact.v2 script source', async () => {
    const result = await evaluate({
      program: {
        ...BASE_PROGRAM_V2_SCRIPT,
        source: {
          code: 'const n = 10; n + 4;',
        },
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.value).toBe(14);
  });

  it('evaluates ProgramArtifact.v2 module-pack default export', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      modules: [
        {
          specifier: './entry.js',
          source: 'export default 1;\n',
        },
      ],
    });

    const result = await evaluate({
      program: {
        ...BASE_PROGRAM_V2_SCRIPT,
        sourceKind: 'module-pack',
        source: {
          modulePack,
        },
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.value).toBe(1);
  });

  it('evaluates module-pack entryExport for named exports', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      entryExport: 'answer',
      modules: [
        {
          specifier: './entry.js',
          source: 'export const answer = 42;\n',
        },
      ],
    });

    const result = await evaluate({
      program: {
        ...BASE_PROGRAM_V2_SCRIPT,
        sourceKind: 'module-pack',
        source: {
          modulePack,
        },
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.value).toBe(42);
  });

  it('evaluates cyclic module-pack imports deterministically', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      modules: [
        {
          specifier: './entry.js',
          source:
            "import { valueFromA } from './b.js'; export default valueFromA;\n",
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
      program: {
        ...BASE_PROGRAM_V2_SCRIPT,
        sourceKind: 'module-pack',
        source: {
          modulePack,
        },
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.value).toBe(42);
  });

  it('maps missing entry module to deterministic module-pack error', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './missing.js',
      modules: [
        {
          specifier: './entry.js',
          source: 'export default 1;\n',
        },
      ],
    });

    const result = await evaluate({
      program: {
        ...BASE_PROGRAM_V2_SCRIPT,
        sourceKind: 'module-pack',
        source: {
          modulePack,
        },
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected module-pack failure');
    }
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('module-pack');
    if (result.error.kind !== 'module-pack') {
      throw new Error('expected module-pack error kind');
    }
    expect(result.error.code).toBe('MODULE_SPECIFIER_NOT_FOUND');
  });

  it('maps missing module export to deterministic module-pack error', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      entryExport: 'missing',
      modules: [
        {
          specifier: './entry.js',
          source: 'export const value = 1;\n',
        },
      ],
    });

    const result = await evaluate({
      program: {
        ...BASE_PROGRAM_V2_SCRIPT,
        sourceKind: 'module-pack',
        source: {
          modulePack,
        },
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected module-pack failure');
    }
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('module-pack');
    if (result.error.kind !== 'module-pack') {
      throw new Error('expected module-pack error kind');
    }
    expect(result.error.code).toBe('MODULE_EXPORT_MISSING');
  });

  it('rejects module-pack artifacts with graph hash mismatch', async () => {
    const modulePack = createModulePack({
      entrySpecifier: './entry.js',
      modules: [
        {
          specifier: './entry.js',
          source: 'export default 1;\n',
        },
      ],
    });

    await expect(
      evaluate({
        program: {
          ...BASE_PROGRAM_V2_SCRIPT,
          sourceKind: 'module-pack',
          source: {
            modulePack: {
              ...modulePack,
              graphHash:
                'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            },
          },
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
    if (result.ok) {
      throw new Error('expected vm failure');
    }
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('execution-surface-mismatch');
    expect(result.error.code).toBe('EXECUTION_SURFACE_MISMATCH');
    expect(result.error.tag).toBe('vm/execution_surface');
    expect(result.error.message).toMatch(/return/i);
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
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.value).toEqual({ status: 'ok' });
    expect(handlers.emit).toHaveBeenCalledTimes(1);
    expect(handlers.emit).toHaveBeenCalledWith({ marker: 'raw-script' });
  });

  it('keeps RegExp disabled in baseline profile and allows compat-regexp profile', async () => {
    const baseline = await evaluate({
      program: { ...BASE_PROGRAM, code: '/a/.test("a")' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(baseline.ok).toBe(false);
    if (baseline.ok) {
      throw new Error('expected baseline regexp failure');
    }
    expect(baseline.type).toBe('vm-error');
    expect(baseline.error.kind).toBe('js-exception');
    expect(baseline.message).toMatch(/regexp is disabled/i);

    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: '/a/.test("a")',
        executionProfile: 'compat-regexp-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(compat.ok).toBe(true);
    if (!compat.ok) {
      throw new Error(compat.message);
    }
    expect(compat.value).toBe(true);
  });

  it('keeps Promise disabled in baseline profile and drains Promise jobs for compat-general', async () => {
    const baseline = await evaluate({
      program: { ...BASE_PROGRAM, code: 'Promise.resolve(1)' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(baseline.ok).toBe(false);
    if (baseline.ok) {
      throw new Error('expected baseline Promise failure');
    }
    expect(baseline.type).toBe('vm-error');
    expect(baseline.error.kind).toBe('js-exception');
    expect(baseline.message).toMatch(/promise is disabled/i);

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
    if (!compat.ok) {
      throw new Error(compat.message);
    }
    expect(compat.value).toBe(42);
  });

  it('runs queueMicrotask deterministically in compat-general profile', async () => {
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `
          (() => {
            const events = [];
            queueMicrotask(() => events.push('first'));
            queueMicrotask(() => events.push('second'));
            return Promise.resolve().then(() => events.join(','));
          })()
        `,
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(compat.ok).toBe(true);
    if (!compat.ok) {
      throw new Error(compat.message);
    }
    expect(compat.value).toBe('first,second');
  });

  it('routes compat-general console shim calls through Host.v1.emit', async () => {
    const handlers = createHandlers();
    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `
          (() => {
            console.log('hello', 7);
            return null;
          })()
        `,
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers,
    });

    expect(compat.ok).toBe(true);
    if (!compat.ok) {
      throw new Error(compat.message);
    }
    expect(compat.value).toBeNull();
    expect(handlers.emit).toHaveBeenCalledWith({
      type: 'console',
      level: 'log',
      args: ['hello', 7],
    });
  });

  it('keeps sort disabled in baseline and enables stable sort in compat-general', async () => {
    const baseline = await evaluate({
      program: { ...BASE_PROGRAM, code: '[3, 1, 2].sort()' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(baseline.ok).toBe(false);
    if (baseline.ok) {
      throw new Error('expected baseline sort failure');
    }
    expect(baseline.type).toBe('vm-error');
    expect(baseline.error.kind).toBe('js-exception');
    expect(baseline.message).toMatch(/sort is disabled/i);

    const compat = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `
          (() => {
            const records = [
              { id: 'a', group: 1 },
              { id: 'b', group: 1 },
              { id: 'c', group: 2 },
              { id: 'd', group: 1 },
            ];
            records.sort((left, right) => left.group - right.group);
            return records.map((record) => record.id).join(',');
          })()
        `,
        executionProfile: 'compat-general-v1',
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(compat.ok).toBe(true);
    if (!compat.ok) {
      throw new Error(compat.message);
    }
    expect(compat.value).toBe('a,b,d,c');
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
    if (!result.ok) {
      throw new Error(result.message);
    }

    expect(result.value).toEqual({ path: 'path/to/doc' });
    expect(typeof result.gasUsed).toBe('bigint');
    expect(typeof result.gasRemaining).toBe('bigint');
    expect(handlers.document.get).toHaveBeenCalledTimes(1);
  });

  it('maps VM errors to a structured failure', async () => {
    const handlers = createHandlers();
    const result = await evaluate({
      program: { ...BASE_PROGRAM, code: 'document(123)' },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected VM failure');
    }
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('js-exception');
    expect(result.error.code).toBe('JS_EXCEPTION');
    expect(result.error.message).toMatch(/document/i);
    expect(handlers.document.get).not.toHaveBeenCalled();
  });

  it('rejects unsupported return types at the VM boundary', async () => {
    const unsupported = ['undefined', '(() => {})', 'Symbol("x")', '1n'];

    for (const code of unsupported) {
      const result = await evaluate({
        program: { ...BASE_PROGRAM, code },
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('expected VM failure');
      }
      expect(result.type).toBe('vm-error');
      expect(result.error.kind).toBe('js-exception');
    }
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
    if (result.ok) {
      throw new Error('expected invalid output');
    }

    expect(result.type).toBe('invalid-output');
    expect(result.error.code).toBe('INVALID_OUTPUT');
    expect(result.message).toMatch(/payload exceeds/i);
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
    if (result.ok) {
      throw new Error('expected host error');
    }

    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('host-error');
    if (result.error.kind !== 'host-error') {
      throw new Error('expected host-error');
    }
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.tag).toBe('host/not_found');
  });

  it('maps host transport failures to a stable code/tag', async () => {
    const handlers = createHandlers({
      document: {
        get: vi.fn(
          () =>
            ({
              ok: { path: 'path/to/doc' },
            }) as unknown as ReturnType<
              HostDispatcherHandlers['document']['get']
            >,
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
    if (result.ok) {
      throw new Error('expected host transport error');
    }

    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('host-error');
    if (result.error.kind !== 'host-error') {
      throw new Error('expected host-error');
    }
    expect(result.error.code).toBe('HOST_TRANSPORT');
    expect(result.error.tag).toBe('host/transport');
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
    if (result.ok) {
      throw new Error('expected OOG');
    }

    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('out-of-gas');
    if (result.error.kind !== 'out-of-gas') {
      throw new Error('expected out-of-gas');
    }
    expect(result.error.code).toBe('OOG');
    expect(result.error.tag).toBe('vm/out_of_gas');
  });

  it('rejects engine build hash mismatches', async () => {
    const program: ProgramArtifact = {
      ...BASE_PROGRAM,
      engineBuildHash: '0'.repeat(64),
    };

    await expect(
      evaluate({
        program,
        input: BASE_INPUT,
        gasLimit: TEST_GAS_LIMIT,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
      }),
    ).rejects.toThrow(/enginebuildhash/i);
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
    if (!result.ok) {
      throw new Error(result.message);
    }

    expect(result.tape).toBeDefined();
    expect(result.tape?.length).toBeGreaterThan(0);
    const [record] = result.tape ?? [];
    expect(record.fnId).toBe(getFnId('document.get'));
    expect(typeof record.gasPre).toBe('bigint');
    expect(typeof record.gasPost).toBe('bigint');
    expect(record.reqHash).toHaveLength(64);
    expect(record.respHash).toHaveLength(64);
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
    if (!result.ok) {
      throw new Error(result.message);
    }

    expect(result.gasTrace).toBeDefined();
    expect((result.gasTrace?.opcodeCount ?? 0n) >= 0n).toBe(true);
    expect((result.gasTrace?.allocationBytes ?? 0n) >= 0n).toBe(true);
    expect((result.gasTrace?.jsonParseCount ?? 0n) >= 0n).toBe(true);
    expect((result.gasTrace?.jsonStringifyCount ?? 0n) >= 0n).toBe(true);
  });

  it('supports deterministic JSON parse and canonical stringify', async () => {
    const result = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `JSON.stringify(JSON.parse('{"aa":1,"b":2}'))`,
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      gasTrace: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }

    expect(result.value).toBe('{"b":2,"aa":1}');
    expect((result.gasTrace?.jsonParseCount ?? 0n) > 0n).toBe(true);
    expect((result.gasTrace?.jsonStringifyCount ?? 0n) > 0n).toBe(true);
  });

  it('rejects unsupported deterministic JSON options', async () => {
    const cases = [
      {
        code: `JSON.parse('[]', () => 1)`,
        message: /reviver is not supported/i,
      },
      {
        code: `JSON.stringify({ aa: 1, b: 2 }, [])`,
        message: /replacer is not supported/i,
      },
      {
        code: `JSON.stringify({ aa: 1, b: 2 }, null, 2)`,
        message: /space is not supported/i,
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
      if (result.ok) {
        throw new Error('expected deterministic JSON option failure');
      }
      expect(result.type).toBe('vm-error');
      expect(result.error.kind).toBe('js-exception');
      expect(result.message).toMatch(testCase.message);
    }
  });

  it('rejects malformed deterministic JSON strings and keys', async () => {
    const cases = [
      {
        code: `JSON.parse('"\\ud800"')`,
        message: /string contains lone surrogate code points/i,
      },
      {
        code: `JSON.parse('{"\\ud800":1}')`,
        message: /key contains lone surrogate code points/i,
      },
      {
        code: `JSON.stringify('\\ud800')`,
        message: /string contains lone surrogate code points/i,
      },
      {
        code: `(() => {
          const key = '\\ud800';
          return JSON.stringify({ [key]: 1 });
        })()`,
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
      if (result.ok) {
        throw new Error('expected malformed deterministic JSON failure');
      }
      expect(result.type).toBe('vm-error');
      expect(result.error.kind).toBe('js-exception');
      expect(result.message).toMatch(testCase.message);
    }
  });

  it('rejects deeply nested deterministic JSON before parser stack overflow', async () => {
    const depth = 10_000;
    const json = '['.repeat(depth) + '0' + ']'.repeat(depth);
    const result = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `JSON.parse(${JSON.stringify(json)})`,
      },
      input: BASE_INPUT,
      gasLimit: 200_000n,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected deterministic JSON depth failure');
    }
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('js-exception');
    expect(result.message).toMatch(/maxDepth 64 exceeded/i);
  });

  it('rejects oversized deterministic JSON arrays before building the full parse result', async () => {
    const length = 66_000;
    const json = '[' + '0,'.repeat(length - 1) + '0]';
    const result = await evaluate({
      program: {
        ...BASE_PROGRAM,
        code: `JSON.parse(${JSON.stringify(json)})`,
      },
      input: BASE_INPUT,
      gasLimit: 2_000_000n,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
      gasTrace: true,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected deterministic JSON array length failure');
    }
    expect(result.type).toBe('vm-error');
    expect(result.error.kind).toBe('js-exception');
    expect(result.message).toMatch(
      /array length exceeds maxArrayLength \(\d+ > 65535\)/i,
    );
    expect((result.gasTrace?.allocationBytes ?? 0n) < 3_500_000n).toBe(true);
  });

  it('rejects oversized deterministic JSON strings before materializing full tokens', async () => {
    const cases = [
      {
        code: `JSON.parse('"' + 'a'.repeat(262_145) + '"')`,
        message: /string exceeds maxStringBytes \(\d+ > 262144\)/i,
      },
      {
        code: `JSON.parse('{"' + 'a'.repeat(262_145) + '":1}')`,
        message: /key exceeds maxStringBytes \(\d+ > 262144\)/i,
      },
    ];

    for (const testCase of cases) {
      const result = await evaluate({
        program: {
          ...BASE_PROGRAM,
          code: testCase.code,
        },
        input: BASE_INPUT,
        gasLimit: 2_000_000n,
        manifest: HOST_V1_MANIFEST,
        handlers: createHandlers(),
        gasTrace: true,
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('expected deterministic JSON string length failure');
      }
      expect(result.type).toBe('vm-error');
      expect(result.error.kind).toBe('js-exception');
      expect(result.message).toMatch(testCase.message);
      expect((result.gasTrace?.allocationBytes ?? 0n) < 1_800_000n).toBe(true);
    }
  });

  it('rejects accessor properties during deterministic JSON stringify', async () => {
    const cases = [
      {
        code: `JSON.stringify({ get a() { return 1; } })`,
        message: /accessor properties/i,
      },
      {
        code: `(() => {
          const arr = [1];
          Object.defineProperty(arr, 0, {
            get() {
              return 1;
            },
            enumerable: true,
          });
          return JSON.stringify(arr);
        })()`,
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
      if (result.ok) {
        throw new Error('expected deterministic JSON accessor failure');
      }
      expect(result.type).toBe('vm-error');
      expect(result.error.kind).toBe('js-exception');
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
            get() {
              getterCalls += 1;
              return 1;
            },
            configurable: true,
          });
          try {
            return [JSON.stringify([,]), getterCalls];
          } finally {
            delete Array.prototype[0];
          }
        })()`,
      },
      input: BASE_INPUT,
      gasLimit: TEST_GAS_LIMIT,
      manifest: HOST_V1_MANIFEST,
      handlers: createHandlers(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }

    expect(result.value).toEqual(['[null]', 0]);
  });
});

function createHandlers(
  overrides?: Partial<{
    document: Partial<HostDispatcherHandlers['document']>;
    emit: HostDispatcherHandlers['emit'];
  }>,
): HostDispatcherHandlers {
  return {
    document: {
      get:
        overrides?.document?.get ??
        vi.fn((path: string) => ({ ok: { path }, units: 5 })),
      getCanonical:
        overrides?.document?.getCanonical ??
        vi.fn((path: string) => ({ ok: { canonical: path }, units: 3 })),
    },
    emit:
      overrides?.emit ??
      vi.fn(() => ({
        ok: null,
        units: 1,
      })),
  };
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

function createModulePack(options: {
  entrySpecifier: string;
  modules: Array<{ specifier: string; source: string; sourceMap?: string }>;
  entryExport?: string;
}) {
  const base = {
    version: 1 as const,
    entrySpecifier: options.entrySpecifier,
    ...(options.entryExport ? { entryExport: options.entryExport } : {}),
    modules: options.modules,
    builderVersion: 'deterministic-builder-v1',
    dependencyIntegrity:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  };
  const canonical = {
    version: base.version,
    entrySpecifier: base.entrySpecifier,
    entryExport: base.entryExport ?? 'default',
    modules: [...base.modules]
      .sort((left, right) => left.specifier.localeCompare(right.specifier))
      .map((module) => ({
        specifier: module.specifier,
        source: module.source,
        ...(module.sourceMap ? { sourceMap: module.sourceMap } : {}),
      })),
    builderVersion: base.builderVersion,
    dependencyIntegrity: base.dependencyIntegrity,
  };
  const graphHash = createHash('sha256')
    .update(stableStringify(canonical), 'utf8')
    .digest('hex');
  return {
    ...base,
    graphHash,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}
