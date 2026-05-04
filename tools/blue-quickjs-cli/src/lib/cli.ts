import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  HOST_V1_HASH,
  HOST_V1_MANIFEST,
  HOST_V2_HASH,
  HOST_V2_MANIFEST,
  type AbiManifest,
  validateAbiManifest,
} from '@blue-quickjs/abi-manifest';
import {
  buildDeterministicModulePack,
  type DeterministicExecutionProfile,
} from '@blue-quickjs/deterministic-builder';
import {
  type ProgramArtifact,
  type ProgramArtifactV2,
  type HostDispatcherHandlers,
  evaluate,
  validateInputEnvelope,
  validateProgramArtifact,
  validateProgramArtifactV2,
} from '@blue-quickjs/quickjs-runtime';
import { DETERMINISM_INPUT } from '@blue-quickjs/test-harness';

type ArgValue = string | true;
type ArgMap = Map<string, ArgValue>;
type StackLocation = {
  source: string;
  line: number;
  column: number;
};
type SupportedAbiOptions = {
  abiId: 'Host.v1' | 'Host.v2';
  abiVersion: 1 | 2;
  abiManifestHash: string;
};

export function parseArgMap(args: string[]): {
  command: string | null;
  options: ArgMap;
} {
  if (args.length === 0) {
    return { command: null, options: new Map() };
  }

  const [command, ...rest] = args;
  const options = new Map<string, ArgValue>();

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) {
      throw new Error(`unexpected positional argument: ${token}`);
    }
    const key = token.slice(2);
    const maybeValue = rest[i + 1];
    if (maybeValue && !maybeValue.startsWith('--')) {
      options.set(key, maybeValue);
      i += 1;
      continue;
    }
    options.set(key, true);
  }

  return { command, options };
}

