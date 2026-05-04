import {
  DV,
  DV_LIMIT_DEFAULTS,
  DvError,
  DvLimits,
  validateDv,
} from '@blue-quickjs/dv';
import {
  isKnownExecutionProfile,
  type PublicExecutionProfile,
} from '@blue-quickjs/execution-profiles';

const UINT32_MAX = 0xffffffff;
const SHA256_HEX_LENGTH = 64;
const HEX_RE = /^[0-9a-f]+$/;

export type ExecutionProfile = PublicExecutionProfile;

export interface ModulePackV1Module {
  specifier: string;
  source: string;
  sourceMap?: string;
  originMeta?: {
    packageName?: string;
    packageVersion?: string;
    integrity?: string;
    originalPath?: string;
  };
}

export interface ModulePackV1 {
  version: 1;
  entrySpecifier: string;
  entryExport?: string;
  modules: ModulePackV1Module[];
  graphHash: string;
  builderVersion: string;
  dependencyIntegrity: string;
  diagnosticsMeta?: Record<string, unknown>;
}

export interface ProgramArtifactV2ScriptSource {
  code: string;
}

export interface ProgramArtifactV2ModulePackSource {
  modulePack: ModulePackV1;
}

export interface ProgramArtifactV2 {
  version: 2;
  abiId: string;
  abiVersion: number;
  abiManifestHash: string;
  engineBuildHash?: string;
  gasVersion?: number;
  executionProfile: ExecutionProfile;
  sourceKind: 'script' | 'module-pack';
  source: ProgramArtifactV2ScriptSource | ProgramArtifactV2ModulePackSource;
}

export interface ProgramArtifact {
  code: string;
  abiId: string;
  abiVersion: number;
  abiManifestHash: string;
  engineBuildHash?: string;
  gasVersion?: number;
  executionProfile?: ExecutionProfile;
}

export interface ProgramArtifactLimits {
  maxCodeUnits: number;
  maxAbiIdLength: number;
}

export const PROGRAM_LIMIT_DEFAULTS: Readonly<ProgramArtifactLimits> = {
  maxCodeUnits: 1_048_576, // 1 MiB in UTF-16 code units
  maxAbiIdLength: 128,
};

export interface ProgramValidationOptions {
  limits?: Partial<ProgramArtifactLimits>;
}

export interface InputEnvelope {
  event: DV;
  eventCanonical: DV;
  steps: DV;
  currentContract?: DV;
  currentContractCanonical?: DV;
}

export interface InputValidationOptions {
  dvLimits?: Partial<DvLimits>;
}

export type RuntimeValidationErrorCode =
  | 'INVALID_TYPE'
  | 'INVALID_VALUE'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'EMPTY_STRING'
  | 'EXCEEDS_LIMIT'
  | 'INVALID_HEX'
  | 'OUT_OF_RANGE'
  | 'DV_INVALID';

export class RuntimeValidationError extends Error {
  constructor(
    public readonly code: RuntimeValidationErrorCode,
    message: string,
    public readonly path?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'RuntimeValidationError';
  }
}

export function validateProgramArtifact(
  value: unknown,
  options?: ProgramValidationOptions,
): ProgramArtifact {
  const limits = normalizeProgramLimits(options?.limits);
  const program = expectPlainObject(value, 'program');
  enforceExactKeys(
    program,
    [
      'code',
      'abiId',
      'abiVersion',
      'abiManifestHash',
      'engineBuildHash',
      'gasVersion',
      'executionProfile',
    ],
    'program',
    ['engineBuildHash', 'gasVersion', 'executionProfile'],
  );

  const code = expectString(program.code, 'program.code', {
    maxLength: limits.maxCodeUnits,
    allowEmpty: true,
  });
  const abiId = expectString(program.abiId, 'program.abiId', {
    maxLength: limits.maxAbiIdLength,
  });
  const abiVersion = expectUint(
    program.abiVersion,
    1,
    UINT32_MAX,
    'program.abiVersion',
  );
  const abiManifestHash = expectHexString(
    program.abiManifestHash,
    'program.abiManifestHash',
    { exactLength: SHA256_HEX_LENGTH },
  );
  const engineBuildHash =
    program.engineBuildHash !== undefined
      ? expectHexString(program.engineBuildHash, 'program.engineBuildHash', {
          exactLength: SHA256_HEX_LENGTH,
        })
      : undefined;
  const gasVersion =
    program.gasVersion !== undefined
      ? expectUint(program.gasVersion, 0, UINT32_MAX, 'program.gasVersion')
      : undefined;
  const executionProfile =
    program.executionProfile !== undefined
      ? expectExecutionProfile(
          program.executionProfile,
          'program.executionProfile',
        )
      : undefined;

  return {
    code,
    abiId,
    abiVersion,
    abiManifestHash,
    engineBuildHash,
    gasVersion,
    executionProfile,
  };
}

