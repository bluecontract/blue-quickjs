import { parse } from 'acorn';
import { executionProfileHasCapability } from '@blue-quickjs/execution-profiles';
import type {
  ExecutionProfile,
  ModulePackV1,
  ModulePackV1Module,
} from './quickjs-runtime.js';
import {
  compareUtf8ByteOrder,
  computeModulePackGraphHash,
  sha256HexUtf8,
} from './module-pack-graph-hash.js';

export interface BuildModulePackFromSourcesOptions {
  readonly entrySpecifier: string;
  readonly entryExport?: string;
  readonly sources:
    | Readonly<Record<string, string>>
    | readonly ModulePackSourceEntry[];
  readonly sourceMaps?: Readonly<Record<string, string>>;
  readonly importAliases?: Readonly<Record<string, string>>;
  readonly profile?: ExecutionProfile;
  readonly builderVersion?: string;
  readonly dependencyIntegrity?: string;
  readonly rejectIncompatible?: boolean;
  readonly includeUnreachable?: boolean;
}

export interface ModulePackSourceEntry {
  readonly specifier: string;
  readonly source: string;
  readonly sourceMap?: string;
  readonly originMeta?: ModulePackV1Module['originMeta'];
}

export type ModulePackBuildDiagnosticCode =
  | 'INVALID_SPECIFIER'
  | 'DUPLICATE_SPECIFIER'
  | 'ENTRY_MODULE_MISSING'
  | 'PARSE_ERROR'
  | 'MISSING_IMPORT'
  | 'DYNAMIC_IMPORT_DISABLED'
  | 'COMMONJS_REQUIRE_DISABLED'
  | 'NODE_BUILTIN_IMPORT_DISABLED'
  | 'BARE_IMPORT_DISABLED'
  | 'COMPATIBILITY_ERROR';

export interface ModulePackBuildDiagnostic {
  readonly code: ModulePackBuildDiagnosticCode;
  readonly message: string;
  readonly specifier?: string;
  readonly importer?: string;
  readonly importSpecifier?: string;
}

export class ModulePackBuildError extends Error {
  readonly diagnostics: readonly ModulePackBuildDiagnostic[];

  constructor(diagnostics: readonly ModulePackBuildDiagnostic[]) {
    super(formatModulePackBuildDiagnostics(diagnostics));
    this.name = 'ModulePackBuildError';
    this.diagnostics = diagnostics;
  }
}

const DEFAULT_PROFILE: ExecutionProfile = 'baseline-v1';
const DEFAULT_ENTRY_EXPORT = 'default';
const DEFAULT_BUILDER_VERSION = 'blue-quickjs-module-pack-from-sources-v1';
const NO_EXTERNAL_DEPENDENCIES_INTEGRITY_INPUT =
  'blue-quickjs:no-external-dependencies:v1';

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

const NODE_BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
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

const FORBIDDEN_GLOBAL_RULES = new Map<string, string>([
  ['Atomics', 'atomics_disabled'],
  ['Date', 'date_disabled'],
  ['Proxy', 'proxy_disabled'],
  ['WebAssembly', 'webassembly_disabled'],
]);

const TIMER_RULES = new Set([
  'clearInterval',
  'clearTimeout',
  'setInterval',
  'setTimeout',
]);

type SourceEntryInternal = ModulePackV1Module & {
  readonly specifier: string;
  readonly source: string;
};

type AstNode = Record<string, unknown> & { type: string };

type ImportEdge = {
  readonly raw: string;
  readonly importer: string;
};

type ScannedModule = {
  readonly imports: readonly ImportEdge[];
  readonly diagnostics: readonly ModulePackBuildDiagnostic[];
};

