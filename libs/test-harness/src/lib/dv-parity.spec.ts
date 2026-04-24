import { decodeDv, encodeDv } from '@blue-quickjs/dv';
import {
  hasBuiltNativeHarness,
  runNativeHarness,
} from './native-harness-test-utils.js';

interface EncodeFixture {
  name: string;
  expr: string;
  value: unknown;
}

interface ErrorFixture {
  name: string;
  expr?: string;
  hex?: string;
  value?: unknown;
  errorContains: string;
}

const encodeFixtures: EncodeFixture[] = [
  { name: 'null', expr: 'null', value: null },
  { name: 'boolean', expr: 'true', value: true },
  { name: 'int', expr: '42', value: 42 },
  { name: 'negative-int', expr: '-17', value: -17 },
  { name: 'float', expr: '1.5', value: 1.5 },
  { name: 'string', expr: '"hello"', value: 'hello' },
  { name: 'string-null-byte', expr: '"a\\u0000b"', value: 'a\u0000b' },
  { name: 'unicode', expr: '"\\u263a"', value: '\u263a' },
  { name: 'array', expr: '["hello", 1.5, -1]', value: ['hello', 1.5, -1] },
  {
    name: 'object-ordering',
    expr: '({ b: 2, aa: 1 })',
    value: { b: 2, aa: 1 },
  },
  {
    name: 'null-proto-object',
    expr: '(() => { const o = Object.create(null); o.a = 1; o.b = "c"; return o; })()',
    value: Object.assign(Object.create(null), { a: 1, b: 'c' }),
  },
  {
    name: 'nested',
    expr: '({ nested: [1, { z: "hi" }], flag: false })',
    value: { nested: [1, { z: 'hi' }], flag: false },
  },
  {
    name: 'object-global-object-replacement',
    expr: '(() => { function Fake() {} Fake.prototype = { hacked: true }; globalThis.Object = Fake; return { a: 1 }; })()',
    value: { a: 1 },
  },
  {
    name: 'emoji-non-bmp',
    expr: '"\\uD83D\\uDE00"',
    value: '\uD83D\uDE00',
  },
  { name: 'empty-array', expr: '[]', value: [] },
  { name: 'empty-object', expr: '({})', value: {} },
  { name: 'negative-zero', expr: '-0', value: -0 },
];

const encodeErrorFixtures: ErrorFixture[] = [
  {
    name: 'encode-lone-surrogate',
    expr: '"a\\uD800"',
    value: 'a\uD800',
    errorContains: 'lone surrogate code points',
  },
];

const decodeErrorFixtures: ErrorFixture[] = [
  {
    name: 'decode-non-canonical-int-width',
    hex: '1801',
    errorContains: 'length not using shortest encoding',
  },
  {
    name: 'decode-float32',
    hex: 'fa3f800000',
    errorContains: 'only float64 is allowed',
  },
  {
    name: 'decode-byte-string',
    hex: '40',
    errorContains: 'unsupported CBOR major type',
  },
  {
    name: 'decode-trailing-bytes',
    hex: 'f6f6',
    errorContains: 'unexpected trailing bytes after DV value',
  },
  {
    name: 'decode-non-text-map-key',
    hex: 'a10101',
    errorContains: 'map keys must be text strings',
  },
  {
    name: 'decode-map-key-order',
    hex: 'a262616101616202',
    errorContains: 'map keys are not in canonical order',
  },
];

describe('dv parity', () => {
  it('has a built native harness available', () => {
    expect(hasBuiltNativeHarness()).toBe(true);
  });

  test.each(encodeFixtures)('$name encodes identically to the TS reference', ({
    expr,
    value,
  }) => {
    const expectedHex = bytesToHex(encodeDv(value));
    const result = runNativeHarness(['--dv-encode', '--eval', expr]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.startsWith('DV ')).toBe(true);
    expect(result.stdout.slice('DV '.length)).toBe(expectedHex);
  });

  test.each(encodeFixtures)('$name decodes identically to the TS reference', ({
    value,
  }) => {
    const encoded = encodeDv(value);
    const result = runNativeHarness([
      '--dv-decode',
      bytesToHex(encoded),
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.startsWith('DVRESULT ')).toBe(true);
    expect(result.stdout.slice('DVRESULT '.length)).toBe(
      JSON.stringify(decodeDv(encoded)),
    );
  });

  test.each(encodeErrorFixtures)(
    '$name rejects invalid values during encode',
    ({ expr, value, errorContains }) => {
      expect(() => encodeDv(value)).toThrowError(new RegExp(errorContains));

      const result = runNativeHarness(['--dv-encode', '--eval', expr!]);
      expect(result.status).not.toBe(0);
      expect(result.stdout.startsWith('ERROR ')).toBe(true);
      expect(result.stdout).toContain(errorContains);
    },
  );

  test.each(decodeErrorFixtures)(
    '$name rejects invalid bytes during decode',
    ({ hex, errorContains }) => {
      expect(() => decodeDv(Buffer.from(hex!, 'hex'))).toThrowError(
        new RegExp(errorContains),
      );

      const result = runNativeHarness(['--dv-decode', hex!]);
      expect(result.status).not.toBe(0);
      expect(result.stdout.startsWith('ERROR ')).toBe(true);
      expect(result.stdout).toContain(errorContains);
    },
  );
});

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