export async function runCli(args: string[]): Promise<number> {
  try {
    const { command, options } = parseArgMap(args);
    if (!command) {
      printHelp();
      return 2;
    }

    switch (command) {
      case 'build':
        return await runBuild(options);
      case 'run':
        return await runEvaluate(options);
      case 'consensus-report':
        return await runConsensusReport(options);
      case 'native-report':
        return await runNativeArchiveReport(options);
      case 'native-parity':
        return await runNativeParityReport(options);
      case 'compat':
        return await runCompat(options);
      case 'inspect':
        return await runInspect(options);
      case 'explain-error':
        return await runExplainError(options);
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        return 0;
      default:
        throw new Error(`unknown command: ${command}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`blue-quickjs-cli error: ${message}`);
    return 1;
  }
}

async function runBuild(options: ArgMap): Promise<number> {
  const entryPath = getRequiredString(options, 'entry');
  const profile = (getOptionalString(options, 'profile') ??
    'baseline-v1') as DeterministicExecutionProfile;
  const cwd = getOptionalString(options, 'cwd') ?? process.cwd();
  const allowIncompatible = options.has('allow-incompatible');
  const { abiId, abiVersion, abiManifestHash } =
    resolveBuildAbiOptions(options);
  const gasVersionRaw = getOptionalString(options, 'gas-version');
  const gasVersion =
    gasVersionRaw !== undefined
      ? parseU32Option('gas-version', gasVersionRaw)
      : undefined;
  const outPath =
    getOptionalString(options, 'out') ??
    path.resolve(cwd, `${path.basename(entryPath)}.program.json`);

  const result = await buildDeterministicModulePack({
    entryPath,
    absWorkingDir: cwd,
    profile,
    emitProgramArtifact: true,
    rejectIncompatible: !allowIncompatible,
    abiId,
    abiVersion,
    abiManifestHash,
    ...(gasVersion !== undefined ? { gasVersion } : {}),
  });

  if (!result.programArtifact) {
    throw new Error('builder did not emit ProgramArtifact.v2');
  }

  const payload = {
    programArtifact: result.programArtifact,
    modulePack: result.modulePack,
    compatibilityReport: result.compatibilityReport,
  };
  await writeJsonFile(outPath, payload);

  console.log(
    JSON.stringify(
      {
        outPath,
        profile,
        compatibilityOk: result.compatibility.ok,
        moduleCount: result.modulePack.modules.length,
        graphHash: result.modulePack.graphHash,
      },
      null,
      2,
    ),
  );

  return result.compatibility.ok ? 0 : 2;
}

async function runCompat(options: ArgMap): Promise<number> {
  const entryPath = getRequiredString(options, 'entry');
  const profile = (getOptionalString(options, 'profile') ??
    'baseline-v1') as DeterministicExecutionProfile;
  const cwd = getOptionalString(options, 'cwd') ?? process.cwd();
  const outPath = getOptionalString(options, 'out');

  const result = await buildDeterministicModulePack({
    entryPath,
    absWorkingDir: cwd,
    profile,
    rejectIncompatible: false,
    emitProgramArtifact: false,
  });

  if (outPath) {
    await writeJsonFile(outPath, result.compatibilityReport);
  }

  console.log(JSON.stringify(result.compatibilityReport, null, 2));
  return result.compatibilityReport.ok ? 0 : 2;
}

async function runInspect(options: ArgMap): Promise<number> {
  const artifactPath = getRequiredString(options, 'artifact');
  const artifactJson = await readJsonFile(artifactPath);
  const program = normalizeProgramArtifact(artifactJson);
  const summary = summarizeProgramArtifact(program);
  console.log(JSON.stringify(summary, null, 2));
  return 0;
}

async function runEvaluate(options: ArgMap): Promise<number> {
  const artifactPath = getRequiredString(options, 'artifact');
  const manifestPath = getOptionalString(options, 'manifest');
  const inputPath = getOptionalString(options, 'input');
  const gasLimit = BigInt(getOptionalString(options, 'gas-limit') ?? '5000000');

  const artifactJson = await readJsonFile(artifactPath);
  const program = normalizeProgramArtifact(artifactJson);
  const manifest = manifestPath
    ? validateAbiManifest((await readJsonFile(manifestPath)) as AbiManifest)
    : defaultManifestForProgram(program);
  const input = inputPath
    ? validateInputEnvelope(await readJsonFile(inputPath))
    : validateInputEnvelope(DETERMINISM_INPUT);

  const result = await evaluate({
    program,
    input,
    gasLimit,
    manifest,
    handlers: createCliHostHandlers(),
    tape: { capacity: 64 },
  });

  if (result.ok) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          value: result.value,
          gasUsed: result.gasUsed.toString(),
          gasRemaining: result.gasRemaining.toString(),
          tapeLength: (result.tape ?? []).length,
        },
        null,
        2,
      ),
    );
    return 0;
  }

  const mappedLocations = extractStackLocations(result.message);
  console.log(
    JSON.stringify(
      {
        ok: false,
        type: result.type,
        code: result.error.code,
        tag: 'tag' in result.error ? result.error.tag : null,
        message: result.message,
        mappedLocations,
        gasUsed: result.gasUsed.toString(),
        gasRemaining: result.gasRemaining.toString(),
      },
      null,
      2,
    ),
  );
  return 1;
}

async function runExplainError(options: ArgMap): Promise<number> {
  const raw = getOptionalString(options, 'raw');
  const payloadOption = getOptionalString(options, 'payload');
  const manifestPath = getOptionalString(options, 'manifest');

  const payload = payloadOption ?? extractPayloadFromRaw(raw);
  if (!payload) {
    throw new Error('explain-error requires --payload or --raw');
  }

  const manifest = manifestPath
    ? validateAbiManifest((await readJsonFile(manifestPath)) as AbiManifest)
    : HOST_V1_MANIFEST;
  const mapped = mapVmPayload(payload, manifest);
  const mappedLocations = extractStackLocations(payload);
  console.log(
    JSON.stringify(
      {
        ...mapped,
        mappedLocations,
      },
      null,
      2,
    ),
  );
  return 0;
}

async function runConsensusReport(options: ArgMap): Promise<number> {
  const cwd = resolveCliRepoRoot(getOptionalString(options, 'cwd'));
  const scriptPath = path.join(
    cwd,
    'tools/consensus-parity/scripts/archive-consensus-reproducibility-report.mjs',
  );
  const args = buildConsensusReportArgs(options);
  return runNodeScript(scriptPath, args, cwd);
}

async function runNativeArchiveReport(options: ArgMap): Promise<number> {
  const cwd = resolveCliRepoRoot(getOptionalString(options, 'cwd'));
  const scriptPath = path.join(
    cwd,
    'tools/quickjs-native-harness/scripts/archive-reproducibility-report.mjs',
  );
  const args = buildNativeArchiveArgs(options);
  return runNodeScript(scriptPath, args, cwd);
}

async function runNativeParityReport(options: ArgMap): Promise<number> {
  const cwd = resolveCliRepoRoot(getOptionalString(options, 'cwd'));
  const scriptPath = path.join(
    cwd,
    'tools/quickjs-native-harness/scripts/parity-report.mjs',
  );
  const args = buildNativeParityArgs(options);
  return runNodeScript(scriptPath, args, cwd);
}

function createCliHostHandlers(): HostDispatcherHandlers {
  return {
    document: {
      get: (path: string) => ({ ok: { path }, units: 1 }),
      getCanonical: (path: string) => ({ ok: { canonical: path }, units: 1 }),
    },
    emit: () => ({ ok: null, units: 0 }),
  };
}

function normalizeProgramArtifact(
  value: unknown,
): ProgramArtifact | ProgramArtifactV2 {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (record.programArtifact) {
      return validateProgramArtifactV2(record.programArtifact);
    }
    if (record.program) {
      const program = record.program;
      if (
        program &&
        typeof program === 'object' &&
        !Array.isArray(program) &&
        (program as { version?: unknown }).version === 2
      ) {
        return validateProgramArtifactV2(program);
      }
      return validateProgramArtifact(program);
    }
    if (record.version === 2) {
      return validateProgramArtifactV2(record);
    }
  }

  return validateProgramArtifact(value);
}

function summarizeProgramArtifact(
  program: ProgramArtifact | ProgramArtifactV2,
): Record<string, unknown> {
  if (isProgramArtifactV2(program)) {
    const modulePack =
      program.sourceKind === 'module-pack' && 'modulePack' in program.source
        ? program.source.modulePack
        : null;
    const moduleSpecifiers = modulePack
      ? modulePack.modules.map((module) => module.specifier)
      : [];
    const modulesWithSourceMap = modulePack
      ? modulePack.modules.filter((module) => !!module.sourceMap).length
      : 0;
    const packages = modulePack
      ? [
          ...new Set(
            modulePack.modules
              .map((module) => module.originMeta?.packageName)
              .filter((value): value is string => Boolean(value)),
          ),
        ].sort()
      : [];
    return {
      version: program.version,
      sourceKind: program.sourceKind,
      executionProfile: program.executionProfile,
      abiId: program.abiId,
      abiVersion: program.abiVersion,
      abiManifestHash: program.abiManifestHash,
      engineBuildHash: program.engineBuildHash ?? null,
      gasVersion: program.gasVersion ?? null,
      entrySpecifier: modulePack?.entrySpecifier ?? null,
      entryExport: modulePack?.entryExport ?? 'default',
      moduleCount: modulePack ? modulePack.modules.length : null,
      graphHash: modulePack ? modulePack.graphHash : null,
      builderVersion: modulePack?.builderVersion ?? null,
      dependencyIntegrity: modulePack?.dependencyIntegrity ?? null,
      moduleSpecifiers,
      modulesWithSourceMap,
      diagnosticsMeta: modulePack?.diagnosticsMeta ?? null,
      npmPackages: packages,
    };
  }

  const legacy = program;
  return {
    version: 1,
    sourceKind: 'script',
    executionProfile: legacy.executionProfile ?? 'baseline-v1',
    abiId: legacy.abiId,
    abiVersion: legacy.abiVersion,
    abiManifestHash: legacy.abiManifestHash,
    gasVersion: legacy.gasVersion ?? null,
    codeUnits: legacy.code.length,
  };
}

export function extractStackLocations(message: string): StackLocation[] {
  const matches = message.matchAll(
    /([^\s:()]+(?:\.[cm]?js|\.ts|\.tsx|\.jsx|\.mjs)):(\d+):(\d+)/g,
  );
  const dedup = new Set<string>();
  const locations: StackLocation[] = [];

  for (const match of matches) {
    const source = match[1];
    const line = Number(match[2]);
    const column = Number(match[3]);
    if (
      !source ||
      !Number.isInteger(line) ||
      !Number.isInteger(column) ||
      line <= 0 ||
      column <= 0
    ) {
      continue;
    }
    const key = `${source}:${line}:${column}`;
    if (dedup.has(key)) {
      continue;
    }
    dedup.add(key);
    locations.push({ source, line, column });
  }

  return locations;
}

export function resolveBuildAbiOptions(options: ArgMap): SupportedAbiOptions {
  const abiId = getOptionalString(options, 'abi-id') ?? 'Host.v1';
  const rawAbiVersion = getOptionalString(options, 'abi-version');
  const abiVersion =
    rawAbiVersion === undefined
      ? defaultAbiVersionForId(abiId)
      : parseAbiVersion(rawAbiVersion);
  const supportedAbi = resolveSupportedAbi({ id: abiId, version: abiVersion });
  const expectedManifestHash = supportedAbi.abiManifestHash;
  const abiManifestHash =
    getOptionalString(options, 'abi-manifest-hash') ?? expectedManifestHash;

  if (abiManifestHash !== expectedManifestHash) {
    throw new Error(
      `abi manifest hash mismatch for ${abiId}@${abiVersion}: expected ${expectedManifestHash}`,
    );
  }

  return {
    abiId: supportedAbi.abiId,
    abiVersion: supportedAbi.abiVersion,
    abiManifestHash,
  };
}

function defaultAbiVersionForId(abiId: string): 1 | 2 {
  if (abiId === 'Host.v1') {
    return 1;
  }
  if (abiId === 'Host.v2') {
    return 2;
  }
  throw new Error(`unsupported ABI ${abiId}`);
}

function parseAbiVersion(rawAbiVersion: string): number {
  const abiVersion = Number.parseInt(rawAbiVersion, 10);
  if (!/^\d+$/.test(rawAbiVersion) || !Number.isSafeInteger(abiVersion)) {
    throw new Error('--abi-version must be a non-negative integer');
  }
  return abiVersion;
}

function resolveSupportedAbi(abi: {
  id: string;
  version: number;
}): SupportedAbiOptions {
  if (abi.id === 'Host.v1' && abi.version === 1) {
    return {
      abiId: 'Host.v1',
      abiVersion: 1,
      abiManifestHash: HOST_V1_HASH,
    };
  }
  if (abi.id === 'Host.v2' && abi.version === 2) {
    return {
      abiId: 'Host.v2',
      abiVersion: 2,
      abiManifestHash: HOST_V2_HASH,
    };
  }
  throw new Error(`unsupported ABI ${abi.id}@${abi.version}`);
}

function defaultManifestForProgram(
  program: ProgramArtifact | ProgramArtifactV2,
): AbiManifest {
  if (program.abiId === 'Host.v2') {
    return HOST_V2_MANIFEST;
  }
  return HOST_V1_MANIFEST;
}

function extractPayloadFromRaw(raw?: string): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith('ERROR ')) {
    const gasMarker = ' GAS remaining=';
    const gasIndex = trimmed.lastIndexOf(gasMarker);
    if (gasIndex >= 0) {
      return trimmed.slice('ERROR '.length, gasIndex).trim();
    }
    return trimmed.slice('ERROR '.length).trim();
  }
  return trimmed;
}

function getRequiredString(options: ArgMap, key: string): string {
  const value = getOptionalString(options, key);
  if (!value) {
    throw new Error(`missing required option --${key}`);
  }
  return value;
}

function getOptionalString(options: ArgMap, key: string): string | undefined {
  const value = options.get(key);
  return typeof value === 'string' ? value : undefined;
}

function parseU32Option(key: string, value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`--${key} must be a u32 integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 0xffffffff) {
    throw new Error(`--${key} must be a u32 integer`);
  }
  return parsed;
}

function resolveCliRepoRoot(cwdOverride?: string): string {
  const start = path.resolve(cwdOverride ?? process.cwd());
  const root = findWorkspaceRoot(start);
  if (!root) {
    throw new Error(
      'unable to resolve workspace root (expected pnpm-workspace.yaml in parent directories)',
    );
  }
  return root;
}

function findWorkspaceRoot(start: string): string | null {
  let cursor = start;
  while (true) {
    if (existsSync(path.join(cursor, 'pnpm-workspace.yaml'))) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      return null;
    }
    cursor = parent;
  }
}

function runNodeScript(
  scriptPath: string,
  args: string[],
  cwd: string,
): number {
  if (!existsSync(scriptPath)) {
    throw new Error(`script not found: ${scriptPath}`);
  }
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status === null) {
    throw new Error(`script exited without status: ${scriptPath}`);
  }
  return result.status;
}