export function validateModulePack(value: unknown): ModulePackV1 {
  return validateModulePackV1(value, 'modulePack');
}

export function validateProgramArtifactV2(
  value: unknown,
  options?: ProgramValidationOptions,
): ProgramArtifactV2 {
  const limits = normalizeProgramLimits(options?.limits);
  const artifact = expectPlainObject(value, 'program');
  enforceExactKeys(
    artifact,
    [
      'version',
      'abiId',
      'abiVersion',
      'abiManifestHash',
      'engineBuildHash',
      'gasVersion',
      'executionProfile',
      'sourceKind',
      'source',
    ],
    'program',
    ['engineBuildHash', 'gasVersion'],
  );

  const version = expectUint(artifact.version, 2, 2, 'program.version') as 2;
  const abiId = expectString(artifact.abiId, 'program.abiId', {
    maxLength: limits.maxAbiIdLength,
  });
  const abiVersion = expectUint(
    artifact.abiVersion,
    1,
    UINT32_MAX,
    'program.abiVersion',
  );
  const abiManifestHash = expectHexString(
    artifact.abiManifestHash,
    'program.abiManifestHash',
    { exactLength: SHA256_HEX_LENGTH },
  );
  const engineBuildHash =
    artifact.engineBuildHash !== undefined
      ? expectHexString(artifact.engineBuildHash, 'program.engineBuildHash', {
          exactLength: SHA256_HEX_LENGTH,
        })
      : undefined;
  const gasVersion =
    artifact.gasVersion !== undefined
      ? expectUint(artifact.gasVersion, 0, UINT32_MAX, 'program.gasVersion')
      : undefined;
  const executionProfile = expectExecutionProfile(
    artifact.executionProfile,
    'program.executionProfile',
  );
  const sourceKind = expectSourceKind(
    artifact.sourceKind,
    'program.sourceKind',
  );
  const source = validateProgramV2Source(
    artifact.source,
    sourceKind,
    limits,
    'program.source',
  );

  return {
    version,
    abiId,
    abiVersion,
    abiManifestHash,
    ...(engineBuildHash ? { engineBuildHash } : {}),
    ...(gasVersion !== undefined ? { gasVersion } : {}),
    executionProfile,
    sourceKind,
    source,
  };
}

export function validateInputEnvelope(
  value: unknown,
  options?: InputValidationOptions,
): InputEnvelope {
  const dvLimits = normalizeDvLimits(options?.dvLimits);
  const input = expectPlainObject(value, 'input');
  enforceExactKeys(
    input,
    [
      'event',
      'eventCanonical',
      'steps',
      'currentContract',
      'currentContractCanonical',
    ],
    'input',
    ['currentContract', 'currentContractCanonical'],
  );

  const event = validateDvField(input.event, dvLimits, 'input.event');
  const eventCanonical = validateDvField(
    input.eventCanonical,
    dvLimits,
    'input.eventCanonical',
  );
  const steps = validateDvField(input.steps, dvLimits, 'input.steps');
  const currentContract =
    input.currentContract === undefined
      ? null
      : validateDvField(
          input.currentContract,
          dvLimits,
          'input.currentContract',
        );
  const currentContractCanonical =
    input.currentContractCanonical === undefined
      ? currentContract
      : validateDvField(
          input.currentContractCanonical,
          dvLimits,
          'input.currentContractCanonical',
        );

  return {
    event,
    eventCanonical,
    steps,
    currentContract,
    currentContractCanonical,
  };
}

function validateDvField(value: unknown, limits: DvLimits, path: string): DV {
  try {
    validateDv(value, { limits });
    return value as DV;
  } catch (err) {
    if (err instanceof DvError) {
      throw runtimeError(
        'DV_INVALID',
        `${path} is not valid DV: ${err.message}`,
        path,
        err,
      );
    }
    throw err;
  }
}

function expectPlainObject(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw runtimeError('INVALID_TYPE', `${path} must be a plain object`, path);
  }
  return value as Record<string, unknown>;
}

function enforceExactKeys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
  optional: string[] = [],
): void {
  for (const requiredKey of allowed) {
    if (optional.includes(requiredKey)) {
      continue;
    }
    if (!(requiredKey in value)) {
      throw runtimeError(
        'MISSING_FIELD',
        `${path} is missing required field "${requiredKey}"`,
        `${path}.${requiredKey}`,
      );
    }
  }

  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw runtimeError(
        'UNKNOWN_FIELD',
        `${path} contains unknown field "${key}"`,
        `${path}.${key}`,
      );
    }
  }
}

