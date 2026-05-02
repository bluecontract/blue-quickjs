#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const BLUE_PACKAGE_PREFIX = '@blue-quickjs/';
const SOURCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts']);
const TEST_FILE_PATTERN = /\.(spec|test)\.[cm]?[tj]sx?$/;
const TEST_DIRECTORY_NAMES = new Set(['test', 'tests']);
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"](@blue-quickjs\/[^'"]+)['"]|import\(\s*['"](@blue-quickjs\/[^'"]+)['"]\s*\)/g;

if (isMain()) {
  const result = await checkTsProjectReferences(process.cwd());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.checks.referencesComplete) {
    process.exitCode = 1;
  }
}

export async function checkTsProjectReferences(repoRoot) {
  const workspacePackages = await discoverWorkspacePackages(repoRoot);
  const packageByName = new Map(
    workspacePackages.map((entry) => [entry.packageName, entry]),
  );
  const projects = await discoverTsProjects(repoRoot, workspacePackages);
  const missingReferences = [];

  for (const project of projects) {
    const imports = await collectWorkspaceImports(project);
    const references = new Set(
      project.references.map((referencePath) =>
        normalizePath(path.resolve(project.root, referencePath)),
      ),
    );

    for (const [packageName, importedBy] of imports) {
      const dependency = packageByName.get(packageName);
      if (!dependency || dependency.root === project.root || !dependency.tsconfigLibPath) {
        continue;
      }

      const expectedReference = normalizePath(dependency.tsconfigLibPath);
      if (references.has(expectedReference)) {
        continue;
      }

      missingReferences.push({
        project: project.name,
        tsconfig: path.relative(repoRoot, project.tsconfigPath),
        import: packageName,
        expectedReference: path.relative(repoRoot, dependency.tsconfigLibPath),
        importedBy: importedBy.map((filePath) => path.relative(repoRoot, filePath)).sort(),
      });
    }
  }

  return {
    checks: {
      referencesComplete: missingReferences.length === 0,
    },
    projectCount: projects.length,
    missingReferenceCount: missingReferences.length,
    missingReferences,
  };
}

async function discoverWorkspacePackages(repoRoot) {
  const packages = [];
  for (const scope of ['apps', 'libs', 'tools']) {
    const scopeDir = path.join(repoRoot, scope);
    for (const entry of await readDirIfExists(scopeDir)) {
      if (!entry.isDirectory()) {
        continue;
      }
      const root = path.join(scopeDir, entry.name);
      const packageJsonPath = path.join(root, 'package.json');
      const packageJson = await readJsonIfExists(packageJsonPath);
      if (!packageJson || typeof packageJson.name !== 'string') {
        continue;
      }
      const tsconfigLibPath = await existingPath(
        path.join(root, 'tsconfig.lib.json'),
      );
      packages.push({
        packageName: packageJson.name,
        projectName: packageJson.nx?.name ?? entry.name,
        root,
        tsconfigLibPath,
      });
    }
  }
  return packages;
}

async function discoverTsProjects(repoRoot, workspacePackages) {
  const projects = [];
  for (const workspacePackage of workspacePackages) {
    for (const tsconfigName of ['tsconfig.lib.json', 'tsconfig.app.json']) {
      const tsconfigPath = path.join(workspacePackage.root, tsconfigName);
      const tsconfig = await readJsonIfExists(tsconfigPath);
      if (!tsconfig) {
        continue;
      }
      projects.push({
        name: workspacePackage.projectName,
        root: workspacePackage.root,
        tsconfigPath,
        references: (tsconfig.references ?? [])
          .map((reference) => reference?.path)
          .filter((referencePath) => typeof referencePath === 'string'),
        sourceDir: path.join(workspacePackage.root, 'src'),
        repoRoot,
      });
    }
  }
  return projects;
}

async function collectWorkspaceImports(project) {
  const imports = new Map();
  for (const filePath of await walkSourceFiles(project.sourceDir)) {
    const text = await readFile(filePath, 'utf8');
    for (const packageName of extractWorkspaceImports(text)) {
      const importedBy = imports.get(packageName) ?? [];
      importedBy.push(filePath);
      imports.set(packageName, importedBy);
    }
  }
  return imports;
}

function extractWorkspaceImports(text) {
  const imports = new Set();
  for (const match of text.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2];
    if (!specifier?.startsWith(BLUE_PACKAGE_PREFIX)) {
      continue;
    }
    const [, scope, name] = specifier.match(/^(@blue-quickjs)\/([^/]+)/) ?? [];
    if (scope && name) {
      imports.add(`${scope}/${name}`);
    }
  }
  return imports;
}

async function walkSourceFiles(rootDir) {
  const files = [];
  for (const entry of await readDirIfExists(rootDir)) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (TEST_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }
      files.push(...(await walkSourceFiles(fullPath)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }
    if (TEST_FILE_PATTERN.test(entry.name)) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

async function readDirIfExists(dirPath) {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function existingPath(filePath) {
  try {
    await stat(filePath);
    return filePath;
  } catch {
    return null;
  }
}

function normalizePath(filePath) {
  return path.normalize(filePath);
}

function isMain() {
  if (!process.argv[1]) {
    return false;
  }
  return import.meta.url === pathToFileURL(process.argv[1]).href;
}