export async function buildModulePackFromSources(
  options: BuildModulePackFromSourcesOptions,
): Promise<ModulePackV1> {
  const profile = options.profile ?? DEFAULT_PROFILE;
  const rejectIncompatible = options.rejectIncompatible ?? true;
  const includeUnreachable = options.includeUnreachable ?? false;
  const entryExport =
    options.entryExport && options.entryExport.length > 0
      ? options.entryExport
      : DEFAULT_ENTRY_EXPORT;
  const diagnostics: ModulePackBuildDiagnostic[] = [];

  const entrySpecifier = normalizeSpecifierWithDiagnostics(
    options.entrySpecifier,
    diagnostics,
    { specifier: options.entrySpecifier },
  );
  const modulesBySpecifier = collectSourceEntries(options, diagnostics);
  const importAliases = normalizeImportAliases(options.importAliases, diagnostics);

  if (!entrySpecifier || !modulesBySpecifier.has(entrySpecifier)) {
    diagnostics.push({
      code: 'ENTRY_MODULE_MISSING',
      message: `entry module is missing: ${options.entrySpecifier}`,
      specifier: entrySpecifier ?? options.entrySpecifier,
    });
  }

  throwIfDiagnostics(diagnostics);
  if (!entrySpecifier) {
    throw new Error('internal error: entry specifier was not normalized');
  }

  const reachable = new Set<string>();
  const scanCache = new Map<string, ScannedModule>();
  const graphDiagnostics: ModulePackBuildDiagnostic[] = [];

  processModuleClosure({
    seed: entrySpecifier,
    markReachable: true,
    modulesBySpecifier,
    importAliases,
    scanCache,
    reachable,
    diagnostics: graphDiagnostics,
    profile,
  });

  if (includeUnreachable) {
    for (const specifier of sortUtf8([...modulesBySpecifier.keys()])) {
      processModuleClosure({
        seed: specifier,
        markReachable: false,
        modulesBySpecifier,
        importAliases,
        scanCache,
        reachable,
        diagnostics: graphDiagnostics,
        profile,
      });
    }
  }

  const compatibilityDiagnostics = graphDiagnostics.filter(
    (diagnostic) => diagnostic.code === 'COMPATIBILITY_ERROR',
  );
  const hardDiagnostics = graphDiagnostics.filter(
    (diagnostic) => diagnostic.code !== 'COMPATIBILITY_ERROR',
  );

  if (hardDiagnostics.length > 0) {
    throw new ModulePackBuildError(sortDiagnostics(hardDiagnostics));
  }
  if (rejectIncompatible && compatibilityDiagnostics.length > 0) {
    throw new ModulePackBuildError(sortDiagnostics(compatibilityDiagnostics));
  }

  const moduleSpecifiers = includeUnreachable
    ? sortUtf8([...modulesBySpecifier.keys()])
    : sortUtf8([...reachable]);
  const modules = moduleSpecifiers.map((specifier) => {
    const module = modulesBySpecifier.get(specifier);
    if (!module) {
      throw new Error(`internal error: missing module ${specifier}`);
    }
    return module;
  });

  const dependencyIntegrity =
    options.dependencyIntegrity ??
    (await sha256HexUtf8(NO_EXTERNAL_DEPENDENCIES_INTEGRITY_INPUT));
  if (!SHA256_HEX_RE.test(dependencyIntegrity)) {
    throw new ModulePackBuildError([
      {
        code: 'COMPATIBILITY_ERROR',
        message:
          'dependencyIntegrity must be a lowercase 64-character SHA-256 hex digest',
      },
    ]);
  }

  const unreachableModulePaths = sortUtf8(
    [...modulesBySpecifier.keys()].filter((specifier) => !reachable.has(specifier)),
  );
  const modulePackWithoutHash: Omit<ModulePackV1, 'graphHash'> = {
    version: 1,
    entrySpecifier,
    entryExport,
    modules,
    builderVersion: options.builderVersion ?? DEFAULT_BUILDER_VERSION,
    dependencyIntegrity,
    diagnosticsMeta: {
      entrySpecifier,
      modulePaths: moduleSpecifiers,
      profile,
      ...(includeUnreachable && unreachableModulePaths.length > 0
        ? { unreachableModulePaths }
        : {}),
      ...(compatibilityDiagnostics.length > 0
        ? { compatibilityDiagnostics: sortDiagnostics(compatibilityDiagnostics) }
        : {}),
    },
  };

  const graphHash = await computeModulePackGraphHash(modulePackWithoutHash);
  return {
    ...modulePackWithoutHash,
    graphHash,
  };
}

