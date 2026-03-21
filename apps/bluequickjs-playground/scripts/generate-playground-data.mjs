#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import jiti from 'jiti';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const outDir = path.resolve(
  repoRoot,
  'apps/bluequickjs-playground/public/generated',
);
const args = parseArgs(process.argv.slice(2));
const require = jiti(import.meta.url, { interopDefault: true });

const {
  HOST_V1_HASH,
  HOST_V1_MANIFEST,
  HOST_V2_HASH,
  HOST_V2_MANIFEST,
} = require('../../../libs/abi-manifest/src/index.ts');
const {
  buildDeterministicModulePack,
  DeterministicBuilderError,
} = require('../../../libs/deterministic-builder/src/index.ts');
const { encodeDv2 } = require('../../../libs/dv/src/index.ts');
const { evaluate } = require('../../../libs/quickjs-runtime/src/index.ts');
const {
  loadQuickjsWasmBinary,
  loadQuickjsWasmMetadata,
} = require('../../../libs/quickjs-wasm/src/index.ts');
const {
  EXAMPLE_CORPUS,
  DETERMINISM_INPUT,
  createDeterminismHost,
  serializeHostTape,
} = require('../../../libs/test-harness/src/index.ts');
const {
  CERTIFIER_FIXTURES,
  manifestForFixture,
} = require('../../../apps/ecosystem-certifier/src/shared/fixtures.ts');
const {
  createCertificationHost,
} = require('../../../apps/ecosystem-certifier/src/shared/host.ts');

const CERTIFICATION_INPUT = {
  event: { type: 'ecosystem-certifier' },
  eventCanonical: { type: 'ecosystem-certifier' },
  steps: [],
  currentContract: { id: 'ecosystem-certifier' },
  currentContractCanonical: { id: { value: 'ecosystem-certifier' } },
};

const HOST_PRESET_SUMMARIES = {
  determinism: {
    label: 'Determinism fixture host',
    description:
      'Provides stable Host.v1/Host.v2 document responses plus deterministic emit tape capture.',
    documents: [
      'path/to/doc',
      'path/to/canonical',
      'path/to/first',
      'path/to/second',
      'path/to/third',
      'bytes/payload',
    ],
  },
  certification: {
    label: 'Certification host',
    description:
      'Provides the ecosystem-certifier text and binary documents used for workload certification.',
    documents: [
      'pack/metadata.json',
      'pack/metadata.yaml',
      'docs/a.md',
      'docs/b.md',
      'docs/c.md',
      'docs/d.md',
      'bytes/payload',
      'bytes/flagship-extra',
      'pack/attachment.deflated',
    ],
  },
};

const SELECTED_GREEN_FIXTURE_IDS = [
  'green-semver',
  'green-base64',
  'green-markdown-it',
  'green-noble-sha',
];

const SELECTED_RED_FIXTURE_IDS = [
  'red-diff-timers',
  'red-dynamic-import',
  'red-proxy',
  'red-function-constructor',
];

const metadata = await loadQuickjsWasmMetadata();
const wasmBinary = await loadQuickjsWasmBinary('wasm32', 'release', metadata);
const engineBuildHash =
  metadata.variants?.wasm32?.release?.engineBuildHash ??
  metadata.engineBuildHash ??
  null;
const gasVersion = metadata.gasVersion ?? null;
const generatedAt = 'current-worktree';

const runnableExamples = await buildExampleEntries();
const selectedGreenFixtures = await buildGreenFixtures();
const flagshipFixture = await buildFlagshipFixture();
const redFixtures = await buildRedFixtures();
const oogBoundaries = await buildOogBoundaries(runnableExamples);

const examplesPayload = {
  generatedAt,
  metadata: {
    engineBuildHash,
    gasVersion,
    wasmVariant: 'wasm32',
    wasmBuildType: 'release',
  },
  examples: [
    ...runnableExamples.galleryEntries,
    ...selectedGreenFixtures.galleryEntries,
    flagshipFixture.galleryEntry,
  ],
};

