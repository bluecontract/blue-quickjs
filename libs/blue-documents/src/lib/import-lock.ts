import {
  BLUE_JS_IMPORT_LOCK_TYPE,
  MYOS_DOCUMENT_LINK_TYPE,
  type JavaScriptImportLockDocument,
  type JavaScriptLibraryArtifactDocument,
} from './types.js';
import { canonicalJson } from './canonical-json.js';
import { validateJavaScriptLibraryArtifact } from './validators.js';

export interface CreateImportLockOptions {
  readonly specifier: string;
  readonly libraryDocumentId: string;
  readonly artifact: unknown;
}

export function createImportLock(
  options: CreateImportLockOptions,
): JavaScriptImportLockDocument {
  const artifact = validateJavaScriptLibraryArtifact(options.artifact);
  const specifier = options.specifier.trim();
  const documentId = options.libraryDocumentId.trim();
  if (!specifier) {
    throw new Error('createImportLock requires specifier');
  }
  if (!documentId) {
    throw new Error('createImportLock requires libraryDocumentId');
  }
  return lockFromArtifact(specifier, documentId, artifact);
}

export function lockFromArtifact(
  specifier: string,
  documentId: string,
  artifact: JavaScriptLibraryArtifactDocument,
): JavaScriptImportLockDocument {
  const sourceIntegritySha256 = artifact.package.sourceIntegritySha256;
  if (!sourceIntegritySha256) {
    throw new Error(
      'library artifact package.sourceIntegritySha256 is required',
    );
  }
  return {
    type: BLUE_JS_IMPORT_LOCK_TYPE,
    specifier,
    library: {
      type: MYOS_DOCUMENT_LINK_TYPE,
      documentId,
    },
    requiredPackage: {
      registry: artifact.package.registry,
      name: artifact.package.name,
      version: artifact.package.version,
      sourceIntegritySha256,
    },
    ...(artifact.origin ? { requiredOrigin: artifact.origin } : {}),
    requiredBuild: {
      builderVersion: artifact.build.builderVersion,
      dependencyIntegritySha256: artifact.build.dependencyIntegritySha256,
      modulePackGraphHash: artifact.build.modulePackGraphHash,
    },
  };
}

export function importLocksEqual(
  left: JavaScriptImportLockDocument,
  right: JavaScriptImportLockDocument,
): boolean {
  return canonicalJson(left) === canonicalJson(right);
}
