import { evaluate } from '@blue-quickjs/quickjs-runtime';
import { MODULE_PACK_FIXTURES } from '@blue-quickjs/test-harness';
import { hashDv, hashTape } from './app/hash-utils.js';

type ModulePackFixtureSnapshot = {
  ok: boolean;
  valueHash: string | null;
  errorCode: string | null;
  errorTag: string | null;
  gasUsed: string;
  gasRemaining: string;
  tapeHash: string | null;
  tapeLength: number;
};

type ModulePackFixtureResult = {
  name: string;
  expectedOk: boolean;
  actual: ModulePackFixtureSnapshot;
};

declare global {
  interface Window {
    __MODULE_PACK_FIXTURE_RESULTS__?: ModulePackFixtureResult[];
  }
}

renderShell();
void run();

function renderShell(): void {
  const app = document.querySelector<HTMLElement>('[data-app]');
  if (!app) {
    return;
  }
  app.innerHTML = `
    <h1>Module-pack fixture parity</h1>
    <p data-runstate="running">Running…</p>
    <pre data-result>waiting…</pre>
  `;
}

async function run(): Promise<void> {
  const runstate = document.querySelector<HTMLElement>('[data-runstate]');
  const resultEl = document.querySelector<HTMLElement>('[data-result]');

  try {
    const results: ModulePackFixtureResult[] = [];

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

      const tape = result.tape ?? [];
      const snapshot: ModulePackFixtureSnapshot = {
        ok: result.ok,
        valueHash: result.ok ? await hashDv(result.value) : null,
        errorCode: result.ok ? null : result.error.code,
        errorTag: result.ok
          ? null
          : 'tag' in result.error
            ? result.error.tag
            : null,
        gasUsed: result.gasUsed.toString(),
        gasRemaining: result.gasRemaining.toString(),
        tapeHash: await hashTape(tape),
        tapeLength: tape.length,
      };

      results.push({
        name: fixture.name,
        expectedOk: fixture.expected.ok,
        actual: snapshot,
      });
    }

    window.__MODULE_PACK_FIXTURE_RESULTS__ = results;
    if (runstate) {
      runstate.dataset.runstate = 'done';
      runstate.textContent = 'Done';
    }
    if (resultEl) {
      resultEl.textContent = JSON.stringify(results, null, 2);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    window.__MODULE_PACK_FIXTURE_RESULTS__ = [];
    if (runstate) {
      runstate.dataset.runstate = 'error';
      runstate.textContent = `Error: ${message}`;
    }
    if (resultEl) {
      resultEl.textContent = message;
    }
  }
}