const evidencePayload = {
  generatedAt,
  metadata: {
    engineBuildHash,
    gasVersion,
  },
  evidence: {
    ...runnableExamples.evidenceById,
    ...selectedGreenFixtures.evidenceById,
    ...flagshipFixture.evidenceById,
  },
};

const oogPayload = {
  generatedAt,
  metadata: {
    engineBuildHash,
    gasVersion,
  },
  boundaries: oogBoundaries,
};

const redPayload = {
  generatedAt,
  metadata: {
    engineBuildHash,
    gasVersion,
  },
  fixtures: redFixtures,
};

const outputs = new Map([
  ['playground-examples.json', `${JSON.stringify(examplesPayload, null, 2)}\n`],
  ['playground-evidence.json', `${JSON.stringify(evidencePayload, null, 2)}\n`],
  [
    'playground-oog-boundaries.json',
    `${JSON.stringify(oogPayload, null, 2)}\n`,
  ],
  ['playground-red-fixtures.json', `${JSON.stringify(redPayload, null, 2)}\n`],
]);

await mkdir(outDir, { recursive: true });

if (args.check) {
  const mismatches = [];
  for (const [filename, expected] of outputs) {
    const targetPath = path.join(outDir, filename);
    let current = null;
    try {
      current = await readFile(targetPath, 'utf8');
    } catch {
      current = null;
    }
    if (current !== expected) {
      mismatches.push(filename);
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: mismatches.length === 0 ? 'ok' : 'stale',
        outDir: path.relative(repoRoot, outDir),
        checkedFiles: [...outputs.keys()],
        mismatches,
      },
      null,
      2,
    )}\n`,
  );

  if (mismatches.length > 0) {
    process.exitCode = 1;
  }
} else {
  for (const [filename, contents] of outputs) {
    await writeFile(path.join(outDir, filename), contents, 'utf8');
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        status: 'generated',
        outDir: path.relative(repoRoot, outDir),
        files: [...outputs.keys()],
      },
      null,
      2,
    )}\n`,
  );
}

async function buildExampleEntries() {
  const galleryEntries = [];
  const evidenceById = {};

  for (const entry of EXAMPLE_CORPUS) {
    const built = await buildCorpusEntry(entry);
    galleryEntries.push(built.galleryEntry);
    evidenceById[built.galleryEntry.id] = built.evidence;
  }

  return { galleryEntries, evidenceById };
}

async function buildCorpusEntry(entry) {
  const id = `example-${entry.slug}`;
  const docsLinks = docsLinksForExample(entry.slug);
  const gasLimit = gasLimitForExample(entry.slug);
  const sourcePaths = entry.sourcePaths;
  const sourceText = await readPrimarySource(sourcePaths[0]);
  const profile = Array.isArray(entry.profile)
    ? entry.profile[0]
    : entry.profile;

  let program;
  let manifest;
  const hostPreset = 'determinism';
  let description = exampleDescription(entry.slug);

  switch (entry.slug) {
    case 'basic-script':
    case 'promises-async':
    case 'console-shim':
    case 'stable-sort':
    case 'max-gas-policy':
      program = createScriptProgram({
        code: await readPrimarySource(sourcePaths[0]),
        profile,
        abiId: 'Host.v1',
        abiVersion: 1,
        abiManifestHash: HOST_V1_HASH,
      });
      manifest = HOST_V1_MANIFEST;
      break;
    case 'binary-host-v2':
      program = createScriptProgram({
        code: await readPrimarySource(sourcePaths[0]),
        profile: 'compat-binary-v1',
        abiId: 'Host.v2',
        abiVersion: 2,
        abiManifestHash: HOST_V2_HASH,
      });
      manifest = HOST_V2_MANIFEST;
      break;
    case 'module-pack':
    case 'promises-library-host':
    case 'kitchen-sink': {
      const built = await buildProgramArtifact({
        entryPath: sourcePaths[0],
        profile,
        abiId: 'Host.v1',
        abiVersion: 1,
        abiManifestHash: HOST_V1_HASH,
      });
      program = built.programArtifact;
      manifest = HOST_V1_MANIFEST;
      break;
    }
    case 'library-reuse': {
      const built = await buildProgramArtifact({
        entryPath: 'libs/test-harness/fixtures/library-reuse/chess-entry.ts',
        profile: 'compat-general-v1',
        abiId: 'Host.v1',
        abiVersion: 1,
        abiManifestHash: HOST_V1_HASH,
      });
      program = built.programArtifact;
      manifest = HOST_V1_MANIFEST;
      description +=
        ' The binary base64 companion source remains listed alongside the chess.js entry for comparison.';
      break;
    }
    default:
      throw new Error(`unhandled example corpus slug: ${entry.slug}`);
  }

  const execution = await evaluateWithPreset({
    id,
    title: entry.title,
    program,
    manifest,
    gasLimit,
    hostPreset,
  });

  return {
    galleryEntry: {
      id,
      title: entry.title,
      kind: 'example',
      badge: `Example ${entry.id}`,
      description,
      certified: true,
      executionProfile: program.executionProfile,
      sourceKind: program.sourceKind,
      abiId: program.abiId,
      gasLimit: gasLimit.toString(),
      sourcePaths,
      sourceText,
      hostPreset,
      hostSummary: HOST_PRESET_SUMMARIES[hostPreset],
      docsLinks,
      supportsOogSearch: true,
      program,
      manifest,
    },
    evidence: {
      ...execution.snapshot,
      certified: true,
      reportSource: `examples/${entry.id.toString().padStart(2, '0')}-${entry.slug}`,
      fixtureCoverage: entry.coverage,
    },
  };
}