export function normalizeModulePackSpecifier(specifier: string): string {
  const normalized = tryNormalizeModulePackSpecifier(specifier);
  if (!normalized.ok) {
    throw new ModulePackBuildError([
      {
        code: 'INVALID_SPECIFIER',
        message: normalized.message,
        specifier,
      },
    ]);
  }
  return normalized.value;
}

export function normalizeModulePackSource(source: string): string {
  return source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function formatModulePackBuildDiagnostics(
  diagnostics: readonly ModulePackBuildDiagnostic[],
): string {
  if (diagnostics.length === 0) {
    return 'Module pack build failed';
  }
  const lines = sortDiagnostics(diagnostics).map((diagnostic) => {
    const location = [
      diagnostic.specifier ? `specifier=${diagnostic.specifier}` : null,
      diagnostic.importer ? `importer=${diagnostic.importer}` : null,
      diagnostic.importSpecifier
        ? `import=${diagnostic.importSpecifier}`
        : null,
    ]
      .filter(Boolean)
      .join(' ');
    return `- [${diagnostic.code}]${location ? ` ${location}` : ''}: ${diagnostic.message}`;
  });
  return `Module pack build failed:\n${lines.join('\n')}`;
}

function collectSourceEntries(
  options: BuildModulePackFromSourcesOptions,
  diagnostics: ModulePackBuildDiagnostic[],
): Map<string, SourceEntryInternal> {
  const modulesBySpecifier = new Map<string, SourceEntryInternal>();
  const entries = sourceEntriesFromOptions(options);

  for (const entry of entries) {
    const specifier = normalizeSpecifierWithDiagnostics(
      entry.specifier,
      diagnostics,
      { specifier: entry.specifier },
    );
    if (!specifier) {
      continue;
    }

    if (modulesBySpecifier.has(specifier)) {
      diagnostics.push({
        code: 'DUPLICATE_SPECIFIER',
        message: `duplicate module specifier after normalization: ${specifier}`,
        specifier,
      });
      continue;
    }

    const externalSourceMap =
      options.sourceMaps?.[entry.specifier] ?? options.sourceMaps?.[specifier];
    modulesBySpecifier.set(specifier, {
      specifier,
      source: normalizeModulePackSource(entry.source),
      ...(entry.sourceMap !== undefined || externalSourceMap !== undefined
        ? {
            sourceMap: normalizeModulePackSource(
              entry.sourceMap ?? externalSourceMap ?? '',
            ),
          }
        : {}),
      ...(entry.originMeta ? { originMeta: entry.originMeta } : {}),
    });
  }

  return modulesBySpecifier;
}

function sourceEntriesFromOptions(
  options: BuildModulePackFromSourcesOptions,
): ModulePackSourceEntry[] {
  const sources = options.sources;
  if (Array.isArray(sources)) {
    return sources.map((entry) => ({ ...entry }));
  }

  const sourceRecord = sources as Readonly<Record<string, string>>;
  return Object.keys(sourceRecord)
    .sort(compareUtf8ByteOrder)
    .map((specifier) => ({
      specifier,
      source: sourceRecord[specifier] ?? '',
      sourceMap: options.sourceMaps?.[specifier],
    }));
}

function normalizeImportAliases(
  aliases: Readonly<Record<string, string>> | undefined,
  diagnostics: ModulePackBuildDiagnostic[],
): Map<string, string> {
  const normalizedAliases = new Map<string, string>();
  if (!aliases) {
    return normalizedAliases;
  }

  for (const rawSpecifier of Object.keys(aliases).sort(compareUtf8ByteOrder)) {
    const target = aliases[rawSpecifier];
    const normalizedTarget = normalizeSpecifierWithDiagnostics(
      target,
      diagnostics,
      { specifier: target, importSpecifier: rawSpecifier },
    );
    if (normalizedTarget) {
      normalizedAliases.set(rawSpecifier, normalizedTarget);
    }
  }
  return normalizedAliases;
}

function normalizeSpecifierWithDiagnostics(
  specifier: string,
  diagnostics: ModulePackBuildDiagnostic[],
  context: Pick<
    ModulePackBuildDiagnostic,
    'specifier' | 'importer' | 'importSpecifier'
  >,
): string | null {
  const normalized = tryNormalizeModulePackSpecifier(specifier);
  if (!normalized.ok) {
    diagnostics.push({
      code: 'INVALID_SPECIFIER',
      message: normalized.message,
      ...context,
    });
    return null;
  }
  return normalized.value;
}

function tryNormalizeModulePackSpecifier(
  specifier: string,
): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof specifier !== 'string' || specifier.length === 0) {
    return { ok: false, message: 'module specifier must be a non-empty string' };
  }
  if (specifier.includes('\\')) {
    return { ok: false, message: 'module specifier must use /, not \\' };
  }
  if (!specifier.startsWith('./')) {
    return { ok: false, message: 'module specifier must start with ./' };
  }

  const segments = specifier.slice(2).split('/');
  const normalizedSegments: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      return {
        ok: false,
        message: 'module specifier must not contain .. path segments',
      };
    }
    normalizedSegments.push(segment);
  }
  if (normalizedSegments.length === 0) {
    return { ok: false, message: 'module specifier must not be empty' };
  }

  return { ok: true, value: `./${normalizedSegments.join('/')}` };
}

