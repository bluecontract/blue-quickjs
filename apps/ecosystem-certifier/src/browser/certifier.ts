import { encodeDv } from '@blue-quickjs/dv';
import {
  type HostTapeRecord,
  evaluate,
  type EvaluateResult,
} from '@blue-quickjs/quickjs-runtime';
import { serializeHostTape } from '@blue-quickjs/test-harness';
import { createCertificationHost } from '../shared/host.js';
import type {
  BrowserEvaluationCase,
  FailureStage,
  FixtureParityRecord,
  FixtureSnapshot,
} from '../shared/types.js';

declare global {
  interface Window {
    __ECOSYSTEM_CERT_CASES__?: BrowserEvaluationCase[];
    __ECOSYSTEM_CERT_RESULTS__?: FixtureParityRecord[];
    __ECOSYSTEM_CERT_RUNSTATE__?: 'idle' | 'running' | 'done' | 'error';
    __ECOSYSTEM_CERT_RUN_CASE__?: (
      certCase: BrowserEvaluationCase,
      gasLimit?: string,
    ) => Promise<FixtureSnapshot>;
  }
}

export async function runBrowserCertifier(): Promise<void> {
  renderShell();
  const runstate = document.querySelector<HTMLElement>('[data-runstate]');
  const resultEl = document.querySelector<HTMLElement>('[data-results]');

  try {
    const cases = window.__ECOSYSTEM_CERT_CASES__ ?? [];
    window.__ECOSYSTEM_CERT_RUN_CASE__ = evaluateCaseInBrowser;
    window.__ECOSYSTEM_CERT_RUNSTATE__ = 'running';
    if (runstate) {
      runstate.dataset.runstate = 'running';
      runstate.textContent = `Running ${cases.length} cases…`;
    }

    const records: FixtureParityRecord[] = [];
    for (const certCase of cases) {
      const snapshot = await evaluateCaseInBrowser(certCase, certCase.gasLimit);
      records.push({
        id: certCase.id,
        title: certCase.title,
        kind: certCase.kind,
        node: snapshot,
        browser: snapshot,
        match: true,
      });
    }

    window.__ECOSYSTEM_CERT_RESULTS__ = records;
    window.__ECOSYSTEM_CERT_RUNSTATE__ = 'done';
    if (runstate) {
      runstate.dataset.runstate = 'done';
      runstate.textContent = 'Done';
    }
    if (resultEl) {
      resultEl.textContent = JSON.stringify(records, null, 2);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    window.__ECOSYSTEM_CERT_RESULTS__ = [];
    window.__ECOSYSTEM_CERT_RUNSTATE__ = 'error';
    if (runstate) {
      runstate.dataset.runstate = 'error';
      runstate.textContent = `Error: ${message}`;
    }
    if (resultEl) {
      resultEl.textContent = message;
    }
  }
}

function renderShell(): void {
  const app = document.querySelector<HTMLElement>('[data-app]');
  if (!app) {
    return;
  }
  app.innerHTML = `
    <h1>Ecosystem Certifier (Browser Runner)</h1>
    <p data-runstate="idle">Idle</p>
    <pre data-results>Waiting…</pre>
  `;
}

async function toSnapshot(result: EvaluateResult): Promise<FixtureSnapshot> {
  const tape = result.tape ?? [];
  const tapeHash = await hashTape(tape);
  if (result.ok) {
    return {
      stage: 'success',
      resultHash: await hashDv(result.value),
      errorCode: null,
      errorTag: null,
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
      tapeHash,
      tapeLength: tape.length,
    };
  }

  return {
    stage: normalizeFailureStage(result.error.kind),
    resultHash: null,
    errorCode: result.error.code,
    errorTag: 'tag' in result.error ? result.error.tag : null,
    gasUsed: result.gasUsed.toString(),
    gasRemaining: result.gasRemaining.toString(),
    tapeHash,
    tapeLength: tape.length,
  };
}

async function evaluateCaseInBrowser(
  certCase: BrowserEvaluationCase,
  gasLimit?: string,
): Promise<FixtureSnapshot> {
  const host = createCertificationHost();
  const result = await evaluate({
    program: certCase.program,
    input: {
      event: { type: 'ecosystem-certifier' },
      eventCanonical: { type: 'ecosystem-certifier' },
      steps: [],
      currentContract: { id: 'ecosystem-certifier' },
      currentContractCanonical: { id: { value: 'ecosystem-certifier' } },
    },
    gasLimit: BigInt(gasLimit ?? certCase.gasLimit),
    manifest: certCase.manifest,
    handlers: host.handlers,
    tape: { capacity: 64 },
  });
  return toSnapshot(result);
}

function normalizeFailureStage(kind: string): FailureStage {
  if (kind === 'module-pack') {
    return 'artifact_validation';
  }
  if (kind === 'execution-surface-mismatch') {
    return 'pin_enforcement';
  }
  return 'runtime_error';
}

async function hashDv(value: unknown): Promise<string> {
  return sha256Hex(encodeDv(value));
}

async function hashTape(tape: HostTapeRecord[]): Promise<string | null> {
  if (tape.length === 0) {
    return null;
  }
  return sha256Hex(new TextEncoder().encode(serializeHostTape(tape)));
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(data));
  const bytes = new Uint8Array(digest);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer as ArrayBuffer;
  }
  return data.slice().buffer;
}
