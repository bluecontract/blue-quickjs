import { MODULE_PACK_FIXTURES } from '@blue-quickjs/test-harness';
import { evaluate } from '@blue-quickjs/quickjs-runtime';

describe('smoke-node module-pack fixtures', () => {
  it('executes module-pack fixtures with expected outcomes', async () => {
    for (const fixture of MODULE_PACK_FIXTURES) {
      const host = fixture.createHost();
      const result = await evaluate({
        program: fixture.program,
        input: fixture.input,
        gasLimit: fixture.gasLimit,
        manifest: fixture.manifest,
        handlers: host.handlers,
        tape: { capacity: 16 },
      });

      expect(result.ok).toBe(fixture.expected.ok);

      if (fixture.expected.ok) {
        if (!result.ok) {
          throw new Error(
            `${fixture.name} expected success, got error ${result.error.code}`,
          );
        }
        expect(result.value).toEqual(fixture.expected.value);
      } else {
        if (result.ok) {
          throw new Error(`${fixture.name} expected failure`);
        }
        expect(result.error.code).toBe(fixture.expected.errorCode);
        expect('tag' in result.error ? result.error.tag : null).toBe(
          fixture.expected.errorTag,
        );
      }
    }
  });
});