export function buildConsensusReportArgs(options: ArgMap): string[] {
  const args: string[] = [];
  appendStringOption(args, options, 'out-dir');
  appendStringOption(args, options, 'base-url');
  appendStringOption(args, options, 'browser');
  appendBooleanFlag(args, options, 'reuse-server');
  return args;
}

export function buildNativeArchiveArgs(options: ArgMap): string[] {
  const args: string[] = [];
  appendBooleanFlag(args, options, 'strict');
  appendStringOption(args, options, 'out-dir');
  appendStringOption(args, options, 'gas-charge-tape-capacity');
  return args;
}

export function buildNativeParityArgs(options: ArgMap): string[] {
  const args: string[] = [];
  appendStringOption(args, options, 'out');
  appendStringOption(args, options, 'compare');
  appendStringOption(args, options, 'gas-charge-tape-capacity');
  appendStringOption(args, options, 'gas-delta-baseline');
  appendStringOption(args, options, 'write-gas-delta-baseline');
  appendBooleanFlag(args, options, 'assert-match');
  appendBooleanFlag(args, options, 'ignore-gas');
  appendBooleanFlag(args, options, 'include-gas-trace');
  appendBooleanFlag(args, options, 'include-gas-charge-tape');
  return args;
}

function appendStringOption(
  args: string[],
  options: ArgMap,
  key: string,
): void {
  const value = getOptionalString(options, key);
  if (value !== undefined) {
    args.push(`--${key}`, value);
  }
}

