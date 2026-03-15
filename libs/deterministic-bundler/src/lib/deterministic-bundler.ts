import { build } from 'esbuild';
import { parse } from 'acorn';
import { builtinModules } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export type DeterministicExecutionProfile = 'baseline-v1' | 'compat-regexp-v1';

export interface BundleDeterministicProgramOptions {
  entryPath: string;
  absWorkingDir?: string;
  profile?: DeterministicExecutionProfile;
  globalName?: string;
  rejectIncompatible?: boolean;
}

export interface CompatibilityDiagnostic {
  filePath: string;
  ruleId: string;
  message: string;
}

export interface CompatibilityScanResult {
  ok: boolean;
  diagnostics: CompatibilityDiagnostic[];
}

export interface BundleDeterministicProgramResult {
  code: string;
  contentHash: string;
  meta: {
    entryPath: string;
    modulePaths: string[];
    profile: DeterministicExecutionProfile;
    compatibility: CompatibilityScanResult;
  };
}

export interface ModulePackOriginMeta {
  packageName?: string;
  packageVersion?: string;
  integrity?: string;
  originalPath?: string;
}

export interface ModulePackModule {
  specifier: string;
  source: string;
  sourceMap?: string;
  originMeta?: ModulePackOriginMeta;
}

export interface ModulePackV1 {
  version: 1;
  entrySpecifier: string;
  entryExport: string;
  modules: ModulePackModule[];
  graphHash: string;
  builderVersion: string;
  dependencyIntegrity: string;
  diagnosticsMeta?: {
    entryPath: string;
    modulePaths: string[];
  };
}

export interface BuildDeterministicModulePackOptions {
  entryPath: string;
  absWorkingDir?: string;
  profile?: DeterministicExecutionProfile;
  rejectIncompatible?: boolean;
  entryExport?: string;
  emitScriptArtifact?: boolean;
  emitProgramArtifact?: boolean;
  builderVersion?: string;
  dependencyIntegrity?: string;
  abiId?: string;
  abiVersion?: number;
  abiManifestHash?: string;
  engineBuildHash?: string;
}

export interface ProgramArtifactV2 {
  version: 2;
  abiId: string;
  abiVersion: number;
  abiManifestHash: string;
  engineBuildHash?: string;
  executionProfile: DeterministicExecutionProfile;
  sourceKind: 'module-pack';
  source: {
    modulePack: ModulePackV1;
  };
}

export interface CompatibilityReportV1 {
  version: 1;
  profile: DeterministicExecutionProfile;
  ok: boolean;
  moduleCount: number;
  diagnosticCounts: Record<string, number>;
  diagnostics: CompatibilityDiagnostic[];
}

export interface BuildDeterministicModulePackResult {
  modulePack: ModulePackV1;
  compatibility: CompatibilityScanResult;
  compatibilityReport: CompatibilityReportV1;
  scriptArtifact?: BundleDeterministicProgramResult;
  programArtifact?: ProgramArtifactV2;
}

export class DeterministicBundlerError extends Error {
  constructor(
    message: string,
    public readonly diagnostics: CompatibilityDiagnostic[],
  ) {
    super(message);
    this.name = 'DeterministicBundlerError';
  }
}

const DEFAULT_PROFILE: DeterministicExecutionProfile = 'baseline-v1';
const DEFAULT_GLOBAL_NAME = '__blueDeterministicBundle';
const DEFAULT_ENTRY_EXPORT = 'default';
const DEFAULT_BUILDER_VERSION = 'deterministic-builder-v1';
const BUILDER_OUT_DIR = '__blue_deterministic_builder_out__';

const NODE_BUILTINS = new Set(
  builtinModules.flatMap((name) =>
    name.startsWith('node:') ? [name, name.slice('node:'.length)] : [name],
  ),
);

const FORBIDDEN_IDENTIFIER_RULES = new Map<string, string>([
  ['WebAssembly', 'webassembly_disabled'],
  ['ArrayBuffer', 'arraybuffer_disabled'],
  ['SharedArrayBuffer', 'sharedarraybuffer_disabled'],
  ['DataView', 'dataview_disabled'],
  ['Atomics', 'atomics_disabled'],
  ['Proxy', 'proxy_disabled'],
  ['Date', 'date_disabled'],
  ['setTimeout', 'timers_disabled'],
  ['setInterval', 'timers_disabled'],
  ['queueMicrotask', 'microtasks_disabled'],
]);