function processModuleClosure(options: {
  seed: string;
  markReachable: boolean;
  modulesBySpecifier: ReadonlyMap<string, SourceEntryInternal>;
  importAliases: ReadonlyMap<string, string>;
  scanCache: Map<string, ScannedModule>;
  reachable: Set<string>;
  diagnostics: ModulePackBuildDiagnostic[];
  profile: ExecutionProfile;
}): void {
  const processed = new Set<string>();
  const queue = [options.seed];

  while (queue.length > 0) {
    queue.sort(compareUtf8ByteOrder);
    const specifier = queue.shift();
    if (!specifier || processed.has(specifier)) {
      continue;
    }
    processed.add(specifier);
    if (options.markReachable) {
      options.reachable.add(specifier);
    }

    const module = options.modulesBySpecifier.get(specifier);
    if (!module) {
      continue;
    }

    const scanned = scanCachedModule(module, options.profile, options.scanCache);
    options.diagnostics.push(...scanned.diagnostics);

    for (const edge of scanned.imports) {
      const resolved = resolveImport(edge, options.importAliases);
      if (!resolved.ok) {
        options.diagnostics.push(resolved.diagnostic);
        continue;
      }
      if (!options.modulesBySpecifier.has(resolved.specifier)) {
        options.diagnostics.push({
          code: 'MISSING_IMPORT',
          message: `missing import ${edge.raw} resolved to ${resolved.specifier}`,
          importer: edge.importer,
          importSpecifier: edge.raw,
          specifier: resolved.specifier,
        });
        continue;
      }
      if (options.markReachable && !options.reachable.has(resolved.specifier)) {
        queue.push(resolved.specifier);
      }
      if (!options.markReachable && !processed.has(resolved.specifier)) {
        queue.push(resolved.specifier);
      }
    }
  }
}

function scanCachedModule(
  module: SourceEntryInternal,
  profile: ExecutionProfile,
  cache: Map<string, ScannedModule>,
): ScannedModule {
  const cached = cache.get(module.specifier);
  if (cached) {
    return cached;
  }
  const scanned = scanModule(module, profile);
  cache.set(module.specifier, scanned);
  return scanned;
}

