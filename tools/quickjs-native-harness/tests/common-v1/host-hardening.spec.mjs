import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('deterministic runtime Host hardening', () => {
  it('prevents extensions on Host and Host.v1', () => {
    expectHarnessOutput(
      'Host immutability',
      `(() => {
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
        return {
          sameRef: before === after,
          hasV1: !!after.v1,
          added,
          protoNull: Object.getPrototypeOf(Host) === null,
          v1ProtoNull: Object.getPrototypeOf(Host.v1) === null,
          hostIsExtensible: Object.isExtensible(Host),
          hostV1Extensible: Object.isExtensible(Host.v1),
        };
      })()`,
      'RESULT {"sameRef":true,"hasV1":true,"added":false,"protoNull":true,"v1ProtoNull":true,"hostIsExtensible":false,"hostV1Extensible":false}',
    );
  });
});
