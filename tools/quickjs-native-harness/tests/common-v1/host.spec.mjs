import { describe, it } from 'vitest';
import { expectHarnessOutput } from '../helpers/harness.mjs';

describe('deterministic runtime Host bootstrap', () => {
  it('installs Host and Host.v1 as null-prototype globals', () => {
    expectHarnessOutput(
      'Host descriptor',
      `(() => {
        const desc = Object.getOwnPropertyDescriptor(globalThis, 'Host');
        const v1 = Host && Host.v1;
        return {
          configurable: desc ? desc.configurable : null,
          enumerable: desc ? desc.enumerable : null,
          writable: desc ? desc.writable : null,
          hostType: typeof Host,
          hostNullProto: Host ? Object.getPrototypeOf(Host) === null : null,
          v1Type: typeof v1,
          v1NullProto: v1 ? Object.getPrototypeOf(v1) === null : null
        };
      })()`,
      'RESULT {"configurable":false,"enumerable":false,"writable":false,"hostType":"object","hostNullProto":true,"v1Type":"object","v1NullProto":true}',
    );
  });
});
