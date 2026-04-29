import {
  type JavaScriptLibraryArtifactDocument,
  type JavaScriptLibrarySourceDocument,
  type NpmLibrarySourceDocument,
} from './types.js';
import { canonicalSha256, normalizeSourceText } from './canonical-json.js';

export function computeLibrarySourceIntegrity(
  source: JavaScriptLibrarySourceDocument,
): string {
  return canonicalSha256({
    type: source.type,
    package: source.package,
    executionProfile: source.executionProfile,
    entry: source.entry,
    modules: Object.fromEntries(
      Object.entries(source.modules)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([specifier, moduleSource]) => [
          specifier,
          normalizeSourceText(moduleSource),
        ]),
    ),
  });
}

export function computeNpmSourceIntegrity(
  source: NpmLibrarySourceDocument,
): string {
  return canonicalSha256({
    type: source.type,
    npm: {
      registryUrl: source.npm.registryUrl,
      name: source.npm.name,
      version: source.npm.version,
      integrity: source.npm.integrity,
    },
    executionProfile: source.executionProfile,
    entry: source.entry ?? 'auto',
  });
}

export function computeArtifactIdentityHash(
  artifact: JavaScriptLibraryArtifactDocument,
): string {
  return canonicalSha256({
    type: artifact.type,
    package: artifact.package,
    origin: artifact.origin,
    processing: artifact.processing,
    build: artifact.build,
    modulePackGraphHash: artifact.artifact.modulePack.graphHash,
  });
}