function scanModule(
  module: SourceEntryInternal,
  profile: ExecutionProfile,
): ScannedModule {
  const diagnostics: ModulePackBuildDiagnostic[] = [];
  const imports: ImportEdge[] = [];
  let ast: AstNode;

  try {
    ast = parse(module.source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
    }) as unknown as AstNode;
  } catch (error) {
    return {
      imports,
      diagnostics: [
        {
          code: 'PARSE_ERROR',
          message: `failed to parse module: ${stringifyError(error)}`,
          specifier: module.specifier,
        },
      ],
    };
  }

  walkAst(ast, (node) => {
    collectStaticImports(node, module.specifier, imports);
    collectForbiddenRuntimeUse(node, module.specifier, profile, diagnostics);
  });

  return {
    imports: imports.sort((left, right) => {
      if (left.raw !== right.raw) {
        return compareUtf8ByteOrder(left.raw, right.raw);
      }
      return compareUtf8ByteOrder(left.importer, right.importer);
    }),
    diagnostics: sortDiagnostics(diagnostics),
  };
}

function collectStaticImports(
  node: AstNode,
  importer: string,
  imports: ImportEdge[],
): void {
  if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') {
    const raw = getLiteralSource(node);
    if (raw) {
      imports.push({ raw, importer });
    }
    return;
  }

  if (node.type === 'ExportNamedDeclaration') {
    const raw = getLiteralSource(node);
    if (raw) {
      imports.push({ raw, importer });
    }
  }
}

function collectForbiddenRuntimeUse(
  node: AstNode,
  specifier: string,
  profile: ExecutionProfile,
  diagnostics: ModulePackBuildDiagnostic[],
): void {
  if (node.type === 'ImportExpression') {
    diagnostics.push({
      code: 'DYNAMIC_IMPORT_DISABLED',
      message: 'dynamic import() is disabled in deterministic module packs',
      specifier,
    });
    return;
  }

  if (node.type === 'CallExpression') {
    const callee = asNode(node.callee);
    if (callee?.type === 'Import') {
      diagnostics.push({
        code: 'DYNAMIC_IMPORT_DISABLED',
        message: 'dynamic import() is disabled in deterministic module packs',
        specifier,
      });
      return;
    }

    if (callee?.type === 'Identifier') {
      const name = asString(callee.name);
      if (name === 'require') {
        diagnostics.push({
          code: 'COMMONJS_REQUIRE_DISABLED',
          message: 'CommonJS require() is disabled in deterministic module packs',
          specifier,
        });
        return;
      }
      addIdentifierCompatibilityDiagnostic(name, specifier, profile, diagnostics);
    }

    if (isForbiddenGlobalMember(callee)) {
      const name = forbiddenGlobalMemberName(callee);
      addIdentifierCompatibilityDiagnostic(name, specifier, profile, diagnostics);
    }

    if (isMathRandomCall(callee)) {
      diagnostics.push(compatDiagnostic({
        specifier,
        ruleId: 'math_random_disabled',
        message: 'Math.random() is disabled in deterministic module packs',
      }));
    }

    if (
      isConsoleCall(callee) &&
      !executionProfileHasCapability(profile, 'consoleShim')
    ) {
      diagnostics.push(compatDiagnostic({
        specifier,
        ruleId: 'console_disabled',
        message: 'console APIs are disabled by the selected execution profile',
      }));
    }

    if (isRegExpCall(callee) && !executionProfileHasCapability(profile, 'regexp')) {
      diagnostics.push(compatDiagnostic({
        specifier,
        ruleId: 'regexp_disabled',
        message: 'RegExp is disabled by the selected execution profile',
      }));
    }
    return;
  }

  if (node.type === 'NewExpression') {
    const callee = asNode(node.callee);
    if (callee?.type === 'Identifier') {
      const name = asString(callee.name);
      if (
        name &&
        FORBIDDEN_TYPED_ARRAYS.has(name) &&
        !executionProfileHasCapability(profile, 'typedArrays')
      ) {
        diagnostics.push(compatDiagnostic({
          specifier,
          ruleId: 'typed_array_disabled',
          message: `typed array constructor is disabled by the selected execution profile: ${name}`,
        }));
        return;
      }
      addIdentifierCompatibilityDiagnostic(name, specifier, profile, diagnostics);
      if (name === 'RegExp' && !executionProfileHasCapability(profile, 'regexp')) {
        diagnostics.push(compatDiagnostic({
          specifier,
          ruleId: 'regexp_disabled',
          message: 'RegExp is disabled by the selected execution profile',
        }));
      }
    }
    return;
  }

  if (
    isRegExpLiteral(node) &&
    !executionProfileHasCapability(profile, 'regexp')
  ) {
    diagnostics.push(compatDiagnostic({
      specifier,
      ruleId: 'regexp_literal_disabled',
      message: 'RegExp literals are disabled by the selected execution profile',
    }));
  }
}

