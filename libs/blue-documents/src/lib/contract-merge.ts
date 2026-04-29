import {
  BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
  type JavaScriptEnvironmentContractDocument,
  type JavaScriptImportLockDocument,
} from './types.js';
import { importLocksEqual } from './import-lock.js';
import { validateJavaScriptEnvironmentContract } from './validators.js';

export interface MergedJavaScriptEnvironmentContract {
  readonly type: typeof BLUE_JS_ENVIRONMENT_CONTRACT_TYPE;
  readonly executionProfile: JavaScriptEnvironmentContractDocument['executionProfile'];
  readonly abi: JavaScriptEnvironmentContractDocument['abi'];
  readonly imports: Record<string, JavaScriptImportLockDocument>;
}

export function mergeJavaScriptEnvironmentContracts(
  values: readonly unknown[],
): MergedJavaScriptEnvironmentContract {
  if (values.length === 0) {
    throw new Error('at least one JavaScript environment contract is required');
  }

  const contracts = values.map((value) =>
    validateJavaScriptEnvironmentContract(value),
  );
  const first = contracts[0];
  if (!first) {
    throw new Error('at least one JavaScript environment contract is required');
  }

  const imports: Record<string, JavaScriptImportLockDocument> = {};
  for (const contract of contracts) {
    if (contract.executionProfile !== first.executionProfile) {
      throw new Error(
        `contract executionProfile mismatch: ${contract.executionProfile} != ${first.executionProfile}`,
      );
    }
    if (
      contract.abi.id !== first.abi.id ||
      contract.abi.version !== first.abi.version
    ) {
      throw new Error(
        `contract ABI mismatch: ${contract.abi.id}@${contract.abi.version} != ${first.abi.id}@${first.abi.version}`,
      );
    }
    for (const [specifier, lock] of Object.entries(contract.imports)) {
      const existing = imports[specifier];
      if (!existing) {
        imports[specifier] = lock;
        continue;
      }
      if (!importLocksEqual(existing, lock)) {
        throw new Error(`conflicting import lock for ${specifier}`);
      }
    }
  }

  return {
    type: BLUE_JS_ENVIRONMENT_CONTRACT_TYPE,
    executionProfile: first.executionProfile,
    abi: first.abi,
    imports,
  };
}
