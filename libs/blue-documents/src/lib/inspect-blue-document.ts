import { BLUE_JS_LIBRARY_ARTIFACT_TYPE, BLUE_JS_STEP_TYPE } from './types.js';
import {
  validateJavaScriptLibraryArtifact,
  validateJavaScriptStep,
} from './validators.js';

export function inspectBlueDocument(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('document must be an object');
  }
  const type = (value as { type?: unknown }).type;
  if (type === BLUE_JS_LIBRARY_ARTIFACT_TYPE) {
    const artifact = validateJavaScriptLibraryArtifact(value);
    return {
      documentType: artifact.type,
      package: artifact.package,
      origin: artifact.origin ?? null,
      runtime: artifact.processing.runtime,
      sourceKind: artifact.processing.sourceKind,
      executionProfile: artifact.processing.executionProfile,
      builderVersion: artifact.build.builderVersion,
      dependencyIntegrity: artifact.build.dependencyIntegritySha256,
      graphHash: artifact.build.modulePackGraphHash,
      moduleCount: artifact.artifact.modulePack.modules.length,
      entrySpecifier: artifact.artifact.modulePack.entrySpecifier,
      entryExport: artifact.artifact.modulePack.entryExport,
    };
  }
  if (type === BLUE_JS_STEP_TYPE) {
    const step = validateJavaScriptStep(value);
    return {
      documentType: step.type,
      useContracts: step.useContracts,
      hasLocalModules: Boolean(
        step.modules && Object.keys(step.modules).length > 0,
      ),
      entryExport: step.entryExport ?? 'default',
      executionProfile: step.executionProfile ?? null,
      abi: step.abi ?? null,
    };
  }
  return {
    documentType: type ?? null,
    supported: false,
  };
}
