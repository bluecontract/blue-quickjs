import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ModulePackV1 } from '@blue-quickjs/deterministic-builder';
import { normalizeSourceText } from './canonical-json.js';

export interface TempSourceTree {
  readonly dir: string;
  cleanup(): Promise<void>;
}

export async function createTempSourceTree(
  prefix: string,
): Promise<TempSourceTree> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  return {
    dir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function writeSourceModule(
  root: string,
  specifier: string,
  source: string,
): Promise<string> {
  const relative = moduleSpecifierToRelativePath(specifier);
  const filePath = path.join(root, relative);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, normalizeSourceText(source), 'utf8');
  return filePath;
}

export async function writeModuleMap(
  root: string,
  modules: Readonly<Record<string, string>>,
): Promise<void> {
  for (const [specifier, source] of Object.entries(modules)) {
    await writeSourceModule(root, specifier, source);
  }
}

export async function materializeModulePackAsPackage(options: {
  readonly root: string;
  readonly packageName: string;
  readonly packageVersion: string;
  readonly modulePack: ModulePackV1;
  readonly exportSubpath?: string;
}): Promise<void> {
  const packageRoot = path.join(
    options.root,
    'node_modules',
    options.packageName,
  );
  for (const module of options.modulePack.modules) {
    await writeSourceModule(packageRoot, module.specifier, module.source);
  }
  const entryPath = moduleSpecifierToRelativePath(
    options.modulePack.entrySpecifier,
  );
  const exports: Record<string, string> = {
    '.': `./${entryPath}`,
  };
  if (options.exportSubpath) {
    exports[options.exportSubpath] = `./${entryPath}`;
  }
  await writeFile(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: options.packageName,
        version: options.packageVersion,
        type: 'module',
        exports,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

export function moduleSpecifierToRelativePath(specifier: string): string {
  const normalized = specifier.startsWith('./')
    ? specifier.slice(2)
    : specifier;
  if (
    path.isAbsolute(normalized) ||
    normalized.includes('\\') ||
    normalized.split('/').includes('..')
  ) {
    throw new Error(
      `invalid module specifier for materialization: ${specifier}`,
    );
  }
  return normalized;
}

export function parsePackageImportSpecifier(specifier: string): {
  readonly packageName: string;
  readonly exportSubpath?: string;
} {
  const parts = specifier.split('/');
  if (specifier.startsWith('@')) {
    const packageName = `${parts[0]}/${parts[1]}`;
    const rest = parts.slice(2);
    return {
      packageName,
      ...(rest.length > 0 ? { exportSubpath: `./${rest.join('/')}` } : {}),
    };
  }
  const packageName = parts[0] ?? specifier;
  const rest = parts.slice(1);
  return {
    packageName,
    ...(rest.length > 0 ? { exportSubpath: `./${rest.join('/')}` } : {}),
  };
}
