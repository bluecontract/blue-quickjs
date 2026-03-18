import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import jiti from 'jiti';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '..', '..', '..');
export const appRoot = path.resolve(repoRoot, 'apps/ecosystem-certifier');
const require = jiti(import.meta.url, { interopDefault: true });

const { buildDeterministicModulePack, DeterministicBuilderError } = require(
  '../../../libs/deterministic-builder/src/index.ts',
);
const { evaluate } = require('../../../libs/quickjs-runtime/src/index.ts');
const { encodeDv } = require('../../../libs/dv/src/index.ts');
const { serializeHostTape } = require('../../../libs/test-harness/src/index.ts');
const {
  CERTIFIER_FIXTURES,
  manifestForFixture,
} = require('../src/shared/fixtures.ts');
const { createCertificationHost } = require('../src/shared/host.ts');

export async function buildRunnableCasesByIds(ids) {
  const fixtures = CERTIFIER_FIXTURES.filter(
    (fixture) => ids.includes(fixture.id) && fixture.expect.stage === 'success',
  );
  const cases = [];
  for (const fixture of fixtures) {
    try {
      const built = await buildDeterministicModulePack({
        absWorkingDir: repoRoot,
        entryPath: fixture.entryPath,
        profile: fixture.profile,
        emitProgramArtifact: true,
        abiId: fixture.abiId,
        abiVersion: fixture.abiVersion,
        abiManifestHash: fixture.abiManifestHash,
      });
      if (!built.programArtifact) {
        throw new Error(`missing ProgramArtifact.v2 for ${fixture.id}`);
      }
      cases.push({
        id: fixture.id,
        title: fixture.title,
        kind: fixture.kind,
        gasLimit: fixture.gasLimit.toString(),
        manifest: manifestForFixture(fixture),
        program: built.programArtifact,
      });
    } catch (error) {
      if (error instanceof DeterministicBuilderError) {
        throw new Error(
          `fixture ${fixture.id} unexpectedly failed builder compatibility: ${JSON.stringify(
            error.diagnostics,
          )}`,
        );
      }
      throw error;
    }
  }
  return cases;
}

export async function evaluateCaseNode(certCase, gasLimit) {
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
    tape: { capacity: 128 },
  });
  return snapshotFromEvaluateResult(result);
}

export async function launchBrowserCertifier(baseUrlOverride) {
  const viteServer = await createServer({
    configFile: path.join(appRoot, 'vite.config.mts'),
    server: {
      host: '127.0.0.1',
      port: 4310,
      strictPort: true,
    },
    clearScreen: false,
  });
  await viteServer.listen();

  const baseUrl = baseUrlOverride ?? 'http://127.0.0.1:4310';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction(
    () => typeof window.__ECOSYSTEM_CERT_RUN_CASE__ === 'function',
    undefined,
    {
      timeout: 120000,
    },
  );

  return {
    async evaluateCaseSnapshot(certCase, gasLimit) {
      return page.evaluate(
        async ({ certCasePayload, gasLimitValue }) => {
          if (!window.__ECOSYSTEM_CERT_RUN_CASE__) {
            throw new Error('window.__ECOSYSTEM_CERT_RUN_CASE__ unavailable');
          }
          return window.__ECOSYSTEM_CERT_RUN_CASE__(
            certCasePayload,
            gasLimitValue,
          );
        },
        { certCasePayload: certCase, gasLimitValue: gasLimit ?? certCase.gasLimit },
      );
    },
    async close() {
      await context.close();
      await browser.close();
      await viteServer.close();
    },
  };
}

export function snapshotFromEvaluateResult(result) {
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
          ? sha256Hex(Buffer.from(serializeHostTape(tape)))
          : null,
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
    tapeHash:
      tape.length > 0 ? sha256Hex(Buffer.from(serializeHostTape(tape))) : null,
    tapeLength: tape.length,
  };
}

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeFailureStage(kind) {
  if (kind === 'module-pack') {
    return 'artifact_validation';
  }
  if (kind === 'execution-surface-mismatch') {
    return 'pin_enforcement';
  }
  return 'runtime_error';
}
