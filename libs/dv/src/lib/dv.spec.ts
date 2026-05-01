import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  DV,
  DV_LIMIT_DEFAULTS,
  DvError,
  DvErrorCode,
  decodeDv,
  decodeDv2,
  encodeDv,
  encodeDv2,
  isDv,
  isDv2,
  validateDv,
  validateDv2,
} from './dv.js';

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const expectCode = (fn: () => unknown, code: DvErrorCode): void => {
  try {
    fn();
    throw new Error('expected function to throw');
  } catch (err) {
    expect(err).toBeInstanceOf(DvError);
    expect((err as DvError).code).toBe(code);
  }
};

describe('encodeDv / decodeDv', () => {
  it('encodes canonical primitives and examples', () => {
    expect(hex(encodeDv(null))).toBe('f6');
    expect(hex(encodeDv(true))).toBe('f5');
    expect(hex(encodeDv(-1))).toBe('20');
    expect(hex(encodeDv(['hello', 1.5]))).toBe(
      '826568656c6c6ffb3ff8000000000000',
    );
    expect(hex(encodeDv({ b: 2, aa: 1 }))).toBe('a261620262616101');
  });

  it('rejects unsupported JS types and invalid numbers, and canonicalizes -0', () => {
    expectCode(() => encodeDv(Symbol('x')), 'UNSUPPORTED_TYPE');
    expectCode(() => encodeDv(NaN), 'NAN_OR_INF');
    expectCode(() => encodeDv(Number.POSITIVE_INFINITY), 'NAN_OR_INF');
    expectCode(
      () => encodeDv(Number.MAX_SAFE_INTEGER + 1),
      'INTEGER_OUT_OF_RANGE',
    );
    expect(decodeDv(encodeDv(-0))).toBe(0);
  });

  it('enforces depth, size, and string limits', () => {
    expectCode(
      () => encodeDv([[]], { limits: { maxDepth: 1 } }),
      'DEPTH_EXCEEDED',
    );
    expectCode(
      () => encodeDv('aaaa', { limits: { maxStringBytes: 3 } }),
      'STRING_TOO_LONG',
    );
    expectCode(
      () => encodeDv('abcd', { limits: { maxEncodedBytes: 3 } }),
      'ENCODED_TOO_LARGE',
    );
    expectCode(
      () => encodeDv([1, 2], { limits: { maxArrayLength: 1 } }),
      'ARRAY_TOO_LONG',
    );
    expectCode(
      () => encodeDv({ a: 1, b: 2 }, { limits: { maxMapLength: 1 } }),
      'MAP_TOO_LONG',
    );
    expectCode(
      () =>
        decodeDv(Uint8Array.from([0x82, 0x01, 0x02]), {
          limits: { maxArrayLength: 1 },
        }),
      'ARRAY_TOO_LONG',
    );
    expectCode(
      () =>
        decodeDv(Uint8Array.from([0xa2, 0x61, 0x61, 0x01, 0x61, 0x62, 0x02]), {
          limits: { maxMapLength: 1 },
        }),
      'MAP_TOO_LONG',
    );
    expectCode(
      () =>
        decodeDv(Uint8Array.from([0x64, 0x61, 0x62, 0x63, 0x64]), {
          limits: { maxStringBytes: 3 },
        }),
      'STRING_TOO_LONG',
    );
    expectCode(
      () =>
        decodeDv(Uint8Array.from([0x81, 0x80]), { limits: { maxDepth: 1 } }),
      'DEPTH_EXCEEDED',
    );
    expectCode(
      () =>
        decodeDv(Uint8Array.from([0xa1, 0x61, 0x61, 0xa0]), {
          limits: { maxDepth: 1 },
        }),
      'DEPTH_EXCEEDED',
    );
  });

  it('rejects invalid UTF-8 and malformed strings', () => {
    expectCode(() => encodeDv('a\uD800'), 'INVALID_STRING');
    expectCode(() => encodeDv('a\uDC00'), 'INVALID_STRING');
    expectCode(() => decodeDv(Uint8Array.from([0x61])), 'TRUNCATED');
    const invalidBytes = Uint8Array.from([0x62, 0xc3, 0x28]);
    expect(() => decodeDv(invalidBytes)).toThrowError(
      expect.objectContaining({ code: 'INVALID_UTF8' }),
    );
    expectCode(
      () =>
        decodeDv(
          Uint8Array.from([
            0xfb, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ]),
        ),
      'NON_CANONICAL_FLOAT',
    ); // float64 zero must use integer encoding
    expectCode(
      () =>
        decodeDv(
          Uint8Array.from([
            0xfb, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ]),
        ),
      'NON_CANONICAL_FLOAT',
    ); // float64 -0 must canonicalize to +0 integer form
  });

  it('rejects non-canonical or forbidden CBOR encodings', () => {
    expectCode(
      () => decodeDv(Uint8Array.from([0x18, 0x01])),
      'NON_CANONICAL_LENGTH',
    ); // integer 1 using uint8
    expectCode(
      () => decodeDv(Uint8Array.from([0xfa, 0x3f, 0x80, 0x00, 0x00])),
      'NON_CANONICAL_FLOAT',
    ); // float32
    expectCode(
      () =>
        decodeDv(
          Uint8Array.from([
            0xfb, 0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ]),
        ),
      'NON_CANONICAL_FLOAT',
    ); // float64 encoding of integer 1
    expectCode(
      () =>
        decodeDv(
          Uint8Array.from([
            0x3b, 0x00, 0x1f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          ]),
        ),
      'INTEGER_OUT_OF_RANGE',
    ); // -9007199254740992 (one below MIN_SAFE_INTEGER)
    expectCode(() => decodeDv(Uint8Array.from([0x40])), 'UNSUPPORTED_CBOR'); // byte string
    expectCode(
      () =>
        decodeDv(
          Uint8Array.from([0xa2, 0x62, 0x61, 0x61, 0x01, 0x61, 0x62, 0x02]),
        ),
      'KEY_ORDER',
    ); // map keys out of order
    expectCode(
      () =>
        decodeDv(Uint8Array.from([0xa2, 0x61, 0x61, 0x01, 0x61, 0x61, 0x02])),
      'DUPLICATE_KEY',
    );
    expectCode(() => decodeDv(Uint8Array.from([0x9f])), 'NON_CANONICAL_LENGTH');
    expectCode(() => decodeDv(Uint8Array.from([0xe0])), 'UNSUPPORTED_CBOR');
    expectCode(() => decodeDv(Uint8Array.from([0xf0])), 'UNSUPPORTED_CBOR');
    expectCode(
      () => decodeDv(Uint8Array.from([0xf8, 0x00])),
      'NON_CANONICAL_FLOAT',
    );
    expectCode(
      () =>
        decodeDv(
          Uint8Array.from([
            0xfb, 0x7f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ]),
        ),
      'NAN_OR_INF',
    );
    expectCode(() => decodeDv(Uint8Array.from([0xfb, 0x3f])), 'TRUNCATED');
    expectCode(() => decodeDv(Uint8Array.from([0xff])), 'NON_CANONICAL_LENGTH');
    expectCode(() => decodeDv(Uint8Array.from([0xc0])), 'UNSUPPORTED_CBOR');
    expectCode(
      () => decodeDv(Uint8Array.from([0x19, 0x00, 0xff])),
      'NON_CANONICAL_LENGTH',
    );
    expectCode(() => decodeDv(Uint8Array.from([0x19, 0x01])), 'TRUNCATED');
    expectCode(
      () => decodeDv(Uint8Array.from([0x1a, 0x00, 0x00, 0xff, 0xff])),
      'NON_CANONICAL_LENGTH',
    );
    expectCode(
      () => decodeDv(Uint8Array.from([0x1a, 0x00, 0x01])),
      'TRUNCATED',
    );
    expectCode(
      () =>
        decodeDv(
          Uint8Array.from([
            0x1b, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff,
          ]),
        ),
      'NON_CANONICAL_LENGTH',
    );
    expectCode(() => decodeDv(Uint8Array.from([0x1c])), 'UNSUPPORTED_CBOR');
    expectCode(
      () =>
        decodeDv(
          Uint8Array.from([
            0x7b, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ]),
        ),
      'NON_CANONICAL_LENGTH',
    );
    expectCode(
      () => decodeDv(Uint8Array.from([0x1b, 0x00, 0x00, 0x00, 0x00, 0x00])),
      'TRUNCATED',
    );
    expectCode(
      () =>
        decodeDv(
          Uint8Array.from([
            0x3b, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ]),
        ),
      'INTEGER_OUT_OF_RANGE',
    );
    expectCode(
      () =>
        decodeDv(
          Uint8Array.from([
            0x1b, 0x00, 0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          ]),
        ),
      'INTEGER_OUT_OF_RANGE',
    );
    expectCode(
      () => decodeDv(Uint8Array.from([0xa1, 0x01, 0x02])),
      'UNSUPPORTED_CBOR',
    );
  });

  it('supports all canonical CBOR integer and length widths', () => {
    expect(hex(encodeDv(23))).toBe('17');
    expect(hex(encodeDv(24))).toBe('1818');
    expect(hex(encodeDv(256))).toBe('190100');
    expect(hex(encodeDv(65_536))).toBe('1a00010000');
    expect(hex(encodeDv(4_294_967_296))).toBe('1b0000000100000000');
    expect(hex(encodeDv(-24))).toBe('37');
    expect(hex(encodeDv(-25))).toBe('3818');

    expect(decodeDv(Uint8Array.from([0x18, 0x18]))).toBe(24);
    expect(decodeDv(Uint8Array.from([0x19, 0x01, 0x00]))).toBe(256);
    expect(decodeDv(Uint8Array.from([0x1a, 0x00, 0x01, 0x00, 0x00]))).toBe(
      65_536,
    );
    expect(
      decodeDv(
        Uint8Array.from([0x1b, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]),
      ),
    ).toBe(4_294_967_296);
    expect(decodeDv(Uint8Array.from([0x38, 0x18]))).toBe(-25);
  });

  it('accepts ArrayBuffer and offset ArrayBufferView inputs', () => {
    const encoded = encodeDv({ ok: true });
    const buffer = encoded.buffer.slice(0) as ArrayBuffer;
    expect(decodeDv(buffer)).toEqual({ ok: true });

    const padded = Uint8Array.from([0xff, ...encoded, 0xff]);
    const view = new DataView(padded.buffer, 1, encoded.length);
    expect(decodeDv(view)).toEqual({ ok: true });
  });

  it('rejects encoded payloads above maxEncodedBytes before parsing', () => {
    expectCode(
      () =>
        decodeDv(Uint8Array.from([0x01, 0x02]), {
          limits: { maxEncodedBytes: 1 },
        }),
      'ENCODED_TOO_LARGE',
    );
    expectCode(
      () =>
        decodeDv2(Uint8Array.from([0x41, 0x00]), {
          limits: { maxEncodedBytes: 1 },
        }),
      'ENCODED_TOO_LARGE',
    );
  });

  it('validates and narrows DV and DV2 values', () => {
    const dvValue: unknown = { nested: [null, true, 1.25, 'ok'] };
    expect(() => validateDv(dvValue)).not.toThrow();
    expect(isDv(dvValue)).toBe(true);
    expect(isDv({ payload: Uint8Array.from([1]) })).toBe(false);

    const dv2Value: unknown = { payload: Uint8Array.from([1, 2, 3]) };
    expect(() => validateDv2(dv2Value)).not.toThrow();
    expect(isDv2(dv2Value)).toBe(true);
    expect(isDv2({ bad: () => undefined })).toBe(false);
  });

  it('supports byte-string values in DV2 mode', () => {
    const bytes = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);
    expect(hex(encodeDv2(bytes))).toBe('44deadbeef');

    const decoded = decodeDv2(Uint8Array.from([0x44, 0xde, 0xad, 0xbe, 0xef]));
    expect(decoded).toBeInstanceOf(Uint8Array);
    expect(Array.from(decoded as Uint8Array)).toEqual([0xde, 0xad, 0xbe, 0xef]);

    const nested = decodeDv2(
      Uint8Array.from([
        0xa1, 0x65, 0x62, 0x79, 0x74, 0x65, 0x73, 0x44, 0x00, 0x01, 0x02, 0x03,
      ]),
    ) as { bytes: Uint8Array };
    expect(Array.from(nested.bytes)).toEqual([0, 1, 2, 3]);

    expect(isDv2({ payload: bytes })).toBe(true);
    expect(isDv({ payload: bytes })).toBe(false);
  });

  it('keeps DV1 byte strings unsupported and enforces DV2 byte limits', () => {
    expectCode(() => encodeDv(Uint8Array.from([1, 2, 3])), 'UNSUPPORTED_TYPE');
    expectCode(
      () => decodeDv(Uint8Array.from([0x41, 0x01])),
      'UNSUPPORTED_CBOR',
    );
    expectCode(
      () =>
        encodeDv2(Uint8Array.from([1, 2, 3]), {
          limits: { maxByteStringBytes: 2 },
        }),
      'BYTE_STRING_TOO_LONG',
    );
    expectCode(
      () =>
        decodeDv2(Uint8Array.from([0x43, 0x01, 0x02, 0x03]), {
          limits: { maxByteStringBytes: 2 },
        }),
      'BYTE_STRING_TOO_LONG',
    );
  });

  it('roundtrips and canonicalizes under property-based generation', () => {
    const limits = {
      maxDepth: 4,
      maxArrayLength: 6,
      maxMapLength: 6,
      maxStringBytes: 64,
      maxEncodedBytes: DV_LIMIT_DEFAULTS.maxEncodedBytes,
    };

    const stringArb = fc
      .array(fc.integer({ min: 0x20, max: 0x7e }), { maxLength: 16 })
      .map((codes) => String.fromCharCode(...codes));
    const floatArb = fc
      .double({ min: -1e6, max: 1e6, noDefaultInfinity: true, noNaN: true })
      .filter((n) => !Number.isInteger(n));

    const primitive = fc.oneof(
      fc.constant(null),
      fc.boolean(),
      fc.integer({ min: -1_000, max: 1_000 }),
      floatArb,
      stringArb,
    );

    const dvMemo = (depth: number): fc.Arbitrary<DV> =>
      depth <= 0
        ? primitive
        : fc.oneof(
            primitive,
            fc.array(dvMemo(depth - 1), { maxLength: 4 }),
            fc.dictionary(stringArb, dvMemo(depth - 1), { maxKeys: 4 }),
          );

    const dvArb: fc.Arbitrary<DV> = dvMemo(3);

    fc.assert(
      fc.property(dvArb, (value) => {
        const encoded = encodeDv(value, { limits });
        const decoded = decodeDv(encoded, { limits });
        expect(isDv(decoded, { limits: DV_LIMIT_DEFAULTS })).toBe(true);
        const reencoded = encodeDv(decoded, { limits });
        expect(hex(encoded)).toBe(hex(reencoded));
      }),
      { numRuns: 150 },
    );
  });

  it('roundtrips DV2 values containing byte strings', () => {
    const value = {
      kind: 'bytes',
      payload: Uint8Array.from([1, 2, 3, 4]),
      nested: [Uint8Array.from([9, 8]), { ok: true }],
    };
    const encoded = encodeDv2(value);
    const decoded = decodeDv2(encoded) as {
      kind: string;
      payload: Uint8Array;
      nested: [Uint8Array, { ok: boolean }];
    };

    expect(decoded.kind).toBe('bytes');
    expect(Array.from(decoded.payload)).toEqual([1, 2, 3, 4]);
    expect(Array.from(decoded.nested[0])).toEqual([9, 8]);
    expect(decoded.nested[1]).toEqual({ ok: true });
    expect(hex(encodeDv2(decoded))).toBe(hex(encoded));
  });
});
