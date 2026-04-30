import { existsSync } from 'node:fs';
import { Module, createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const blueQuickjsRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const require = createRequire(import.meta.url);

export async function loadBlueQuickjsPackage(packageName, sourcePath) {
  try {
    return await import(packageName);
  } catch (error) {
    if (!isModuleResolutionError(error)) {
      throw error;
    }
  }

  const fallbackNodeModules = addFallbackNodePath();
  const { createJiti } = require(
    require.resolve('jiti', {
      paths: fallbackNodeModules ? [fallbackNodeModules] : undefined,
    }),
  );
  const jiti = createJiti(resolve(blueQuickjsRoot, 'examples.mjs'));
  return await jiti.import(resolve(blueQuickjsRoot, sourcePath));
}

function addFallbackNodePath() {
  const fallbackNodeModules = resolve(
    blueQuickjsRoot,
    '../blue-js/node_modules',
  );
  if (!existsSync(fallbackNodeModules)) {
    return undefined;
  }
  process.env.NODE_PATH = process.env.NODE_PATH
    ? `${fallbackNodeModules}:${process.env.NODE_PATH}`
    : fallbackNodeModules;
  Module._initPaths();
  return fallbackNodeModules;
}

function isModuleResolutionError(error) {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND')
  );
}
