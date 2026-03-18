import { HOST_V1_MANIFEST } from '@blue-quickjs/abi-manifest';
import { encodeDv } from '@blue-quickjs/dv';
import { evaluate } from '@blue-quickjs/quickjs-runtime';
import { createConsumerHost } from '../shared/host.js';

declare global {
  interface Window {
    __CONSUMER_ARTIFACT__?: unknown;
    __CONSUMER_GAS_LIMIT__?: string;
    __CONSUMER_RESULT__?: unknown;
    __runConsumerEvaluation?: (gasLimit: string) => Promise<unknown>;
  }
}

const app = document.querySelector<HTMLElement>('[data-app]');
if (app) {
  app.innerHTML = '<h1>Consumer Proof Browser Runner</h1><pre data-output>Idle</pre>';
}

window.__runConsumerEvaluation = async (gasLimit: string) => {
  if (!window.__CONSUMER_ARTIFACT__) {
    throw new Error('missing __CONSUMER_ARTIFACT__ payload');
  }
  const host = createConsumerHost();
  const result = await evaluate({
    program: window.__CONSUMER_ARTIFACT__ as never,
    input: {
      event: { type: 'consumer-proof' },
      eventCanonical: { type: 'consumer-proof' },
      steps: [],
      currentContract: { id: 'consumer-proof' },
      currentContractCanonical: { id: { value: 'consumer-proof' } },
    },
    gasLimit: BigInt(gasLimit),
    manifest: HOST_V1_MANIFEST,
    handlers: host.handlers,
    tape: { capacity: 32 },
  });

  const tape = result.tape ?? [];
  const snapshot = result.ok
    ? {
        stage: 'success',
        resultHash: await sha256Hex(encodeDv(result.value)),
        errorCode: null,
        errorTag: null,
        gasUsed: result.gasUsed.toString(),
        gasRemaining: result.gasRemaining.toString(),
        tapeHash:
          tape.length > 0
            ? await sha256Hex(
                new TextEncoder().encode(stringifyWithBigInt(tape)),
              )
            : null,
        tapeLength: tape.length,
      }
    : {
        stage: 'error',
        resultHash: null,
        errorCode: result.error.code,
        errorTag: 'tag' in result.error ? result.error.tag : null,
        gasUsed: result.gasUsed.toString(),
        gasRemaining: result.gasRemaining.toString(),
        tapeHash:
          tape.length > 0
            ? await sha256Hex(
                new TextEncoder().encode(stringifyWithBigInt(tape)),
              )
            : null,
        tapeLength: tape.length,
      };
  window.__CONSUMER_RESULT__ = snapshot;
  return snapshot;
};

const gasLimit = window.__CONSUMER_GAS_LIMIT__;
if (window.__CONSUMER_ARTIFACT__ && gasLimit) {
  void window.__runConsumerEvaluation(gasLimit)
    .then((snapshot) => {
      const out = document.querySelector<HTMLElement>('[data-output]');
      if (out) {
        out.textContent = JSON.stringify(snapshot, null, 2);
      }
    })
    .catch((error) => {
      const out = document.querySelector<HTMLElement>('[data-output]');
      if (out) {
        out.textContent =
          error instanceof Error ? error.stack ?? error.message : String(error);
      }
    });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return [...new Uint8Array(digest)]
    .map((chunk) => chunk.toString(16).padStart(2, '0'))
    .join('');
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer as ArrayBuffer;
  }
  return data.slice().buffer;
}

function stringifyWithBigInt(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
}