async function buildGreenFixtures() {
  const galleryEntries = [];
  const evidenceById = {};

  for (const fixtureId of SELECTED_GREEN_FIXTURE_IDS) {
    const fixture = CERTIFIER_FIXTURES.find((item) => item.id === fixtureId);
    if (!fixture) {
      throw new Error(`unknown selected green fixture: ${fixtureId}`);
    }

    const built = await buildProgramArtifact({
      entryPath: fixture.entryPath,
      profile: fixture.profile,
      abiId: fixture.abiId,
      abiVersion: fixture.abiVersion,
      abiManifestHash: fixture.abiManifestHash,
    });
    const manifest = manifestForFixture(fixture);
    const execution = await evaluateWithPreset({
      id: fixture.id,
      title: fixture.title,
      program: built.programArtifact,
      manifest,
      gasLimit: fixture.gasLimit,
      hostPreset: 'certification',
    });

    galleryEntries.push({
      id: fixture.id,
      title: fixture.title,
      kind: 'ecosystem-green',
      badge: 'Green ecosystem fixture',
      description: fixtureDescription(fixture.id),
      certified: true,
      executionProfile: built.programArtifact.executionProfile,
      sourceKind: built.programArtifact.sourceKind,
      abiId: built.programArtifact.abiId,
      gasLimit: fixture.gasLimit.toString(),
      sourcePaths: [fixture.entryPath],
      sourceText: await readPrimarySource(fixture.entryPath),
      hostPreset: 'certification',
      hostSummary: HOST_PRESET_SUMMARIES.certification,
      docsLinks: docsLinksForFixture(fixture.id),
      supportsOogSearch: false,
      program: built.programArtifact,
      manifest,
    });

    evidenceById[fixture.id] = {
      ...execution.snapshot,
      certified: true,
      reportSource: `ecosystem-certifier:${fixture.id}`,
      fixtureCoverage: [
        { suite: 'ecosystem-certifier', fixtureName: fixture.id },
      ],
    };
  }

  return { galleryEntries, evidenceById };
}