function appendBooleanFlag(args: string[], options: ArgMap, key: string): void {
  if (options.has(key)) {
    args.push(`--${key}`);
  }
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const text = await readFile(path.resolve(filePath), 'utf8');
  return JSON.parse(text);
}

async function writeJsonFile(
  filePath: string,
  payload: unknown,
): Promise<void> {
  await writeFile(
    path.resolve(filePath),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );
}

function mapVmPayload(payload: string, manifest: AbiManifest) {
  const canonicalManifest = validateAbiManifest(manifest);
  if (payload.includes('OutOfGas')) {
    return {
      kind: 'out-of-gas',
      code: 'OUT_OF_GAS',
      tag: 'vm/out_of_gas',
      message: payload,
      manifestAbiId: canonicalManifest.abi_id,
      manifestAbiVersion: canonicalManifest.abi_version,
    };
  }
  if (payload.includes('ModuleSpecifierNotFound')) {
    return {
      kind: 'module-pack',
      code: 'MODULE_SPECIFIER_NOT_FOUND',
      tag: 'vm/module_pack',
      message: payload,
      manifestAbiId: canonicalManifest.abi_id,
      manifestAbiVersion: canonicalManifest.abi_version,
    };
  }
  if (payload.includes('ModuleExportMissing')) {
    return {
      kind: 'module-pack',
      code: 'MODULE_EXPORT_MISSING',
      tag: 'vm/module_pack',
      message: payload,
      manifestAbiId: canonicalManifest.abi_id,
      manifestAbiVersion: canonicalManifest.abi_version,
    };
  }
  if (payload.includes('ModuleResolutionError')) {
    return {
      kind: 'module-pack',
      code: 'MODULE_RESOLUTION_ERROR',
      tag: 'vm/module_pack',
      message: payload,
      manifestAbiId: canonicalManifest.abi_id,
      manifestAbiVersion: canonicalManifest.abi_version,
    };
  }
  if (payload.includes('ModuleEvaluationError')) {
    return {
      kind: 'module-pack',
      code: 'MODULE_EVALUATION_ERROR',
      tag: 'vm/module_pack',
      message: payload,
      manifestAbiId: canonicalManifest.abi_id,
      manifestAbiVersion: canonicalManifest.abi_version,
    };
  }
  if (payload.includes('HostError')) {
    return {
      kind: 'host',
      code: 'HOST_ERROR',
      tag: 'vm/host',
      message: payload,
      manifestAbiId: canonicalManifest.abi_id,
      manifestAbiVersion: canonicalManifest.abi_version,
    };
  }
  return {
    kind: 'js-exception',
    code: 'JS_EXCEPTION',
    tag: 'vm/js_exception',
    message: payload,
    manifestAbiId: canonicalManifest.abi_id,
    manifestAbiVersion: canonicalManifest.abi_version,
  };
}