const FORBIDDEN_TYPED_ARRAYS = new Set([
  'Uint8Array',
  'Uint8ClampedArray',
  'Int8Array',
  'Uint16Array',
  'Int16Array',
  'Uint32Array',
  'Int32Array',
  'BigInt64Array',
  'BigUint64Array',
  'Float16Array',
  'Float32Array',
  'Float64Array',
]);

export async function bundleDeterministicProgram(
  options: BundleDeterministicProgramOptions,
): Promise<BundleDeterministicProgramResult> {
  const absWorkingDir = path.resolve(options.absWorkingDir ?? process.cwd());
  const absEntryPath = path.resolve(absWorkingDir, options.entryPath);
  const profile = options.profile ?? DEFAULT_PROFILE;
  const globalName = options.globalName ?? DEFAULT_GLOBAL_NAME;
  const rejectIncompatible = options.rejectIncompatible ?? true;

  const result = await build({
    absWorkingDir,
    entryPoints: [absEntryPath],
    bundle: true,
    write: false,
    outfile: 'bundle.js',
    format: 'iife',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    target: 'es2020',
    globalName,
    legalComments: 'none',
    sourcemap: false,
    metafile: true,
    charset: 'utf8',
  });

  const jsOutput = result.outputFiles?.find((file) =>
    file.path.endsWith('.js'),
  );
  if (!jsOutput) {
    throw new Error('Bundler did not produce a JavaScript output');
  }

  const modulePaths = collectNormalizedModulePaths(
    result.metafile?.inputs ?? {},
    absWorkingDir,
  );
  const sourceByPath = loadSourceByPath(modulePaths);
  const compatibility = scanCompatibility({
    sourceByPath,
    profile,
  });

  if (rejectIncompatible && !compatibility.ok) {
    throw new DeterministicBundlerError(
      formatCompatibilityMessage(compatibility.diagnostics),
      compatibility.diagnostics,
    );
  }

  const normalizedBundleText = normalizeLineEndings(jsOutput.text).trimEnd();
  const code = `${normalizedBundleText}\n;${globalName}.default;\n`;

  return {
    code,
    contentHash: sha256Hex(code),
    meta: {
      entryPath: normalizePath(absEntryPath),
      modulePaths,
      profile,
      compatibility,
    },
  };
}