async function buildFlagshipFixture() {
  const fixture = CERTIFIER_FIXTURES.find(
    (item) => item.id === 'flagship-knowledge-pack',
  );
  if (!fixture) {
    throw new Error('flagship fixture not found');
  }

  const built = await buildProgramArtifact({
    entryPath: fixture.entryPath,
    profile: fixture.profile,
    abiId: fixture.abiId,
    abiVersion: fixture.abiVersion,
    abiManifestHash: fixture.abiManifestHash,
  });
  const manifest = manifestForFixture(fixture);
  const execution = await evaluateWithPreset({
    id: fixture.id,
    title: fixture.title,
    program: built.programArtifact,
    manifest,
    gasLimit: fixture.gasLimit,
    hostPreset: 'certification',
  });

  return {
    galleryEntry: {
      id: fixture.id,
      title: fixture.title,
      kind: 'flagship',
      badge: 'Flagship workload',
      description:
        'A browsable flagship deterministic workload that mixes static imports, Promise jobs, text and binary host data, and certification-ready evidence.',
      certified: true,
      executionProfile: built.programArtifact.executionProfile,
      sourceKind: built.programArtifact.sourceKind,
      abiId: built.programArtifact.abiId,
      gasLimit: fixture.gasLimit.toString(),
      sourcePaths: [fixture.entryPath],
      sourceText: await readPrimarySource(fixture.entryPath),
      hostPreset: 'certification',
      hostSummary: HOST_PRESET_SUMMARIES.certification,
      docsLinks: docsLinksForFixture(fixture.id),
      supportsOogSearch: false,
      program: built.programArtifact,
      manifest,
    },
    evidenceById: {
      [fixture.id]: {
        ...execution.snapshot,
        certified: true,
        reportSource: `ecosystem-certifier:${fixture.id}`,
        fixtureCoverage: [
          { suite: 'ecosystem-certifier', fixtureName: fixture.id },
        ],
      },
    },
  };
}

async function buildRedFixtures() {
  const fixtures = [];

  for (const fixtureId of SELECTED_RED_FIXTURE_IDS) {
    const fixture = CERTIFIER_FIXTURES.find((item) => item.id === fixtureId);
    if (!fixture) {
      throw new Error(`unknown selected red fixture: ${fixtureId}`);
    }

    try {
      const built = await buildProgramArtifact({
        entryPath: fixture.entryPath,
        profile: fixture.profile,
        abiId: fixture.abiId,
        abiVersion: fixture.abiVersion,
        abiManifestHash: fixture.abiManifestHash,
      });
      const manifest = manifestForFixture(fixture);
      const execution = await evaluateWithPreset({
        id: fixture.id,
        title: fixture.title,
        program: built.programArtifact,
        manifest,
        gasLimit: fixture.gasLimit,
        hostPreset: 'certification',
      });

      fixtures.push({
        id: fixture.id,
        title: fixture.title,
        kind: fixture.kind,
        executionProfile: fixture.profile,
        failureStage: execution.snapshot.stage,
        errorCode: execution.snapshot.errorCode,
        errorTag: execution.snapshot.errorTag,
        certified: true,
        docsLinks: docsLinksForFixture(fixture.id),
        diagnostics: [],
        runtimeArtifact: built.programArtifact,
        reportSource: `ecosystem-certifier:${fixture.id}`,
      });
    } catch (error) {
      if (!(error instanceof DeterministicBuilderError)) {
        throw error;
      }

      fixtures.push({
        id: fixture.id,
        title: fixture.title,
        kind: fixture.kind,
        executionProfile: fixture.profile,
        failureStage: 'builder_reject',
        errorCode: null,
        errorTag: null,
        certified: true,
        docsLinks: docsLinksForFixture(fixture.id),
        diagnostics: error.diagnostics,
        runtimeArtifact: null,
        reportSource: `ecosystem-certifier:${fixture.id}`,
      });
    }
  }

  return fixtures;
}

async function buildOogBoundaries(runnableExamples) {
  const boundaries = {};

  for (const example of runnableExamples.galleryEntries) {
    const boundary = await findOogBoundary({
      program: example.program,
      manifest: example.manifest,
      gasLimit: BigInt(example.gasLimit),
      hostPreset: example.hostPreset,
    });
    boundaries[example.id] = boundary;
  }

  return boundaries;
}