function resolveImport(
  edge: ImportEdge,
  importAliases: ReadonlyMap<string, string>,
):
  | { ok: true; specifier: string }
  | { ok: false; diagnostic: ModulePackBuildDiagnostic } {
  const raw = edge.raw;
  if (isNodeBuiltinSpecifier(raw)) {
    return {
      ok: false,
      diagnostic: {
        code: 'NODE_BUILTIN_IMPORT_DISABLED',
        message: `node builtin import is disabled: ${raw}`,
        importer: edge.importer,
        importSpecifier: raw,
      },
    };
  }

  if (raw.startsWith('./') || raw.startsWith('../')) {
    const resolved = resolveRelativeSpecifier(edge.importer, raw);
    if (!resolved.ok) {
      return {
        ok: false,
        diagnostic: {
          code: 'INVALID_SPECIFIER',
          message: resolved.message,
          importer: edge.importer,
          importSpecifier: raw,
        },
      };
    }
    return { ok: true, specifier: resolved.value };
  }

  const aliasTarget = importAliases.get(raw);
  if (aliasTarget) {
    return { ok: true, specifier: aliasTarget };
  }

  return {
    ok: false,
    diagnostic: {
      code: 'BARE_IMPORT_DISABLED',
      message: `bare/package import is disabled without an explicit alias: ${raw}`,
      importer: edge.importer,
      importSpecifier: raw,
    },
  };
}

function resolveRelativeSpecifier(
  importer: string,
  rawImport: string,
): { ok: true; value: string } | { ok: false; message: string } {
  if (rawImport.length === 0) {
    return { ok: false, message: 'import specifier must not be empty' };
  }
  if (rawImport.includes('\\')) {
    return { ok: false, message: 'import specifier must use /, not \\' };
  }

  const baseSegments = importer.slice(2).split('/');
  baseSegments.pop();
  const stack = baseSegments.filter((segment) => segment.length > 0);

  for (const segment of rawImport.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (stack.length === 0) {
        return {
          ok: false,
          message: 'import specifier resolves outside the module-pack root',
        };
      }
      stack.pop();
      continue;
    }
    stack.push(segment);
  }

  if (stack.length === 0) {
    return { ok: false, message: 'import specifier must not be empty' };
  }

  return { ok: true, value: `./${stack.join('/')}` };
}

function getLiteralSource(node: AstNode): string | null {
  const source = asNode(node.source);
  const value = source ? asString(source.value) : null;
  return value;
}

function walkAst(node: AstNode, visit: (node: AstNode) => void): void {
  visit(node);
  for (const key of Object.keys(node).sort(compareUtf8ByteOrder)) {
    const value = node[key];
    if (!value) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          walkAst(item, visit);
        }
      }
      continue;
    }
    if (isNode(value)) {
      walkAst(value, visit);
    }
  }
}

