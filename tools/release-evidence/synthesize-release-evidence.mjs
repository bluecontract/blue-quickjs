#!/usr/bin/env node

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import {
  copyIntoEvidenceDir,
  createDetachedSignature,
  createManifestEntry,
  ensureDir,
  loadOptionalText,
  writeChecksumFile,
  writeSignatureFile,
} from './_lib.mjs';

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const artifactsRoot = path.resolve(repoRoot, args.artifactsDir);
const outDir = path.resolve(repoRoot, args.outDir);
const inputsDir = path.join(outDir, 'inputs');

await ensureDir(outDir);
await ensureDir(inputsDir);

const branch = args.branch ?? resolveCurrentBranch(repoRoot);
const date = args.date ?? new Date().toISOString().slice(0, 10);
const existingSummaryPath = path.join(outDir, 'release-evidence-summary.json');
const existingSummary =
  args.check && (await pathExists(existingSummaryPath))
    ? JSON.parse(await readFile(existingSummaryPath, 'utf8'))
    : null;
const generatedAt = existingSummary?.generatedAt ?? new Date().toISOString();

const consensusSource = path.resolve(
  repoRoot,
  args.consensusReport ??
    (await findNewestFile(artifactsRoot, (entry) =>
      /^consensus-parity-report-.*\.json$/.test(entry.name),
    )),
);
const workloadSource = path.resolve(
  repoRoot,
  args.workloadReport ??
    (await findNewestFile(
      path.join(artifactsRoot, 'workload-certification'),
      (entry) => /^workload-certification-.*\.json$/.test(entry.name),
    )),
);
const workloadOogSource = path.resolve(
  repoRoot,
  args.workloadOogReport ?? path.join(artifactsRoot, 'workload-certification', 'oog-boundaries.json'),
);
const consumerSource = path.resolve(
  repoRoot,
  args.consumerReport ?? 'e2e/consumer-proof-app/reports/reproducibility-report.json',
);
const repeatabilitySource = path.resolve(
  repoRoot,
  args.repeatabilityReport ??
    path.join(artifactsRoot, 'workload-certification', 'repeatability-report.json'),
);
const seededSource = path.resolve(
  repoRoot,
  args.seededReport ??
    path.join(artifactsRoot, 'workload-certification', 'seeded-property-corpus-report.json'),
);
const workloadMatrixSource = path.resolve(
  repoRoot,
  args.workloadMatrixReport ??
    (await findNewestFile(
      path.join(artifactsRoot, 'workload-certification'),
      (entry) => /^compatibility-matrix-.*\.json$/.test(entry.name),
    )),
);
const nativeSource = args.nativeReport
  ? path.resolve(repoRoot, args.nativeReport)
  : await findNewestFileOptional(
      path.join(artifactsRoot, 'reproducibility'),
      (entry) => /^parity-report-.*\.json$/.test(entry.name),
    );

const metadataSource = path.resolve(
  repoRoot,
  args.metadataPath ?? 'libs/quickjs-wasm-build/dist/quickjs-wasm-build.metadata.json',
);
const metadata = await readOptionalJson(metadataSource);
const signingKeyPem =
  (await loadOptionalText(args.signingKeyPath ?? '')) ??
  process.env.RELEASE_EVIDENCE_SIGNING_KEY ??
  null;

const copiedArtifacts = [];
copiedArtifacts.push(
  await copyArtifact(consensusSource, 'consensus-report.json', 'consensus'),
);
copiedArtifacts.push(
    await copyArtifact(workloadSource, 'workload-certification.json', 'workload'),
);
copiedArtifacts.push(
  await copyArtifact(workloadOogSource, 'workload-oog-boundaries.json', 'workload'),
);
copiedArtifacts.push(
  await copyArtifact(workloadMatrixSource, 'workload-compatibility-matrix.json', 'workload'),
);
copiedArtifacts.push(
  await copyArtifact(consumerSource, 'consumer-reproducibility.json', 'consumer'),
);

if (await pathExists(repeatabilitySource)) {
  copiedArtifacts.push(
    await copyArtifact(repeatabilitySource, 'workload-repeatability.json', 'workload'),
  );
}
if (await pathExists(seededSource)) {
  copiedArtifacts.push(
    await copyArtifact(seededSource, 'workload-seeded-corpus.json', 'workload'),
  );
}
if (nativeSource && (await pathExists(nativeSource))) {
  copiedArtifacts.push(
    await copyArtifact(nativeSource, 'native-diagnostic-report.json', 'native'),
  );
}