async function findOogBoundary({ program, manifest, gasLimit, hostPreset }) {
  const successful = await evaluateWithPreset({
    id: 'boundary',
    title: 'boundary',
    program,
    manifest,
    gasLimit,
    hostPreset,
  });
  let upperGas = BigInt(successful.snapshot.gasUsed);
  let upperResult = await runRawEvaluate({
    program,
    manifest,
    gasLimit: upperGas,
    hostPreset,
  });

  while (!upperResult.ok) {
    upperGas *= 2n;
    upperResult = await runRawEvaluate({
      program,
      manifest,
      gasLimit: upperGas,
      hostPreset,
    });
  }

  let lowerGas = 0n;
  let lowerResult = await runRawEvaluate({
    program,
    manifest,
    gasLimit: lowerGas,
    hostPreset,
  });

  while (lowerGas + 1n < upperGas) {
    const mid = (lowerGas + upperGas) >> 1n;
    const current = await runRawEvaluate({
      program,
      manifest,
      gasLimit: mid,
      hostPreset,
    });
    if (current.ok) {
      upperGas = mid;
      upperResult = current;
    } else {
      lowerGas = mid;
      lowerResult = current;
    }
  }

  return {
    firstSuccessGas: upperGas.toString(),
    lastFailureGas: lowerGas.toString(),
    successGasUsed: upperResult.gasUsed.toString(),
    successGasRemaining: upperResult.gasRemaining.toString(),
    failureGasUsed: lowerResult.gasUsed.toString(),
    failureGasRemaining: lowerResult.gasRemaining.toString(),
    failureCode: lowerResult.ok ? null : lowerResult.error.code,
    failureTag:
      !lowerResult.ok && 'tag' in lowerResult.error
        ? lowerResult.error.tag
        : null,
  };
}

async function evaluateWithPreset({
  id,
  title,
  program,
  manifest,
  gasLimit,
  hostPreset,
}) {
  const result = await runRawEvaluate({
    program,
    manifest,
    gasLimit,
    hostPreset,
  });

  const snapshot = await snapshotFromResult(result);
  return { id, title, snapshot };
}

async function runRawEvaluate({ program, manifest, gasLimit, hostPreset }) {
  const host = createHostPreset(hostPreset);
  return evaluate({
    program,
    input:
      hostPreset === 'certification' ? CERTIFICATION_INPUT : DETERMINISM_INPUT,
    gasLimit,
    manifest,
    handlers: host.handlers,
    tape: { capacity: 128 },
    metadata,
    wasmBinary,
    releaseMode: true,
    expectedExecutionProfile: program.executionProfile,
  });
}

