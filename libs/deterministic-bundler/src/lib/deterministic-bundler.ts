import { build } from 'esbuild';
import { parse } from 'acorn';
import { builtinModules } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export type DeterministicExecutionProfile =
  | 'baseline-v1'
  | 'compat-regexp-v1';

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
    target: 'es2020',
    globalName,
    legalComments: 'none',
    sourcemap: false,
    metafile: true,
    charset: 'utf8',
  });

  const jsOutput = result.outputFiles?.find((file) => file.path.endsWith('.js'));
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

  if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') {
    const source = asString((node as { source?: { value?: unknown } }).source?.value);
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
):
  | { ok: true; ast: AstNode }
  | { ok: false; message: string } {
  try {
    const ast = parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
    }) as AstNode;
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
