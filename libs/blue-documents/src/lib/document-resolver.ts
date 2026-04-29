import type {
  JavaScriptImportLockDocument,
  JavaScriptLibraryArtifactDocument,
} from './types.js';
import { canonicalJson } from './canonical-json.js';
import { validateJavaScriptLibraryArtifact } from './validators.js';

export interface DocumentResolver {
  resolveDocument(documentId: string): Promise<unknown> | unknown;
}

export class MapDocumentResolver implements DocumentResolver {
  constructor(private readonly documents: Readonly<Record<string, unknown>>) {}

  resolveDocument(documentId: string): unknown {
    return this.documents[documentId];
  }
}

export interface VerifiedLibraryArtifact {
  readonly specifier: string;
  readonly documentId: string;
  readonly artifact: JavaScriptLibraryArtifactDocument;
}

export async function resolveAndVerifyImportLocks(
  imports: Readonly<Record<string, JavaScriptImportLockDocument>>,
  resolver: DocumentResolver,
): Promise<VerifiedLibraryArtifact[]> {
  const verified: VerifiedLibraryArtifact[] = [];
  for (const [specifier, lock] of Object.entries(imports).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const raw = await resolver.resolveDocument(lock.library.documentId);
    if (raw === undefined || raw === null) {
      throw new Error(
        `linked library artifact not found: ${lock.library.documentId}`,
      );
    }
    const artifact = validateJavaScriptLibraryArtifact(raw);
    verifyImportLockAgainstArtifact(lock, artifact);
    verified.push({
      specifier,
      documentId: lock.library.documentId,
      artifact,
    });
  }
  return verified;
}

export function verifyImportLockAgainstArtifact(
  lock: JavaScriptImportLockDocument,
  artifact: JavaScriptLibraryArtifactDocument,
): void {
  if (artifact.package.registry !== lock.requiredPackage.registry) {
    throw new Error(`import lock ${lock.specifier} package registry mismatch`);
  }
  if (artifact.package.name !== lock.requiredPackage.name) {
    throw new Error(`import lock ${lock.specifier} package name mismatch`);
  }
  if (artifact.package.version !== lock.requiredPackage.version) {
    throw new Error(`import lock ${lock.specifier} package version mismatch`);
  }
  if (
    artifact.package.sourceIntegritySha256 !==
    lock.requiredPackage.sourceIntegritySha256
  ) {
    throw new Error(`import lock ${lock.specifier} source integrity mismatch`);
  }
  if (artifact.build.builderVersion !== lock.requiredBuild.builderVersion) {
    throw new Error(`import lock ${lock.specifier} builder version mismatch`);
  }
  if (
    artifact.build.dependencyIntegritySha256 !==
    lock.requiredBuild.dependencyIntegritySha256
  ) {
    throw new Error(
      `import lock ${lock.specifier} dependency integrity mismatch`,
    );
  }
  if (
    artifact.build.modulePackGraphHash !==
    lock.requiredBuild.modulePackGraphHash
  ) {
    throw new Error(
      `import lock ${lock.specifier} module-pack graph hash mismatch`,
    );
  }
  if (lock.requiredOrigin || artifact.origin) {
    if (!lock.requiredOrigin || !artifact.origin) {
      throw new Error(`import lock ${lock.specifier} npm origin mismatch`);
    }
    if (canonicalJson(lock.requiredOrigin) !== canonicalJson(artifact.origin)) {
      throw new Error(`import lock ${lock.specifier} npm origin mismatch`);
    }
  }
}
