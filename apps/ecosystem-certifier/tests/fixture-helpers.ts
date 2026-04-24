import type { Page } from '@playwright/test';
import {
  type BuildDeterministicModulePackResult,
  buildDeterministicModulePack,
} from '@blue-quickjs/deterministic-builder';
import { evaluate } from '@blue-quickjs/quickjs-runtime';
import {
  type BrowserEvaluationCase,
  type BuildFixtureDefinition,
  type FailureStage,
  type FixtureSnapshot,
} from '../src/shared/types.js';
import {
  CERTIFIER_FIXTURES,
  manifestForFixture,
} from '../src/shared/fixtures.js';
import { createCertificationHost } from '../src/shared/host.js';
import { hashDv, hashTape } from '../src/shared/hash.js';

const INPUT = {
  event: { type: 'ecosystem-certifier' },
  eventCanonical: { type: 'ecosystem-certifier' },
  steps: [],
  currentContract: { id: 'ecosystem-certifier' },
  currentContractCanonical: { id: { value: 'ecosystem-certifier' } },
};

export function getFixtureById(id: string): BuildFixtureDefinition {
  const fixture = CERTIFIER_FIXTURES.find((item) => item.id === id);
  if (!fixture) {
    throw new Error(`fixture not found: ${id}`);
  }
  return fixture;
}

export async function buildCaseByFixtureId(
  id: string,
): Promise<BrowserEvaluationCase> {
  const fixture = getFixtureById(id);
  const built = await buildDeterministicModulePack({
    absWorkingDir: process.cwd(),
    entryPath: fixture.entryPath,
    profile: fixture.profile,
    emitProgramArtifact: true,
    abiId: fixture.abiId,
    abiVersion: fixture.abiVersion,
    abiManifestHash: fixture.abiManifestHash,
  });
  return toBrowserCase(fixture, built);
}

export async function runNodeSnapshot(
  certCase: BrowserEvaluationCase,
  gasLimit?: string,
): Promise<FixtureSnapshot> {
  const host = createCertificationHost();
  const result = await evaluate({
    program: certCase.program,
    input: INPUT,
    gasLimit: BigInt(gasLimit ?? certCase.gasLimit),
    manifest: certCase.manifest,
    handlers: host.handlers,
    tape: { capacity: 64 },
  });
  const tape = result.tape ?? [];
  if (result.ok) {
    return {
      stage: 'success',
      resultHash: hashDv(result.value),
      errorCode: null,
      errorTag: null,
      gasUsed: result.gasUsed.toString(),
      gasRemaining: result.gasRemaining.toString(),
      tapeHash: hashTape(tape),
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
    tapeHash: hashTape(tape),
    tapeLength: tape.length,
  };
}

export async function runBrowserSnapshot(
  page: Page,
  certCase: BrowserEvaluationCase,
  gasLimit?: string,
): Promise<FixtureSnapshot> {
  await ensureRunnerReady(page);
  return page.evaluate(
    async ({ certCasePayload, gasLimitValue }) => {
      if (!window.__ECOSYSTEM_CERT_RUN_CASE__) {
        throw new Error('window.__ECOSYSTEM_CERT_RUN_CASE__ is unavailable');
      }
      return window.__ECOSYSTEM_CERT_RUN_CASE__(
        certCasePayload,
        gasLimitValue ?? certCasePayload.gasLimit,
      );
    },
    {
      certCasePayload: certCase,
      gasLimitValue: gasLimit,
    },
  );
}

async function ensureRunnerReady(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__ECOSYSTEM_CERT_RUN_CASE__ === 'function',
    undefined,
    { timeout: 120000 },
  );
}

function toBrowserCase(
  fixture: BuildFixtureDefinition,
  built: BuildDeterministicModulePackResult,
): BrowserEvaluationCase {
  if (!built.programArtifact) {
    throw new Error(`missing ProgramArtifact.v2 for ${fixture.id}`);
  }
  return {
    id: fixture.id,
    title: fixture.title,
    kind: fixture.kind,
    gasLimit: fixture.gasLimit.toString(),
    manifest: manifestForFixture(fixture),
    program: built.programArtifact,
  };
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