function isProgramArtifactV2(
  program: ProgramArtifact | ProgramArtifactV2,
): program is ProgramArtifactV2 {
  return 'version' in program && program.version === 2;
}

function printHelp(): void {
  console.log(
    [
      'blue-quickjs CLI',
      '',
      'Commands:',
      '  build --entry <path> [--profile compat-binary-v1] [--out artifact.json] [--abi-id Host.v2] [--abi-version 2] [--abi-manifest-hash <hex>] [--gas-version <u32>] [--allow-incompatible]',
      '  compat --entry <path> [--profile baseline-v1] [--out report.json]',
      '  run --artifact <path> [--manifest <path>] [--input <path>] [--gas-limit <u64>]',
      '  inspect --artifact <path>',
      '  explain-error --payload <vm-payload> | --raw "ERROR ..."',
      '  consensus-report [--out-dir artifacts/reproducibility-consensus] [--base-url http://127.0.0.1:4300] [--browser chromium|firefox|webkit] [--reuse-server]',
      '  native-report [--strict] [--out-dir artifacts/reproducibility] [--gas-charge-tape-capacity <u32>]',
      '  native-parity [--assert-match] [--out parity.json] [--compare previous.json] [--ignore-gas] [--include-gas-trace] [--include-gas-charge-tape]',
    ].join('\n'),
  );
}
