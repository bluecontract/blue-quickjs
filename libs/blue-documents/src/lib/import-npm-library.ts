import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildDeterministicModulePack } from '@blue-quickjs/deterministic-builder';
import {
  BLUE_JS_LIBRARY_ARTIFACT_TYPE,
  type JavaScriptLibraryArtifactDocument,
} from './types.js';
import { canonicalSha256 } from './canonical-json.js';
import { computeNpmSourceIntegrity } from './source-integrity.js';
import { validateNpmLibrarySource } from './validators.js';

export interface ImportNpmLibraryOptions {
  readonly packageDir?: string;
  readonly keepTempDir?: boolean;
  readonly rejectIncompatible?: boolean;
}

interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly module?: string;
  readonly main?: string;
  readonly exports?: unknown;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
}

export async function importNpmLibrary(
  value: unknown,
  options: ImportNpmLibraryOptions = {},
): Promise<JavaScriptLibraryArtifactDocument> {
  const source = validateNpmLibrarySource(value);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'blue-npm-library-'));
  let packageDir = options.packageDir ?? source.npm.packageDir;
  let tarballIntegrity = source.npm.integrity;

  try {
    if (!packageDir) {
      const packed = await packNpmPackage({
        tempRoot,
        registryUrl: source.npm.registryUrl,
        packageName: source.npm.name,
        packageVersion: source.npm.version,
      });
      packageDir = packed.packageDir;
      tarballIntegrity = tarballIntegrity ?? packed.integrity;
    } else {
      const copiedPackageDir = path.join(tempRoot, 'package');
      await cp(path.resolve(packageDir), copiedPackageDir, {
        recursive: true,
        force: true,
      });
      packageDir = copiedPackageDir;
    }

    const packageJson = await readPackageJson(packageDir);
    if (packageJson.name !== source.npm.name) {
      throw new Error(
        `npm package name mismatch: ${packageJson.name ?? '<missing>'} != ${source.npm.name}`,
      );
    }
    if (packageJson.version !== source.npm.version) {
      throw new Error(
        `npm package version mismatch: ${packageJson.version ?? '<missing>'} != ${source.npm.version}`,
      );
    }

    const entryPath = resolvePackageEntry(packageJson, source.entry);
    const dependencyLockSha256 = canonicalSha256({
      name: packageJson.name,
      version: packageJson.version,
      dependencies: packageJson.dependencies ?? {},
      peerDependencies: packageJson.peerDependencies ?? {},
      optionalDependencies: packageJson.optionalDependencies ?? {},
    });

    const built = await buildDeterministicModulePack({
      absWorkingDir: packageDir,
      entryPath,
      profile: source.executionProfile,
      rejectIncompatible: options.rejectIncompatible ?? true,
      dependencyIntegrity: dependencyLockSha256,
      emitProgramArtifact: false,
    });

    return {
      type: BLUE_JS_LIBRARY_ARTIFACT_TYPE,
      package: {
        registry: 'npm',
        name: source.npm.name,
        version: source.npm.version,
        sourceIntegritySha256: computeNpmSourceIntegrity(source),
      },
      origin: {
        type: 'npm',
        registryUrl: source.npm.registryUrl,
        packageName: source.npm.name,
        packageVersion: source.npm.version,
        ...(tarballIntegrity ? { tarballIntegrity } : {}),
        lockfileSha256: dependencyLockSha256,
      },
      processing: {
        runtime: 'BlueQuickjs',
        sourceKind: 'module-pack',
        modulePackVersion: 1,
        programArtifactVersion: 2,
        executionProfile: source.executionProfile,
      },
      build: {
        builderVersion: built.modulePack.builderVersion,
        dependencyIntegritySha256: built.modulePack.dependencyIntegrity,
        modulePackGraphHash: built.modulePack.graphHash,
      },
      artifact: {
        modulePack: built.modulePack,
      },
    };
  } finally {
    if (!options.keepTempDir) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
}

async function packNpmPackage(options: {
  readonly tempRoot: string;
  readonly registryUrl: string;
  readonly packageName: string;
  readonly packageVersion: string;
}): Promise<{ readonly packageDir: string; readonly integrity?: string }> {
  await mkdir(options.tempRoot, { recursive: true });
  const result = spawnSync(
    'npm',
    [
      'pack',
      `${options.packageName}@${options.packageVersion}`,
      '--json',
      '--pack-destination',
      options.tempRoot,
      '--registry',
      options.registryUrl,
    ],
    {
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) {
    throw new Error(`npm pack failed: ${result.stderr || result.stdout}`);
  }
  const packOutput = JSON.parse(result.stdout) as unknown;
  const first = Array.isArray(packOutput)
    ? (packOutput[0] as Record<string, unknown>)
    : {};
  const filename =
    typeof first.filename === 'string' ? first.filename : undefined;
  if (!filename) {
    throw new Error('npm pack did not report a tarball filename');
  }
  const tarballPath = path.join(options.tempRoot, filename);
  const extractDir = path.join(options.tempRoot, 'extract');
  await mkdir(extractDir, { recursive: true });
  const tar = spawnSync('tar', ['-xzf', tarballPath, '-C', extractDir], {
    encoding: 'utf8',
  });
  if (tar.status !== 0) {
    throw new Error(`tar extraction failed: ${tar.stderr || tar.stdout}`);
  }
  return {
    packageDir: path.join(extractDir, 'package'),
    ...(typeof first.integrity === 'string'
      ? { integrity: first.integrity }
      : {}),
  };
}

async function readPackageJson(packageDir: string): Promise<PackageJson> {
  return JSON.parse(
    await readFile(path.join(packageDir, 'package.json'), 'utf8'),
  ) as PackageJson;
}

function resolvePackageEntry(
  packageJson: PackageJson,
  requestedEntry: string | undefined,
): string {
  if (requestedEntry && requestedEntry !== 'auto') {
    return requestedEntry;
  }
  const exportEntry = resolveExportsEntry(packageJson.exports);
  return exportEntry ?? packageJson.module ?? packageJson.main ?? './index.js';
}

function resolveExportsEntry(exportsValue: unknown): string | undefined {
  if (typeof exportsValue === 'string') {
    return exportsValue;
  }
  if (
    !exportsValue ||
    typeof exportsValue !== 'object' ||
    Array.isArray(exportsValue)
  ) {
    return undefined;
  }
  const record = exportsValue as Record<string, unknown>;
  const dot = record['.'];
  if (typeof dot === 'string') {
    return dot;
  }
  if (dot && typeof dot === 'object' && !Array.isArray(dot)) {
    const dotRecord = dot as Record<string, unknown>;
    for (const key of ['import', 'module', 'default', 'require']) {
      const value = dotRecord[key];
      if (typeof value === 'string') {
        return value;
      }
    }
  }
  for (const key of ['import', 'module', 'default', 'require']) {
    const value = record[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}