export async function buildDeterministicModulePack(
  options: BuildDeterministicModulePackOptions,
): Promise<BuildDeterministicModulePackResult> {
  const absWorkingDir = path.resolve(options.absWorkingDir ?? process.cwd());
  const absEntryPath = path.resolve(absWorkingDir, options.entryPath);
  const profile = options.profile ?? DEFAULT_PROFILE;
  const rejectIncompatible = options.rejectIncompatible ?? true;
  const entryExport = options.entryExport ?? DEFAULT_ENTRY_EXPORT;
  const builderVersion = options.builderVersion ?? DEFAULT_BUILDER_VERSION;
  const outputDir = path.join(absWorkingDir, BUILDER_OUT_DIR);
  const dependencyIntegrity =
    options.dependencyIntegrity ?? computeDependencyIntegrity(absWorkingDir);

  const result = await build({
    absWorkingDir,
    entryPoints: [absEntryPath],
    bundle: true,
    splitting: true,
    write: false,
    outdir: BUILDER_OUT_DIR,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    target: 'es2020',
    legalComments: 'none',
    sourcemap: 'external',
    metafile: true,
    charset: 'utf8',
  });

  const outputMetaByAbsolutePath = buildOutputMetadataLookup(
    result.metafile?.outputs ?? {},
    absWorkingDir,
  );
  const sourceMapBySpecifier = collectOutputMaps(result.outputFiles ?? [], {
    absWorkingDir,
  });
  const modules = collectModulePackModules(result.outputFiles ?? [], {
    absWorkingDir,
    outputDir,
    outputMetaByAbsolutePath,
    sourceMapBySpecifier,
    dependencyIntegrity,
  });
  const entrySpecifier = resolveEntrySpecifier(
    result.metafile?.outputs ?? {},
    absWorkingDir,
    absEntryPath,
  );

  const sourceByPath = Object.fromEntries(
    modules.map((module) => [module.specifier, module.source]),
  );
  const compatibility = scanCompatibility({
    sourceByPath,
    profile,
  });

  if (rejectIncompatible && !compatibility.ok) {
    throw new DeterministicBundlerError(
      formatCompatibilityMessage(compatibility.diagnostics),
      compatibility.diagnostics,
    );
  }

  const modulePackWithoutHash = {
    version: 1 as const,
    entrySpecifier,
    entryExport,
    modules,
    builderVersion,
    dependencyIntegrity,
    diagnosticsMeta: {
      entryPath: normalizePath(absEntryPath),
      modulePaths: modules.map((module) => module.specifier),
    },
  };
  const graphHash = computeModulePackGraphHash(modulePackWithoutHash);
  const modulePack: ModulePackV1 = {
    ...modulePackWithoutHash,
    graphHash,
  };
  const compatibilityReport = buildCompatibilityReport({
    profile,
    compatibility,
    moduleCount: modules.length,
  });

  const scriptArtifact = options.emitScriptArtifact
    ? await bundleDeterministicProgram({
        entryPath: options.entryPath,
        absWorkingDir,
        profile,
        rejectIncompatible,
      })
    : undefined;
  const programArtifact = options.emitProgramArtifact
    ? buildProgramArtifactV2({
        modulePack,
        profile,
        abiId: options.abiId ?? 'Host.v1',
        abiVersion: options.abiVersion ?? 1,
        abiManifestHash: expectHexStringOption(
          options.abiManifestHash,
          'abiManifestHash',
        ),
        engineBuildHash: options.engineBuildHash
          ? expectHexStringOption(options.engineBuildHash, 'engineBuildHash')
          : undefined,
      })
    : undefined;

  return {
    modulePack,
    compatibility,
    compatibilityReport,
    ...(scriptArtifact ? { scriptArtifact } : {}),
    ...(programArtifact ? { programArtifact } : {}),
  };
}

export interface ScanCompatibilityOptions {
  sourceByPath: Record<string, string>;
  profile?: DeterministicExecutionProfile;
}

export function scanCompatibility(
  options: ScanCompatibilityOptions,
): CompatibilityScanResult {
  const profile = options.profile ?? DEFAULT_PROFILE;
  const diagnostics = new Map<string, CompatibilityDiagnostic>();

  const paths = Object.keys(options.sourceByPath).sort();
  for (const filePath of paths) {
    const source = options.sourceByPath[filePath] ?? '';
    const parsed = safeParseModule(source);
    if (!parsed.ok) {
      addDiagnostic(
        diagnostics,
        filePath,
        'parse_error',
        `Failed to parse source (${parsed.message})`,
      );
      continue;
    }

    walk(parsed.ast, (node) => {
      scanNode(node, filePath, profile, diagnostics);
    });
  }

  const sortedDiagnostics = [...diagnostics.values()].sort((a, b) => {
    if (a.filePath !== b.filePath) {
      return a.filePath.localeCompare(b.filePath);
    }
    if (a.ruleId !== b.ruleId) {
      return a.ruleId.localeCompare(b.ruleId);
    }
    return a.message.localeCompare(b.message);
  });

  return {
    ok: sortedDiagnostics.length === 0,
    diagnostics: sortedDiagnostics,
  };
}

type AstNode = Record<string, unknown> & { type: string };