function expectString(
  value: unknown,
  path: string,
  options?: { maxLength?: number; allowEmpty?: boolean },
): string {
  if (typeof value !== 'string') {
    throw runtimeError('INVALID_TYPE', `${path} must be a string`, path);
  }
  if (!options?.allowEmpty && value.length === 0) {
    throw runtimeError('EMPTY_STRING', `${path} must not be empty`, path);
  }
  if (options?.maxLength !== undefined && value.length > options.maxLength) {
    throw runtimeError(
      'EXCEEDS_LIMIT',
      `${path} exceeds maxLength (${value.length} > ${options.maxLength})`,
      path,
    );
  }
  return value;
}

function expectHexString(
  value: unknown,
  path: string,
  options: { exactLength?: number; maxLength?: number },
): string {
  const hex = expectString(value, path);
  if (options.exactLength !== undefined && hex.length !== options.exactLength) {
    throw runtimeError(
      'INVALID_HEX',
      `${path} must be ${options.exactLength} hex characters`,
      path,
    );
  }
  if (options.maxLength !== undefined && hex.length > options.maxLength) {
    throw runtimeError(
      'EXCEEDS_LIMIT',
      `${path} exceeds maxLength (${hex.length} > ${options.maxLength})`,
      path,
    );
  }
  if (hex.length % 2 !== 0) {
    throw runtimeError(
      'INVALID_HEX',
      `${path} must have an even number of hex characters`,
      path,
    );
  }
  if (!HEX_RE.test(hex)) {
    throw runtimeError('INVALID_HEX', `${path} must be lowercase hex`, path);
  }
  return hex;
}

function expectUint(
  value: unknown,
  min: number,
  max: number,
  path: string,
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw runtimeError('INVALID_TYPE', `${path} must be an integer`, path);
  }
  if (Object.is(value, -0)) {
    throw runtimeError('OUT_OF_RANGE', `${path} must not be -0`, path);
  }
  if (value < min || value > max) {
    throw runtimeError(
      'OUT_OF_RANGE',
      `${path} must be between ${min} and ${max}`,
      path,
    );
  }
  return value;
}

function expectExecutionProfile(
  value: unknown,
  path: string,
): ExecutionProfile {
  if (!isKnownExecutionProfile(value)) {
    throw runtimeError(
      'INVALID_VALUE',
      `${path} must be one of baseline-v1, compat-general-v1, compat-binary-v1`,
      path,
    );
  }
  return value;
}

function expectSourceKind(
  value: unknown,
  path: string,
): 'script' | 'module-pack' {
  if (value !== 'script' && value !== 'module-pack') {
    throw runtimeError(
      'INVALID_VALUE',
      `${path} must be "script" or "module-pack"`,
      path,
    );
  }
  return value;
}

function validateProgramV2Source(
  value: unknown,
  sourceKind: 'script' | 'module-pack',
  limits: ProgramArtifactLimits,
  path: string,
): ProgramArtifactV2ScriptSource | ProgramArtifactV2ModulePackSource {
  const source = expectPlainObject(value, path);
  if (sourceKind === 'script') {
    enforceExactKeys(source, ['code'], path);
    return {
      code: expectString(source.code, `${path}.code`, {
        maxLength: limits.maxCodeUnits,
        allowEmpty: true,
      }),
    };
  }

  enforceExactKeys(source, ['modulePack'], path);
  return {
    modulePack: validateModulePackV1(source.modulePack, `${path}.modulePack`),
  };
}

function validateModulePackV1(value: unknown, path: string): ModulePackV1 {
  const pack = expectPlainObject(value, path);
  enforceExactKeys(
    pack,
    [
      'version',
      'entrySpecifier',
      'entryExport',
      'modules',
      'graphHash',
      'builderVersion',
      'dependencyIntegrity',
      'diagnosticsMeta',
    ],
    path,
    ['entryExport', 'diagnosticsMeta'],
  );

  const version = expectUint(pack.version, 1, 1, `${path}.version`) as 1;
  const entrySpecifier = expectString(
    pack.entrySpecifier,
    `${path}.entrySpecifier`,
  );
  const entryExport =
    pack.entryExport !== undefined
      ? expectString(pack.entryExport, `${path}.entryExport`)
      : undefined;
  const modules = expectArray(pack.modules, `${path}.modules`).map(
    (moduleValue, index) =>
      validateModulePackModule(moduleValue, `${path}.modules[${index}]`),
  );
  const graphHash = expectHexString(pack.graphHash, `${path}.graphHash`, {
    exactLength: SHA256_HEX_LENGTH,
  });
  const builderVersion = expectString(
    pack.builderVersion,
    `${path}.builderVersion`,
  );
  const dependencyIntegrity = expectHexString(
    pack.dependencyIntegrity,
    `${path}.dependencyIntegrity`,
    {
      exactLength: SHA256_HEX_LENGTH,
    },
  );

  return {
    version,
    entrySpecifier,
    ...(entryExport ? { entryExport } : {}),
    modules,
    graphHash,
    builderVersion,
    dependencyIntegrity,
    ...(pack.diagnosticsMeta !== undefined
      ? {
          diagnosticsMeta: expectRecord(
            pack.diagnosticsMeta,
            `${path}.diagnosticsMeta`,
          ),
        }
      : {}),
  };
}