const consensus = JSON.parse(
  await readFile(path.join(inputsDir, 'consensus-report.json'), 'utf8'),
);
const workload = JSON.parse(
  await readFile(path.join(inputsDir, 'workload-certification.json'), 'utf8'),
);
const workloadOog = JSON.parse(
  await readFile(path.join(inputsDir, 'workload-oog-boundaries.json'), 'utf8'),
);
const consumer = JSON.parse(
  await readFile(path.join(inputsDir, 'consumer-reproducibility.json'), 'utf8'),
);

const executionProfiles = [
  ...new Set(
    (workload.records ?? [])
      .map((record) => record.profile)
      .filter((value) => typeof value === 'string' && value.length > 0),
  ),
].sort();

const consensusBoundarySuite = (consensus.suites ?? []).find(
  (suite) => suite.name === 'gas-boundary-fixtures',
);
const exactOogParity =
  (consensusBoundarySuite?.mismatchCount ?? 0) === 0 &&
  (workloadOog.mismatchCount ?? 1) === 0 &&
  Boolean(consumer.parity?.oogEqual);

const summary = {
  generatedAt,
  branch,
  date,
  engineBuildHash:
    metadata?.engineBuildHash ??
    metadata?.variants?.wasm32?.release?.engineBuildHash ??
    null,
  gasVersion: metadata?.gasVersion ?? null,
  executionProfileCoverage: executionProfiles,
  fixtureCounts: {
    consensus: consensus.fixtureCount ?? 0,
    workloadTotal: workload.summary?.total ?? 0,
    workloadGreen: workload.summary?.greenCount ?? 0,
    workloadRed: workload.summary?.redCount ?? 0,
    workloadFlagship: workload.summary?.flagshipCount ?? 0,
  },
  mismatchCounts: {
    consensus: consensus.mismatchCount ?? 0,
    workload: workload.summary?.mismatches ?? 0,
    workloadOog: workloadOog.mismatchCount ?? 0,
    consumerParity:
      consumer.parity?.snapshotEqual && consumer.parity?.oogEqual ? 0 : 1,
  },
  exactOogParity,
  consumerParity: {
    snapshotEqual: Boolean(consumer.parity?.snapshotEqual),
    oogEqual: Boolean(consumer.parity?.oogEqual),
  },
};