function scanNode(
  node: AstNode,
  filePath: string,
  profile: DeterministicExecutionProfile,
  diagnostics: Map<string, CompatibilityDiagnostic>,
): void {
  if (node.type === 'ImportExpression') {
    addDiagnostic(
      diagnostics,
      filePath,
      'dynamic_import_disabled',
      'dynamic import() is disabled in deterministic mode',
    );
    return;
  }

  if (
    node.type === 'ImportDeclaration' ||
    node.type === 'ExportAllDeclaration'
  ) {
    const source = asString(
      (node as { source?: { value?: unknown } }).source?.value,
    );
    if (source && isNodeBuiltinSpecifier(source)) {
      addDiagnostic(
        diagnostics,
        filePath,
        'node_builtin_import',
        `node builtin import is disabled: ${source}`,
      );
    }
    return;
  }

  if (node.type === 'CallExpression') {
    const callee = asNode((node as { callee?: unknown }).callee);
    if (callee?.type === 'Identifier') {
      const identifier = asString((callee as { name?: unknown }).name);
      if (identifier === 'require') {
        const firstArg = asNode(
          (node as { arguments?: unknown[] }).arguments?.[0],
        );
        if (firstArg?.type === 'Literal') {
          const required = asString((firstArg as { value?: unknown }).value);
          if (required && isNodeBuiltinSpecifier(required)) {
            addDiagnostic(
              diagnostics,
              filePath,
              'node_builtin_require',
              `node builtin require() is disabled: ${required}`,
            );
          }
        }
      }

      if (identifier && FORBIDDEN_IDENTIFIER_RULES.has(identifier)) {
        addDiagnostic(
          diagnostics,
          filePath,
          FORBIDDEN_IDENTIFIER_RULES.get(identifier) ?? 'forbidden_identifier',
          `forbidden API used: ${identifier}`,
        );
      }
    }

    if (isMathRandomCall(callee)) {
      addDiagnostic(
        diagnostics,
        filePath,
        'math_random_disabled',
        'Math.random() is disabled in deterministic mode',
      );
    }

    if (isConsoleCall(callee)) {
      addDiagnostic(
        diagnostics,
        filePath,
        'console_disabled',
        'console APIs are disabled in deterministic mode',
      );
    }

    if (isRegExpCall(callee) && profile === 'baseline-v1') {
      addDiagnostic(
        diagnostics,
        filePath,
        'regexp_disabled',
        'RegExp is disabled in baseline deterministic profile',
      );
    }

    return;
  }

  if (node.type === 'NewExpression') {
    const callee = asNode((node as { callee?: unknown }).callee);
    if (callee?.type === 'Identifier') {
      const identifier = asString((callee as { name?: unknown }).name);
      if (!identifier) {
        return;
      }

      if (FORBIDDEN_TYPED_ARRAYS.has(identifier)) {
        addDiagnostic(
          diagnostics,
          filePath,
          'typed_array_disabled',
          `typed array constructor is disabled: ${identifier}`,
        );
        return;
      }

      if (FORBIDDEN_IDENTIFIER_RULES.has(identifier)) {
        addDiagnostic(
          diagnostics,
          filePath,
          FORBIDDEN_IDENTIFIER_RULES.get(identifier) ?? 'forbidden_identifier',
          `forbidden API used: ${identifier}`,
        );
        return;
      }

      if (identifier === 'RegExp' && profile === 'baseline-v1') {
        addDiagnostic(
          diagnostics,
          filePath,
          'regexp_disabled',
          'RegExp is disabled in baseline deterministic profile',
        );
      }
    }
    return;
  }

  if (isRegExpLiteral(node) && profile === 'baseline-v1') {
    addDiagnostic(
      diagnostics,
      filePath,
      'regexp_literal_disabled',
      'RegExp literals are disabled in baseline deterministic profile',
    );
  }
}

function safeParseModule(
  source: string,
): { ok: true; ast: AstNode } | { ok: false; message: string } {
  try {
    const ast = parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
    }) as unknown as AstNode;
    return { ok: true, ast };
  } catch (error) {
    return { ok: false, message: stringifyError(error) };
  }
}

function walk(node: AstNode, visit: (node: AstNode) => void): void {
  visit(node);
  const keys = Object.keys(node).sort();
  for (const key of keys) {
    const value = (node as Record<string, unknown>)[key];
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          walk(item, visit);
        }
      }
      continue;
    }

    if (isNode(value)) {
      walk(value, visit);
    }
  }
}

function collectNormalizedModulePaths(
  metafileInputs: Record<string, unknown>,
  absWorkingDir: string,
): string[] {
  const paths = Object.keys(metafileInputs).map((input) => {
    const absolute = path.isAbsolute(input)
      ? input
      : path.resolve(absWorkingDir, input);
    return normalizePath(absolute);
  });
  return [...new Set(paths)].sort();
}

function buildOutputMetadataLookup(
  outputs: Record<string, { inputs?: Record<string, unknown> }>,
  absWorkingDir: string,
): Map<string, { inputs?: Record<string, unknown> }> {
  const lookup = new Map<string, { inputs?: Record<string, unknown> }>();
  for (const [outputPath, meta] of Object.entries(outputs)) {
    const absolutePath = path.isAbsolute(outputPath)
      ? outputPath
      : path.resolve(absWorkingDir, outputPath);
    lookup.set(normalizePath(absolutePath), meta);
  }
  return lookup;
}