function addIdentifierCompatibilityDiagnostic(
  name: string | null,
  specifier: string,
  profile: ExecutionProfile,
  diagnostics: ModulePackBuildDiagnostic[],
): void {
  if (!name) {
    return;
  }

  const globalRule = FORBIDDEN_GLOBAL_RULES.get(name);
  if (globalRule) {
    diagnostics.push(compatDiagnostic({
      specifier,
      ruleId: globalRule,
      message: `forbidden API used: ${name}`,
    }));
    return;
  }

  if (TIMER_RULES.has(name)) {
    diagnostics.push(compatDiagnostic({
      specifier,
      ruleId: 'timers_disabled',
      message: `timer API is disabled in deterministic module packs: ${name}`,
    }));
    return;
  }

  if (
    (name === 'ArrayBuffer' ||
      name === 'SharedArrayBuffer' ||
      name === 'DataView' ||
      FORBIDDEN_TYPED_ARRAYS.has(name)) &&
    !executionProfileHasCapability(profile, 'typedArrays')
  ) {
    diagnostics.push(compatDiagnostic({
      specifier,
      ruleId: 'typed_array_disabled',
      message: `binary API is disabled by the selected execution profile: ${name}`,
    }));
  }
}

function isMathRandomCall(node: AstNode | null): boolean {
  if (!node || node.type !== 'MemberExpression') {
    return false;
  }
  const object = asNode(node.object);
  const property = asNode(node.property);
  return (
    object?.type === 'Identifier' &&
    asString(object.name) === 'Math' &&
    property?.type === 'Identifier' &&
    asString(property.name) === 'random'
  );
}

function isConsoleCall(node: AstNode | null): boolean {
  if (!node || node.type !== 'MemberExpression') {
    return false;
  }
  const object = asNode(node.object);
  return object?.type === 'Identifier' && asString(object.name) === 'console';
}

function isRegExpCall(node: AstNode | null): boolean {
  return !!node && node.type === 'Identifier' && asString(node.name) === 'RegExp';
}

function isForbiddenGlobalMember(node: AstNode | null): boolean {
  return forbiddenGlobalMemberName(node) !== null;
}

function forbiddenGlobalMemberName(node: AstNode | null): string | null {
  if (!node || node.type !== 'MemberExpression') {
    return null;
  }
  const object = asNode(node.object);
  if (object?.type !== 'Identifier') {
    return null;
  }
  const name = asString(object.name);
  return name && FORBIDDEN_GLOBAL_RULES.has(name) ? name : null;
}

function isRegExpLiteral(node: AstNode): boolean {
  return node.type === 'Literal' && Boolean(node.regex);
}

function compatDiagnostic(options: {
  specifier: string;
  ruleId: string;
  message: string;
}): ModulePackBuildDiagnostic {
  return {
    code: 'COMPATIBILITY_ERROR',
    message: `[${options.ruleId}] ${options.message}`,
    specifier: options.specifier,
  };
}

function isNodeBuiltinSpecifier(specifier: string): boolean {
  const withoutNodePrefix = specifier.startsWith('node:')
    ? specifier.slice('node:'.length)
    : specifier;
  const builtinName = withoutNodePrefix.split('/')[0] ?? withoutNodePrefix;
  return NODE_BUILTINS.has(builtinName);
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

function sortUtf8(values: string[]): string[] {
  return values.sort(compareUtf8ByteOrder);
}

function sortDiagnostics(
  diagnostics: readonly ModulePackBuildDiagnostic[],
): ModulePackBuildDiagnostic[] {
  const fields: Array<keyof ModulePackBuildDiagnostic> = [
    'specifier',
    'importer',
    'importSpecifier',
    'code',
    'message',
  ];
  const sorted = [...diagnostics].sort((left, right) => {
    for (const field of fields) {
      const leftValue = left[field] ?? '';
      const rightValue = right[field] ?? '';
      if (leftValue !== rightValue) {
        return compareUtf8ByteOrder(String(leftValue), String(rightValue));
      }
    }
    return 0;
  });
  const unique: ModulePackBuildDiagnostic[] = [];
  const seen = new Set<string>();
  for (const diagnostic of sorted) {
    const key = fields
      .map((field) => String(diagnostic[field] ?? ''))
      .join('\u0000');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(diagnostic);
  }
  return unique;
}

function throwIfDiagnostics(diagnostics: readonly ModulePackBuildDiagnostic[]): void {
  if (diagnostics.length > 0) {
    throw new ModulePackBuildError(sortDiagnostics(diagnostics));
  }
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
