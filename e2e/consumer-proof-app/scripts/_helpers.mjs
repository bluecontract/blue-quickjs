import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const appRoot = path.resolve(import.meta.dirname, '..');
export const reportsDir = path.resolve(appRoot, 'reports');
export const artifactPath = path.join(reportsDir, 'program-artifact.json');
export const nodeResultPath = path.join(reportsDir, 'node-result.json');
export const browserResultPath = path.join(reportsDir, 'browser-result.json');
export const oogBoundaryPath = path.join(reportsDir, 'oog-boundary.json');
export const reproPath = path.join(reportsDir, 'reproducibility-report.json');

export async function ensureReportsDir() {
  await mkdir(reportsDir, { recursive: true });
}

export async function writeJson(targetPath, payload) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function readJson(targetPath) {
  const text = await readFile(targetPath, 'utf8');
  return JSON.parse(text);
}

export function createInputEnvelope() {
  return {
    event: { type: 'consumer-proof' },
    eventCanonical: { type: 'consumer-proof' },
    steps: [],
    currentContract: { id: 'consumer-proof' },
    currentContractCanonical: { id: { value: 'consumer-proof' } },
  };
}

export function snapshotFromResult(result, encodeDv) {
  const tape = result.tape ?? [];
  if (result.ok) {
    return {
      stage: 'success',
      resultHash: sha256Hex(Buffer.from(encodeDv(result.value))),
      errorCode: null,
      errorTag: null,
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
      tapeHash:
        tape.length > 0
          ? sha256Hex(Buffer.from(stringifyWithBigInt(tape)))
          : null,
      tapeLength: tape.length,
    };
  }
  return {
    stage: 'error',
    resultHash: null,
    errorCode: result.error.code,
    errorTag: 'tag' in result.error ? result.error.tag : null,
    gasUsed: result.gasUsed.toString(),
    gasRemaining: result.gasRemaining.toString(),
    tapeHash:
      tape.length > 0 ? sha256Hex(Buffer.from(stringifyWithBigInt(tape))) : null,
    tapeLength: tape.length,
  };
}

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function stringifyWithBigInt(value) {
  return JSON.stringify(value, (_, item) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
}
