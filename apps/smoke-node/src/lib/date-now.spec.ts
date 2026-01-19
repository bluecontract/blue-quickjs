import {
  SMOKE_GAS_LIMIT,
  SMOKE_INPUT,
  SMOKE_MANIFEST,
  SMOKE_PROGRAM,
  createSmokeHost,
} from '@blue-quickjs/test-harness';
import { evaluate } from '@blue-quickjs/quickjs-runtime';

describe('smoke-node clock behavior', () => {
  it('does not patch Date.now when running quickjs-runtime', async () => {
    const originalDateNow = Date.now;

    try {
      const host = createSmokeHost();
      const result = await evaluate({
        program: SMOKE_PROGRAM,
        input: SMOKE_INPUT,
        gasLimit: SMOKE_GAS_LIMIT,
        manifest: SMOKE_MANIFEST,
        handlers: host.handlers,
      });

      expect(result.ok).toBe(true);
      expect(Date.now).toBe(originalDateNow);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