function collectOutputMaps(
  outputFiles: Array<{ path: string; text: string }>,
  options: { absWorkingDir: string },
): Map<string, string> {
  const bySpecifier = new Map<string, string>();
  const maps = outputFiles.filter((file) => file.path.endsWith('.map'));
  for (const mapFile of maps) {
    const mapPath = mapFile.path.slice(0, -'.map'.length);
    const specifier = toModuleSpecifier(mapPath, {
      absWorkingDir: options.absWorkingDir,
      outputDir: path.join(options.absWorkingDir, BUILDER_OUT_DIR),
    });
    bySpecifier.set(
      specifier,
      sanitizeSourceMap(mapFile.text, {
        absWorkingDir: options.absWorkingDir,
      }),
    );
  }
  return bySpecifier;
}

function collectModulePackModules(
  outputFiles: Array<{ path: string; text: string }>,
  options: {
    absWorkingDir: string;
    outputDir: string;
    outputMetaByAbsolutePath: Map<string, { inputs?: Record<string, unknown> }>;
    sourceMapBySpecifier: Map<string, string>;
    dependencyIntegrity: string;
  },
): ModulePackModule[] {
  const jsFiles = outputFiles.filter((file) => /\.m?js$/.test(file.path));
  const modules = jsFiles.map((file) => {
    const specifier = toModuleSpecifier(file.path, {
      absWorkingDir: options.absWorkingDir,
      outputDir: options.outputDir,
    });
    const normalizedSource = `${normalizeLineEndings(file.text).trimEnd()}\n`;
    const meta = options.outputMetaByAbsolutePath.get(normalizePath(file.path));

    const module: ModulePackModule = {
      specifier,
      source: normalizedSource,
    };

    const sourceMap = options.sourceMapBySpecifier.get(specifier);
    if (sourceMap) {
      module.sourceMap = sourceMap;
    }

    const originMeta = resolveOriginMeta(
      meta?.inputs ? Object.keys(meta.inputs) : [],
      {
        absWorkingDir: options.absWorkingDir,
        dependencyIntegrity: options.dependencyIntegrity,
      },
    );
    if (originMeta) {
      module.originMeta = originMeta;
    }

    return module;
  });

  return modules.sort((a, b) => a.specifier.localeCompare(b.specifier));
}

function resolveEntrySpecifier(
  outputs: Record<string, { entryPoint?: string }>,
  absWorkingDir: string,
  absEntryPath: string,
): string {
  const normalizedEntry = normalizePath(absEntryPath);
  const entryOutputPath = Object.entries(outputs)
    .map(([outputPath, meta]) => {
      const absoluteOutput = path.isAbsolute(outputPath)
        ? outputPath
        : path.resolve(absWorkingDir, outputPath);
      const absoluteEntry = meta.entryPoint
        ? path.resolve(absWorkingDir, meta.entryPoint)
        : null;
      return {
        absoluteOutput,
        absoluteEntry: absoluteEntry ? normalizePath(absoluteEntry) : null,
      };
    })
    .find(
      (candidate) => candidate.absoluteEntry === normalizedEntry,
    )?.absoluteOutput;

  if (!entryOutputPath) {
    throw new Error(
      `Unable to resolve entry output for ${normalizePath(absEntryPath)}`,
    );
  }

  return toModuleSpecifier(entryOutputPath, {
    absWorkingDir,
    outputDir: path.join(absWorkingDir, BUILDER_OUT_DIR),
  });
}

