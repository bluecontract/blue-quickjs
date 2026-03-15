import { evaluate } from '@blue-quickjs/quickjs-runtime';
import {
  BINARY_LIBRARY_GAS_LIMIT,
  BINARY_LIBRARY_INPUT,
  BINARY_LIBRARY_MANIFEST,
  BINARY_LIBRARY_PROGRAM_BASE,
  createDeterminismHost,
} from '@blue-quickjs/test-harness';

type BinaryReuseResult = {
  ok: boolean;
  value: Record<string, number | string> | null;
  gasUsed: string;
  gasRemaining: string;
  errorCode: string | null;
  errorTag: string | null;
};

declare global {
  interface Window {
    __BINARY_BUNDLED_CODE__?: string;
    __BINARY_LIBRARY_REUSE_RESULT__?: BinaryReuseResult;
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
    <h1>Binary package deterministic reuse</h1>
    <p>Execution profile: <strong>compat-binary-v1</strong></p>
    <p data-runstate="running">Running…</p>
    <pre data-result>waiting…</pre>
  `;
}

async function run(): Promise<void> {
  const runstate = document.querySelector<HTMLElement>('[data-runstate]');
  const resultEl = document.querySelector<HTMLElement>('[data-result]');

  try {
    const code = window.__BINARY_BUNDLED_CODE__;
    if (typeof code !== 'string' || code.length === 0) {
      throw new Error(
        'Missing bundled binary fixture code in window.__BINARY_BUNDLED_CODE__',
      );
    }

    const host = createDeterminismHost();
    const result = await evaluate({
      program: {
        ...BINARY_LIBRARY_PROGRAM_BASE,
        code,
      },
      input: BINARY_LIBRARY_INPUT,
      gasLimit: BINARY_LIBRARY_GAS_LIMIT,
      manifest: BINARY_LIBRARY_MANIFEST,
      handlers: host.handlers,
    });

    const payload: BinaryReuseResult = result.ok
      ? {
          ok: true,
          value: result.value as Record<string, number | string>,
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

    window.__BINARY_LIBRARY_REUSE_RESULT__ = payload;
    if (runstate) {
      runstate.dataset.runstate = 'done';
      runstate.textContent = payload.ok ? 'Done' : 'Failed';
    }
    if (resultEl) {
      resultEl.textContent = JSON.stringify(payload, null, 2);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    window.__BINARY_LIBRARY_REUSE_RESULT__ = {
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