function validateModulePackModule(
  value: unknown,
  path: string,
): ModulePackV1Module {
  const module = expectPlainObject(value, path);
  enforceExactKeys(
    module,
    ['specifier', 'source', 'sourceMap', 'originMeta'],
    path,
    ['sourceMap', 'originMeta'],
  );

  const originMeta =
    module.originMeta !== undefined
      ? validateModulePackOriginMeta(module.originMeta, `${path}.originMeta`)
      : undefined;

  return {
    specifier: expectString(module.specifier, `${path}.specifier`),
    source: expectString(module.source, `${path}.source`, { allowEmpty: true }),
    ...(module.sourceMap !== undefined
      ? { sourceMap: expectString(module.sourceMap, `${path}.sourceMap`) }
      : {}),
    ...(originMeta ? { originMeta } : {}),
  };
}

function validateModulePackOriginMeta(
  value: unknown,
  path: string,
): NonNullable<ModulePackV1Module['originMeta']> {
  const originMeta = expectPlainObject(value, path);
  enforceExactKeys(
    originMeta,
    ['packageName', 'packageVersion', 'integrity', 'originalPath'],
    path,
    ['packageName', 'packageVersion', 'integrity', 'originalPath'],
  );

  return {
    ...(originMeta.packageName !== undefined
      ? {
          packageName: expectString(
            originMeta.packageName,
            `${path}.packageName`,
          ),
        }
      : {}),
    ...(originMeta.packageVersion !== undefined
      ? {
          packageVersion: expectString(
            originMeta.packageVersion,
            `${path}.packageVersion`,
          ),
        }
      : {}),
    ...(originMeta.integrity !== undefined
      ? { integrity: expectString(originMeta.integrity, `${path}.integrity`) }
      : {}),
    ...(originMeta.originalPath !== undefined
      ? {
          originalPath: expectString(
            originMeta.originalPath,
            `${path}.originalPath`,
          ),
        }
      : {}),
  };
}

function normalizeProgramLimits(
  overrides?: Partial<ProgramArtifactLimits>,
): ProgramArtifactLimits {
  return {
    maxCodeUnits:
      overrides?.maxCodeUnits ?? PROGRAM_LIMIT_DEFAULTS.maxCodeUnits,
    maxAbiIdLength:
      overrides?.maxAbiIdLength ?? PROGRAM_LIMIT_DEFAULTS.maxAbiIdLength,
  };
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw runtimeError('INVALID_TYPE', `${path} must be an array`, path);
  }
  return value;
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw runtimeError('INVALID_TYPE', `${path} must be an object`, path);
  }
  return value as Record<string, unknown>;
}

function normalizeDvLimits(overrides?: Partial<DvLimits>): DvLimits {
  return {
    maxDepth: overrides?.maxDepth ?? DV_LIMIT_DEFAULTS.maxDepth,
    maxEncodedBytes:
      overrides?.maxEncodedBytes ?? DV_LIMIT_DEFAULTS.maxEncodedBytes,
    maxStringBytes:
      overrides?.maxStringBytes ?? DV_LIMIT_DEFAULTS.maxStringBytes,
    maxByteStringBytes:
      overrides?.maxByteStringBytes ?? DV_LIMIT_DEFAULTS.maxByteStringBytes,
    maxArrayLength:
      overrides?.maxArrayLength ?? DV_LIMIT_DEFAULTS.maxArrayLength,
    maxMapLength: overrides?.maxMapLength ?? DV_LIMIT_DEFAULTS.maxMapLength,
  };
}

function runtimeError(
  code: RuntimeValidationErrorCode,
  message: string,
  path?: string,
  cause?: unknown,
): RuntimeValidationError {
  return new RuntimeValidationError(code, message, path, { cause });
}
