import { evaluate } from '@blue-quickjs/quickjs-runtime';
import {
  CHESS_E2E6_EXPECTED_LEGAL,
  CHESS_LIBRARY_GAS_LIMIT,
  CHESS_LIBRARY_INPUT,
  CHESS_LIBRARY_MANIFEST,
  CHESS_LIBRARY_PROGRAM_BASE,
  createDeterminismHost,
} from '@blue-quickjs/test-harness';

type ChessReuseResult = {
  ok: boolean;
  value: boolean | null;
  gasUsed: string;
  gasRemaining: string;
  errorCode: string | null;
  errorTag: string | null;
};

declare global {
  interface Window {
    __CHESS_BUNDLED_CODE__?: string;
    __CHESS_LIBRARY_REUSE_RESULT__?: ChessReuseResult;
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
    <h1>Chess.js deterministic reuse</h1>
    <p>Expected e2e6 legal: <strong>${String(CHESS_E2E6_EXPECTED_LEGAL)}</strong></p>
    <p data-runstate="running">Running…</p>
    <pre data-result>waiting…</pre>
  `;
}

async function run(): Promise<void> {
  const runstate = document.querySelector<HTMLElement>('[data-runstate]');
  const resultEl = document.querySelector<HTMLElement>('[data-result]');

  try {
    const code = window.__CHESS_BUNDLED_CODE__;
    if (typeof code !== 'string' || code.length === 0) {
      throw new Error(
        'Missing bundled chess code in window.__CHESS_BUNDLED_CODE__',
      );
    }

    const host = createDeterminismHost();
    const result = await evaluate({
      program: {
        ...CHESS_LIBRARY_PROGRAM_BASE,
        code,
      },
      input: CHESS_LIBRARY_INPUT,
      gasLimit: CHESS_LIBRARY_GAS_LIMIT,
      manifest: CHESS_LIBRARY_MANIFEST,
      handlers: host.handlers,
    });

    const payload: ChessReuseResult = result.ok
      ? {
          ok: true,
          value: result.value as boolean,
          gasUsed: result.gasUsed.toString(),
          gasRemaining: result.gasRemaining.toString(),
          errorCode: null,
          errorTag: null,
        }
      : {
          ok: false,
          value: null,
          gasUsed: result.gasUsed.toString(),
          gasRemaining: result.gasRemaining.toString(),
          errorCode: result.error.code,
          errorTag: 'tag' in result.error ? result.error.tag : null,
        };

    window.__CHESS_LIBRARY_REUSE_RESULT__ = payload;
    if (runstate) {
      runstate.dataset.runstate = 'done';
      runstate.textContent = payload.ok ? 'Done' : 'Failed';
    }
    if (resultEl) {
      resultEl.textContent = JSON.stringify(payload, null, 2);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    window.__CHESS_LIBRARY_REUSE_RESULT__ = {
      ok: false,
      value: null,
      gasUsed: '0',
      gasRemaining: '0',
      errorCode: 'BOOT_FAILURE',
      errorTag: null,
    };
    if (runstate) {
      runstate.dataset.runstate = 'error';
      runstate.textContent = `Error: ${message}`;
    }
    if (resultEl) {
      resultEl.textContent = message;
    }
  }
}