const summaryJsonPath = path.join(outDir, 'release-evidence-summary.json');
await writeFile(`${summaryJsonPath}`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
const summaryMarkdown = renderSummaryMarkdown(summary, copiedArtifacts);
const summaryMdPath = path.join(outDir, 'release-evidence-summary.md');
await writeFile(summaryMdPath, summaryMarkdown, 'utf8');

const generatedArtifacts = [];
generatedArtifacts.push(
  await finalizeGeneratedArtifact(summaryJsonPath, 'release-evidence', signingKeyPem),
);
generatedArtifacts.push(
  await finalizeGeneratedArtifact(summaryMdPath, 'release-evidence', signingKeyPem),
);

const manifest = {
  version: 1,
  generatedAt,
  branch,
  date,
  artifacts: [
    ...(await Promise.all(
      copiedArtifacts.map(async (artifact) =>
        createManifestEntry(artifact.path, outDir, artifact.category),
      ),
    )),
    ...(await Promise.all(
      generatedArtifacts.map(async (artifact) => {
        const baseEntry = await createManifestEntry(
          artifact.path,
          outDir,
          artifact.category,
        );
        return {
          ...baseEntry,
          checksumFile: path.relative(outDir, artifact.checksumPath),
          signatureFile: path.relative(outDir, artifact.signaturePath),
        };
      }),
    )),
  ],
};

const manifestPath = path.join(outDir, 'release-evidence-manifest.json');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
const manifestChecksumPath = await writeChecksumFile(manifestPath);
const manifestSignaturePath = await writeSignatureFile(
  manifestPath,
  createDetachedSignature(await readFile(manifestPath), {
    privateKeyPem: signingKeyPem,
    keyId: args.signingKeyId ?? 'release-evidence-manifest',
  }),
);

const docsPath = path.resolve(repoRoot, args.docsPath ?? 'docs/release-readiness-report.md');
const generatedDocs = renderReleaseReadinessDoc(summary, manifest, outDir);
if (args.check) {
  const existing = await readFile(docsPath, 'utf8');
  if (existing !== generatedDocs) {
    throw new Error(
      `${path.relative(repoRoot, docsPath)} is stale; run synthesize-release-evidence without --check`,
    );
  }
} else if (!args.skipDocs) {
  await writeFile(docsPath, generatedDocs, 'utf8');
}

process.stdout.write(
  `${JSON.stringify(
    {
      outDir,
      summaryJsonPath: path.relative(repoRoot, summaryJsonPath),
      summaryMdPath: path.relative(repoRoot, summaryMdPath),
      manifestPath: path.relative(repoRoot, manifestPath),
      manifestChecksumPath: path.relative(repoRoot, manifestChecksumPath),
      manifestSignaturePath: path.relative(repoRoot, manifestSignaturePath),
      docsPath: path.relative(repoRoot, docsPath),
      exactOogParity,
    },
    null,
    2,
  )}\n`,
);

async function copyArtifact(sourcePath, targetName, category) {
  if (!(await pathExists(sourcePath))) {
    throw new Error(`required evidence source is missing: ${sourcePath}`);
  }
  const destination = await copyIntoEvidenceDir(sourcePath, inputsDir, targetName);
  return { category, path: destination };
}

async function finalizeGeneratedArtifact(filePath, category, signingKeyPem) {
  const checksumPath = await writeChecksumFile(filePath);
  const signaturePayload = createDetachedSignature(await readFile(filePath), {
    privateKeyPem: signingKeyPem,
    keyId: args.signingKeyId ?? 'release-evidence',
  });
  const signaturePath = await writeSignatureFile(filePath, signaturePayload);
  return {
    category,
    path: filePath,
    checksumPath,
    signaturePath,
  };
}

function renderSummaryMarkdown(summary, copiedArtifacts) {
  const lines = [
    '# Release Evidence Summary (Generated)',
    '',
    `Generated at: ${summary.generatedAt}`,
    `Branch: \`${summary.branch}\``,
    `Date: ${summary.date}`,
    '',
    `- engineBuildHash: \`${summary.engineBuildHash ?? 'n/a'}\``,
    `- gasVersion: \`${summary.gasVersion ?? 'n/a'}\``,
    `- exact OOG parity: **${summary.exactOogParity ? 'pass' : 'fail'}**`,
    '',
    '## Coverage',
    '',
    `- execution profiles: ${summary.executionProfileCoverage.length > 0 ? summary.executionProfileCoverage.map((entry) => `\`${entry}\``).join(', ') : 'n/a'}`,
    `- consensus fixtures: ${summary.fixtureCounts.consensus}`,
    `- workload fixtures: ${summary.fixtureCounts.workloadTotal} (green ${summary.fixtureCounts.workloadGreen} / red ${summary.fixtureCounts.workloadRed} / flagship ${summary.fixtureCounts.workloadFlagship})`,
    '',
    '## Mismatches',
    '',
    `- consensus mismatches: ${summary.mismatchCounts.consensus}`,
    `- workload mismatches: ${summary.mismatchCounts.workload}`,
    `- workload OOG mismatches: ${summary.mismatchCounts.workloadOog}`,
    `- consumer parity mismatches: ${summary.mismatchCounts.consumerParity}`,
    '',
    '## Included source evidence files',
    '',
    '| Category | File |',
    '| --- | --- |',
  ];
  for (const artifact of copiedArtifacts) {
    lines.push(`| ${artifact.category} | \`${path.basename(artifact.path)}\` |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function renderReleaseReadinessDoc(summary, manifest, evidenceDir) {
  const lines = [
    '# Release-readiness report (current branch snapshot)',
    '',
    `Date: ${summary.date}  `,
    `Branch: \`${summary.branch}\``,
    '',
    '> This file is generated by `node tools/release-evidence/synthesize-release-evidence.mjs`.',
    '',
    '## Environment',
    '',
    `- engineBuildHash: \`${summary.engineBuildHash ?? 'n/a'}\``,
    `- gasVersion: \`${summary.gasVersion ?? 'n/a'}\``,
    '',
    '## Consensus-safe vs diagnostic-only',
    '',
    '### Consensus-safe (release gate)',
    '',
    '- Executor pair: `wasm-node` vs `wasm-browser` (`wasm32` release artifacts).',
    '- Gate requirements: exact value/error parity, exact gas parity, exact tape parity, exact OOG boundary parity.',
    `- Consensus mismatch count: \`${summary.mismatchCounts.consensus}\``,
    '',
    '### Diagnostic-only',
    '',
    '- Native parity remains diagnostic-only unless explicitly promoted by release policy.',
    '',
    '## Certification and parity snapshot',
    '',
    `- Workload totals: \`${summary.fixtureCounts.workloadTotal}\` fixtures (\`${summary.fixtureCounts.workloadGreen}\` green / \`${summary.fixtureCounts.workloadRed}\` red / \`${summary.fixtureCounts.workloadFlagship}\` flagship)`,
    `- Workload mismatch count: \`${summary.mismatchCounts.workload}\``,
    `- Workload OOG mismatch count: \`${summary.mismatchCounts.workloadOog}\``,
    `- Consumer snapshot parity: \`${summary.consumerParity.snapshotEqual}\``,
    `- Consumer OOG parity: \`${summary.consumerParity.oogEqual}\``,
    `- Exact OOG parity status: \`${summary.exactOogParity}\``,
    '',
    '## Evidence manifest',
    '',
    `- Manifest file: \`${path.relative(process.cwd(), path.join(evidenceDir, 'release-evidence-manifest.json'))}\``,
    `- Manifest artifact entries: \`${manifest.artifacts.length}\``,
    '',
    '## Included artifacts',
    '',
    '| Category | File | SHA256 |',
    '| --- | --- | --- |',
  ];
  for (const artifact of manifest.artifacts) {
    lines.push(`| ${artifact.category} | \`${artifact.file}\` | \`${artifact.sha256}\` |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function findNewestFile(rootDir, predicate) {
  const found = await findNewestFileOptional(rootDir, predicate);
  if (!found) {
    throw new Error(`no matching files under ${rootDir}`);
  }
  return found;
}

async function findNewestFileOptional(rootDir, predicate) {
  if (!(await pathExists(rootDir))) {
    return null;
  }
  const files = await walkFiles(rootDir);
  let latest = null;
  for (const file of files) {
    if (!predicate({ name: path.basename(file), path: file })) {
      continue;
    }
    const fileStat = await stat(file);
    if (!latest || fileStat.mtimeMs > latest.mtimeMs) {
      latest = { file, mtimeMs: fileStat.mtimeMs };
    }
  }
  return latest?.file ?? null;
}

async function walkFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function readOptionalJson(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveCurrentBranch(cwd) {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`unable to resolve current branch: ${result.stderr?.trim() ?? ''}`);
  }
  return result.stdout.trim();
}

function parseArgs(argv) {
  const parsed = {
    artifactsDir: 'artifacts',
    outDir: 'artifacts/release-evidence',
    docsPath: 'docs/release-readiness-report.md',
    check: false,
    skipDocs: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--artifacts-dir') {
      parsed.artifactsDir = argv[index + 1] ?? parsed.artifactsDir;
      index += 1;
      continue;
    }
    if (arg === '--out-dir') {
      parsed.outDir = argv[index + 1] ?? parsed.outDir;
      index += 1;
      continue;
    }
    if (arg === '--docs-path') {
      parsed.docsPath = argv[index + 1] ?? parsed.docsPath;
      index += 1;
      continue;
    }
    if (arg === '--consensus-report') {
      parsed.consensusReport = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--workload-report') {
      parsed.workloadReport = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--workload-oog-report') {
      parsed.workloadOogReport = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--workload-matrix-report') {
      parsed.workloadMatrixReport = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--consumer-report') {
      parsed.consumerReport = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--repeatability-report') {
      parsed.repeatabilityReport = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--seeded-report') {
      parsed.seededReport = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--native-report') {
      parsed.nativeReport = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--metadata-path') {
      parsed.metadataPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--signing-key-path') {
      parsed.signingKeyPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--signing-key-id') {
      parsed.signingKeyId = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--branch') {
      parsed.branch = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--date') {
      parsed.date = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--check') {
      parsed.check = true;
      continue;
    }
    if (arg === '--skip-docs') {
      parsed.skipDocs = true;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}