function toModuleSpecifier(
  outputPath: string,
  options: { absWorkingDir: string; outputDir: string },
): string {
  const absoluteOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(options.absWorkingDir, outputPath);
  const relative = normalizePath(
    path.relative(options.outputDir, absoluteOutputPath),
  );
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function sanitizeSourceMap(
  sourceMap: string,
  options: { absWorkingDir: string },
): string {
  const parsed = JSON.parse(sourceMap) as Record<string, unknown>;
  if (Array.isArray(parsed.sources)) {
    parsed.sources = parsed.sources.map((source) => {
      if (typeof source !== 'string') {
        return source;
      }
      const normalized = normalizePath(source);
      if (path.isAbsolute(source)) {
        return normalizePath(path.relative(options.absWorkingDir, source));
      }
      return normalized;
    });
  }
  if (
    typeof parsed.sourceRoot === 'string' &&
    path.isAbsolute(parsed.sourceRoot)
  ) {
    parsed.sourceRoot = normalizePath(
      path.relative(options.absWorkingDir, parsed.sourceRoot),
    );
  }
  if (typeof parsed.file === 'string' && path.isAbsolute(parsed.file)) {
    parsed.file = normalizePath(
      path.relative(options.absWorkingDir, parsed.file),
    );
  }
  return stableStringify(parsed);
}

function resolveOriginMeta(
  inputPaths: string[],
  options: { absWorkingDir: string; dependencyIntegrity: string },
): ModulePackOriginMeta | undefined {
  if (inputPaths.length === 0) {
    return undefined;
  }
  const normalizedInputs = inputPaths
    .map((inputPath) =>
      path.isAbsolute(inputPath)
        ? inputPath
        : path.resolve(options.absWorkingDir, inputPath),
    )
    .map((inputPath) => normalizePath(inputPath))
    .sort();
  const selectedInputPath =
    normalizedInputs.find((inputPath) =>
      inputPath.includes('/node_modules/'),
    ) ?? normalizedInputs[0];

  const originMeta: ModulePackOriginMeta = {
    originalPath: normalizePath(
      path.relative(options.absWorkingDir, selectedInputPath),
    ),
  };

  const packageInfo = resolvePackageInfoFromInputPath(selectedInputPath);
  if (packageInfo) {
    originMeta.packageName = packageInfo.packageName;
    originMeta.packageVersion = packageInfo.packageVersion;
    originMeta.integrity = options.dependencyIntegrity;
  }

  return originMeta;
}

function resolvePackageInfoFromInputPath(
  inputPath: string,
): { packageName: string; packageVersion?: string } | null {
  const marker = '/node_modules/';
  const markerIndex = inputPath.lastIndexOf(marker);
  if (markerIndex < 0) {
    return null;
  }
  const fromNodeModules = inputPath.slice(markerIndex + marker.length);
  const segments = fromNodeModules.split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  let packageName: string;
  if (segments[0].startsWith('@')) {
    if (segments.length < 2) {
      return null;
    }
    packageName = `${segments[0]}/${segments[1]}`;
  } else {
    packageName = segments[0];
  }

  const packageRoot = inputPath.slice(
    0,
    markerIndex + marker.length + packageName.length,
  );
  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return { packageName };
  }

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as {
      version?: string;
    };
    return {
      packageName,
      ...(typeof packageJson.version === 'string'
        ? { packageVersion: packageJson.version }
        : {}),
    };
  } catch {
    return { packageName };
  }
}

function computeDependencyIntegrity(absWorkingDir: string): string {
  const lockfilePath = findNearestLockfile(absWorkingDir);
  if (!lockfilePath) {
    return sha256Hex('no-lockfile');
  }
  const bytes = fs.readFileSync(lockfilePath);
  return createHash('sha256').update(bytes).digest('hex');
}

function findNearestLockfile(startDir: string): string | null {
  const lockfiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];
  let cursor = path.resolve(startDir);

  while (true) {
    for (const lockfile of lockfiles) {
      const candidate = path.join(cursor, lockfile);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      return null;
    }
    cursor = parent;
  }
}

function computeModulePackGraphHash(pack: {
  version: 1;
  entrySpecifier: string;
  entryExport: string;
  modules: ModulePackModule[];
  builderVersion: string;
  dependencyIntegrity: string;
}): string {
  const canonical = {
    version: pack.version,
    entrySpecifier: pack.entrySpecifier,
    entryExport: pack.entryExport,
    modules: pack.modules.map((module) => ({
      specifier: module.specifier,
      source: module.source,
      ...(module.sourceMap ? { sourceMap: module.sourceMap } : {}),
    })),
    builderVersion: pack.builderVersion,
    dependencyIntegrity: pack.dependencyIntegrity,
  };
  return sha256Hex(stableStringify(canonical));
}