async function snapshotFromResult(result) {
  const tape = result.tape ?? [];
  const tapeHash =
    tape.length === 0 ? null : sha256Hex(serializeHostTape(tape));

  if (result.ok) {
    return {
      stage: 'success',
      resultHash: sha256Hex(encodeDv2(result.value)),
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

function normalizeFailureStage(kind) {
  if (kind === 'module-pack') {
    return 'artifact_validation';
  }
  if (kind === 'execution-surface-mismatch') {
    return 'pin_enforcement';
  }
  return 'runtime_error';
}

function createHostPreset(hostPreset) {
  return hostPreset === 'certification'
    ? createCertificationHost()
    : createDeterminismHost();
}

function createScriptProgram({
  code,
  profile,
  abiId,
  abiVersion,
  abiManifestHash,
}) {
  return {
    version: 2,
    abiId,
    abiVersion,
    abiManifestHash,
    executionProfile: profile,
    sourceKind: 'script',
    source: { code },
    ...(engineBuildHash ? { engineBuildHash } : {}),
    ...(gasVersion !== null ? { gasVersion } : {}),
  };
}

async function buildProgramArtifact({
  entryPath,
  profile,
  abiId,
  abiVersion,
  abiManifestHash,
}) {
  const built = await buildDeterministicModulePack({
    absWorkingDir: repoRoot,
    entryPath,
    profile,
    emitProgramArtifact: true,
    abiId,
    abiVersion,
    abiManifestHash,
    ...(engineBuildHash ? { engineBuildHash } : {}),
    ...(gasVersion !== null ? { gasVersion } : {}),
  });

  if (!built.programArtifact) {
    throw new Error(
      `builder did not return ProgramArtifact.v2 for ${entryPath}`,
    );
  }

  return built;
}

function docsLinksForExample(slug) {
  const base = [
    { label: 'Learn path', href: '/docs/learn/README.md' },
    { label: 'Examples corpus', href: '/examples/README.md' },
  ];

  switch (slug) {
    case 'module-pack':
      return [
        ...base,
        {
          label: 'Module packs',
          href: '/docs/learn/03-module-packs-and-imports.md',
        },
      ];
    case 'promises-async':
    case 'promises-library-host':
      return [
        ...base,
        {
          label: 'Promises and microtasks',
          href: '/docs/learn/04-promises-async-and-microtasks.md',
        },
      ];
    case 'binary-host-v2':
      return [
        ...base,
        {
          label: 'Binary mode and Host.v2',
          href: '/docs/learn/05-binary-and-host-v2.md',
        },
      ];
    case 'max-gas-policy':
      return [
        ...base,
        {
          label: 'Gas and OOG',
          href: '/docs/learn/06-gas-oog-and-max-gas-policies.md',
        },
      ];
    default:
      return base;
  }
}

function docsLinksForFixture(fixtureId) {
  const base = [
    {
      label: 'Workload certification',
      href: '/docs/workload-certification.md',
    },
    {
      label: 'Compatibility report',
      href: '/docs/ecosystem-compatibility-report.md',
    },
  ];

  if (fixtureId.startsWith('red-')) {
    return [
      ...base,
      {
        label: 'Unsupported features and why',
        href: '/docs/unsupported-features-and-why.md',
      },
    ];
  }

  if (fixtureId === 'flagship-knowledge-pack') {
    return [
      ...base,
      {
        label: 'Architecture overview',
        href: '/docs/architecture-overview.md',
      },
    ];
  }

  return base;
}

function exampleDescription(slug) {
  return {
    'basic-script': 'Smallest possible deterministic script-mode example.',
    'module-pack':
      'Static ESM module-pack example with a deterministic graph hash.',
    'library-reuse':
      'Real library reuse through a deterministic module-pack instead of runtime imports.',
    'promises-async':
      'Promise job draining under an explicitly compatible profile.',
    'promises-library-host':
      'Imported module code plus Promise jobs plus host interaction.',
    'binary-host-v2':
      'Typed-array and bytes boundary example using Host.v2 and DV2.',
    'console-shim': 'Deterministic console shimming routed through host tape.',
    'stable-sort':
      'Compatibility profile example showing deterministic stable sort.',
    'kitchen-sink':
      'Composite example mixing modules, Promise jobs, host calls, and stable sort.',
    'max-gas-policy':
      'Shows how exact OOG boundaries are part of the release contract.',
  }[slug];
}

function fixtureDescription(fixtureId) {
  return {
    'green-semver':
      'Semver constraint evaluation from the certified green ecosystem corpus.',
    'green-base64':
      'Binary roundtrip coverage from the certified green ecosystem corpus.',
    'green-markdown-it':
      'A larger parser-oriented compatibility fixture running under deterministic constraints.',
    'green-noble-sha':
      'A binary-heavy crypto-style fixture showing deterministic digest behavior.',
  }[fixtureId];
}

function gasLimitForExample(slug) {
  return {
    'basic-script': 1_000_000n,
    'module-pack': 50_000n,
    'library-reuse': 5_000_000n,
    'promises-async': 50_000n,
    'promises-library-host': 100_000n,
    'binary-host-v2': 50_000n,
    'console-shim': 50_000n,
    'stable-sort': 100_000n,
    'kitchen-sink': 200_000n,
    'max-gas-policy': 1_000_000n,
  }[slug];
}

async function readPrimarySource(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

function sha256Hex(input) {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return createHash('sha256').update(bytes).digest('hex');
}

function parseArgs(argv) {
  return {
    check: argv.includes('--check'),
  };
}