function buildCompatibilityReport(options: {
  profile: DeterministicExecutionProfile;
  compatibility: CompatibilityScanResult;
  moduleCount: number;
}): CompatibilityReportV1 {
  const diagnosticCounts = options.compatibility.diagnostics.reduce<
    Record<string, number>
  >((accumulator, diagnostic) => {
    accumulator[diagnostic.ruleId] = (accumulator[diagnostic.ruleId] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    version: 1,
    profile: options.profile,
    ok: options.compatibility.ok,
    moduleCount: options.moduleCount,
    diagnosticCounts,
    diagnostics: options.compatibility.diagnostics,
  };
}

function buildProgramArtifactV2(options: {
  modulePack: ModulePackV1;
  profile: DeterministicExecutionProfile;
  abiId: string;
  abiVersion: number;
  abiManifestHash: string;
  engineBuildHash?: string;
}): ProgramArtifactV2 {
  return {
    version: 2,
    abiId: options.abiId,
    abiVersion: options.abiVersion,
    abiManifestHash: options.abiManifestHash,
    ...(options.engineBuildHash
      ? {
          engineBuildHash: options.engineBuildHash,
        }
      : {}),
    executionProfile: options.profile,
    sourceKind: 'module-pack',
    source: {
      modulePack: options.modulePack,
    },
  };
}

function expectHexStringOption(
  value: string | undefined,
  fieldName: string,
): string {
  if (!value) {
    throw new Error(`buildDeterministicModulePack requires ${fieldName}`);
  }
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${fieldName} must be a lowercase 64-char hex string`);
  }
  return value;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function loadSourceByPath(modulePaths: string[]): Record<string, string> {
  const sourceByPath: Record<string, string> = {};
  for (const modulePath of modulePaths) {
    if (!fs.existsSync(modulePath)) {
      continue;
    }
    sourceByPath[modulePath] = fs.readFileSync(modulePath, 'utf8');
  }
  return sourceByPath;
}

function addDiagnostic(
  diagnostics: Map<string, CompatibilityDiagnostic>,
  filePath: string,
  ruleId: string,
  message: string,
): void {
  const normalizedPath = normalizePath(filePath);
  const key = `${normalizedPath}::${ruleId}::${message}`;
  if (diagnostics.has(key)) {
    return;
  }
  diagnostics.set(key, {
    filePath: normalizedPath,
    ruleId,
    message,
  });
}

function isMathRandomCall(node: AstNode | null): boolean {
  if (!node || node.type !== 'MemberExpression') {
    return false;
  }
  const object = asNode((node as { object?: unknown }).object);
  const property = asNode((node as { property?: unknown }).property);
  if (!object || !property) {
    return false;
  }
  return (
    object.type === 'Identifier' &&
    asString((object as { name?: unknown }).name) === 'Math' &&
    property.type === 'Identifier' &&
    asString((property as { name?: unknown }).name) === 'random'
  );
}

function isConsoleCall(node: AstNode | null): boolean {
  if (!node || node.type !== 'MemberExpression') {
    return false;
  }
  const object = asNode((node as { object?: unknown }).object);
  return (
    object?.type === 'Identifier' &&
    asString((object as { name?: unknown }).name) === 'console'
  );
}

function isRegExpCall(node: AstNode | null): boolean {
  return (
    !!node &&
    node.type === 'Identifier' &&
    asString((node as { name?: unknown }).name) === 'RegExp'
  );
}

function isRegExpLiteral(node: AstNode): boolean {
  if (node.type !== 'Literal') {
    return false;
  }
  return Boolean((node as { regex?: unknown }).regex);
}

function isNode(value: unknown): value is AstNode {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

function asNode(value: unknown): AstNode | null {
  return isNode(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isNodeBuiltinSpecifier(specifier: string): boolean {
  if (specifier.startsWith('node:')) {
    return true;
  }
  return NODE_BUILTINS.has(specifier);
}

function normalizePath(input: string): string {
  return input.split(path.sep).join('/');
}

function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function formatCompatibilityMessage(
  diagnostics: CompatibilityDiagnostic[],
): string {
  const lines = diagnostics.map(
    (diagnostic) =>
      `- [${diagnostic.ruleId}] ${diagnostic.filePath}: ${diagnostic.message}`,
  );
  return `Compatibility scan failed:\n${lines.join('\n')}`;
}
