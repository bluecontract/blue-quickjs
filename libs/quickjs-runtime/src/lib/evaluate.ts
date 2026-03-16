import type { AbiManifest } from '@blue-quickjs/abi-manifest';
import {
  type DV,
  DV_LIMIT_DEFAULTS,
  type DvLimits,
  decodeDv,
} from '@blue-quickjs/dv';
import { initializeDeterministicVm } from './deterministic-init.js';
import type {
  HostDispatcherHandlers,
  HostDispatcherOptions,
} from './host-dispatcher.js';
import {
  type InputEnvelope,
  type InputValidationOptions,
  type ModulePackV1,
  type ProgramArtifact,
  type ProgramArtifactV2,
  validateInputEnvelope,
  validateProgramArtifact,
  validateProgramArtifactV2,
} from './quickjs-runtime.js';
import {
  type RuntimeArtifactSelection,
  type RuntimeInstance,
  createRuntime,
} from './runtime.js';
import {
  createInvalidOutputError,
  mapVmError,
  type EvaluateInvalidOutputDetail,
  type EvaluateVmErrorDetail,
} from './evaluate-errors.js';
import { parseHexToBytes } from './hex-utils.js';
import { remapModulePackErrorPayload } from './source-map-remap.js';

export interface EvaluateOptions
  extends RuntimeArtifactSelection, HostDispatcherOptions {
  program: ProgramArtifact | ProgramArtifactV2;
  input: InputEnvelope;
  gasLimit: bigint | number;
  manifest: AbiManifest;
  handlers: HostDispatcherHandlers;
  inputValidation?: InputValidationOptions;
  /**
   * DV limits applied to the returned value.
   */
  outputDvLimits?: Partial<DvLimits>;
  /**
   * Enable host-call tape recording (capacity defaults to 128; max 1024).
   */
  tape?: { capacity?: number };
  /**
   * Enable gas trace recording for the evaluation.
   */
  gasTrace?: boolean;
  /**
   * Enable gas charge event tape recording (capacity defaults to 256; max 8192).
   */
  gasChargeTape?: { capacity?: number };
  /**
   * Enforce release-mode artifact pin requirements.
   */
  releaseMode?: boolean;
}

export type EvaluateSuccess = {
  ok: true;
  value: DV;
  gasUsed: bigint;
  gasRemaining: bigint;
  raw: string;
  tape?: HostTapeRecord[];
  gasChargeTape?: GasChargeRecord[];
  gasTrace?: GasTrace;
};

type EvaluateFailureBase = {
  ok: false;
  type: 'vm-error' | 'invalid-output';
  message: string;
  gasUsed: bigint;
  gasRemaining: bigint;
  raw: string;
  tape?: HostTapeRecord[];
  gasChargeTape?: GasChargeRecord[];
  gasTrace?: GasTrace;
};

export type EvaluateVmError = EvaluateFailureBase & {
  type: 'vm-error';
  error: EvaluateVmErrorDetail;
};

export type EvaluateInvalidOutputError = EvaluateFailureBase & {
  type: 'invalid-output';
  error: EvaluateInvalidOutputDetail;
};

export type EvaluateError = EvaluateVmError | EvaluateInvalidOutputError;

export type EvaluateResult = EvaluateSuccess | EvaluateError;

const HOST_TAPE_MAX_CAPACITY = 1024;
const GAS_CHARGE_TAPE_MAX_CAPACITY = 8192;

export async function evaluate(
  options: EvaluateOptions,
): Promise<EvaluateResult> {
  const program = normalizeProgramForExecution(options.program);
  if (program.mode === 'module-pack') {
    await assertModulePackHash(program.modulePack);
  }
  const input = validateInputEnvelope(options.input, options.inputValidation);
  if (options.releaseMode) {
    assertReleaseArtifactPins(program.legacyArtifact);
  }

  const runtime = await createRuntime({
    manifest: options.manifest,
    handlers: options.handlers,
    variant: options.variant,
    buildType: options.buildType,
    metadata: options.metadata,
    wasmBinary: options.wasmBinary,
    dvLimits: options.dvLimits,
    expectedAbiId: program.legacyArtifact.abiId,
    expectedAbiVersion: program.legacyArtifact.abiVersion,
  });

  assertEngineBuildHash(program.legacyArtifact, runtime);
  assertGasVersion(program.legacyArtifact, runtime);

  const vm = initializeDeterministicVm(
    runtime,
    program.legacyArtifact,
    input,
    options.gasLimit,
  );

  if (options.tape) {
    const capacity = options.tape.capacity ?? 128;
    if (!Number.isInteger(capacity) || capacity < 0) {
      throw new Error('tape capacity must be a non-negative integer');
    }
    if (capacity > HOST_TAPE_MAX_CAPACITY) {
      throw new Error(
        `tape capacity exceeds max (${HOST_TAPE_MAX_CAPACITY}); received ${capacity}`,
      );
    }
    vm.enableTape(capacity);
  }

  if (options.gasChargeTape) {
    const capacity = options.gasChargeTape.capacity ?? 256;
    if (!Number.isInteger(capacity) || capacity < 0) {
      throw new Error(
        'gas charge tape capacity must be a non-negative integer',
      );
    }
    if (capacity > GAS_CHARGE_TAPE_MAX_CAPACITY) {
      throw new Error(
        `gas charge tape capacity exceeds max (${GAS_CHARGE_TAPE_MAX_CAPACITY}); received ${capacity}`,
      );
    }
    vm.enableGasChargeTape(capacity);
  }

  if (options.gasTrace) {
    vm.enableGasTrace(true);
  }

  try {
    const raw =
      program.mode === 'script'
        ? vm.eval(program.legacyArtifact.code)
        : vm.evalModulePack(
            serializeModulePackModules(program.modulePack),
            program.modulePack.entrySpecifier,
            program.entryExport,
          );
    const parsed = parseEvalOutput(raw);
    const trace = options.gasTrace
      ? parseGasTrace(vm.readGasTrace())
      : undefined;
    const tape = options.tape ? parseTape(vm.readTape()) : undefined;
    const gasChargeTape = options.gasChargeTape
      ? parseGasChargeTape(vm.readGasChargeTape())
      : undefined;

    if (parsed.kind === 'error') {
      const payload =
        program.mode === 'module-pack'
          ? remapModulePackErrorPayload(parsed.payload, program.modulePack)
              .payload
          : parsed.payload;
      const error = mapVmError(payload, runtime.manifest);
      return {
        ok: false,
        type: 'vm-error',
        message: error.message,
        error,
        gasUsed: parsed.gasUsed,
        gasRemaining: parsed.gasRemaining,
        raw,
        tape,
        gasChargeTape,
        gasTrace: trace,
      };
    }

    const decoded = decodeResultPayload(parsed.payload, options.outputDvLimits);
    if (decoded.kind === 'error') {
      const error = createInvalidOutputError(decoded.message, decoded.cause);
      return {
        ok: false,
        type: 'invalid-output',
        message: error.message,
        error,
        gasUsed: parsed.gasUsed,
        gasRemaining: parsed.gasRemaining,
        raw,
        tape,
        gasChargeTape,
        gasTrace: trace,
      };
    }

    return {
      ok: true,
      value: decoded.value,
      gasUsed: parsed.gasUsed,
      gasRemaining: parsed.gasRemaining,
      raw,
      tape,
      gasChargeTape,
      gasTrace: trace,
    };
  } finally {
    vm.dispose();
  }
}

type ParsedEvalOutput = {
  kind: 'result' | 'error';
  payload: string;
  gasRemaining: bigint;
  gasUsed: bigint;
};

function parseEvalOutput(raw: string): ParsedEvalOutput {
  const normalized = raw.trim();

  let kind: 'RESULT' | 'ERROR';
  if (normalized.startsWith('RESULT')) {
    kind = 'RESULT';
  } else if (normalized.startsWith('ERROR')) {
    kind = 'ERROR';
  } else {
    throw new Error(`Unexpected VM output prefix: ${normalized}`);
  }

  const withoutKind = normalized.slice(kind.length).trimStart();
  const trailerMarker = ' GAS remaining=';
  const usedMarker = ' used=';

  const trailerIdx = withoutKind.lastIndexOf(trailerMarker);
  if (trailerIdx < 0) {
    throw new Error(`Missing gas trailer in VM output: ${normalized}`);
  }

  const payload = withoutKind.slice(0, trailerIdx).trimEnd();
  const trailer = withoutKind.slice(trailerIdx + trailerMarker.length);
  const usedIdx = trailer.lastIndexOf(usedMarker);
  if (usedIdx < 0) {
    throw new Error(`Missing used= trailer in VM output: ${normalized}`);
  }

  const remainingStr = trailer.slice(0, usedIdx).trim();
  const usedStr = trailer.slice(usedIdx + usedMarker.length).trim();

  return {
    kind: kind === 'RESULT' ? 'result' : 'error',
    payload,
    gasRemaining: parseUint64(remainingStr, 'gasRemaining'),
    gasUsed: parseUint64(usedStr, 'gasUsed'),
  };
}

type DecodedResultPayload =
  | { kind: 'ok'; value: DV }
  | { kind: 'error'; message: string; cause?: unknown };

function decodeResultPayload(
  payload: string,
  limits?: Partial<DvLimits>,
): DecodedResultPayload {
  const dvLimits = normalizeDvLimits(limits);
  let bytes: Uint8Array;
  try {
    bytes = parseHexToBytes(payload, dvLimits.maxEncodedBytes);
  } catch (err) {
    return {
      kind: 'error',
      message: `VM returned non-hex DV payload: ${err instanceof Error ? err.message : String(err)}`,
      cause: err,
    };
  }

  try {
    const value = decodeDv(bytes, { limits: dvLimits });
    return { kind: 'ok', value };
  } catch (err) {
    return {
      kind: 'error',
      message: `VM returned non-DV value: ${err instanceof Error ? err.message : String(err)}`,
      cause: err,
    };
  }
}

export interface HostTapeRecord {
  fnId: number;
  reqLen: number;
  respLen: number;
  units: number;
  gasPre: bigint;
  gasPost: bigint;
  isError: boolean;
  chargeFailed: boolean;
  reqHash: string;
  respHash: string;
}

export interface GasChargeRecord {
  siteId: number;
  kind: number;
  flags: number;
  amount: bigint;
  logicalUnits: bigint;
  gasBefore: bigint;
  gasAfter: bigint;
}

function parseTape(raw: string): HostTapeRecord[] {
  const parsed = parseJson(raw, 'tape');
  if (!Array.isArray(parsed)) {
    throw new Error('tape payload is not an array');
  }

  return parsed.map((record, idx) => {
    if (record === null || typeof record !== 'object') {
      throw new Error(`tape record ${idx} is not an object`);
    }

    const fnId = expectUint32(record.fnId, `tape[${idx}].fnId`);
    const reqLen = expectUint32(record.reqLen, `tape[${idx}].reqLen`);
    const respLen = expectUint32(record.respLen, `tape[${idx}].respLen`);
    const units = expectUint32(record.units, `tape[${idx}].units`);
    const gasPre = expectBigIntString(record.gasPre, `tape[${idx}].gasPre`);
    const gasPost = expectBigIntString(record.gasPost, `tape[${idx}].gasPost`);
    const isError = Boolean(record.isError);
    const chargeFailed = Boolean(record.chargeFailed);
    const reqHash = expectHex(record.reqHash, `tape[${idx}].reqHash`, 64);
    const respHash = expectHex(record.respHash, `tape[${idx}].respHash`, 64);

    return {
      fnId,
      reqLen,
      respLen,
      units,
      gasPre,
      gasPost,
      isError,
      chargeFailed,
      reqHash,
      respHash,
    };
  });
}

function parseGasChargeTape(raw: string): GasChargeRecord[] {
  const parsed = parseJson(raw, 'gasChargeTape');
  if (!Array.isArray(parsed)) {
    throw new Error('gasChargeTape payload is not an array');
  }

  return parsed.map((record, idx) => {
    if (record === null || typeof record !== 'object') {
      throw new Error(`gasChargeTape record ${idx} is not an object`);
    }

    const siteId = expectUint32(record.siteId, `gasChargeTape[${idx}].siteId`);
    const kind = expectUint32(record.kind, `gasChargeTape[${idx}].kind`);
    const flags = expectUint32(record.flags, `gasChargeTape[${idx}].flags`);
    const amount = expectBigIntString(
      record.amount,
      `gasChargeTape[${idx}].amount`,
    );
    const logicalUnits = expectBigIntString(
      record.logicalUnits,
      `gasChargeTape[${idx}].logicalUnits`,
    );
    const gasBefore = expectBigIntString(
      record.gasBefore,
      `gasChargeTape[${idx}].gasBefore`,
    );
    const gasAfter = expectBigIntString(
      record.gasAfter,
      `gasChargeTape[${idx}].gasAfter`,
    );

    return {
      siteId,
      kind,
      flags,
      amount,
      logicalUnits,
      gasBefore,
      gasAfter,
    };
  });
}

export interface GasTrace {
  opcodeCount: bigint;
  opcodeGas: bigint;
  arrayCbBaseCount: bigint;
  arrayCbBaseGas: bigint;
  arrayCbPerElCount: bigint;
  arrayCbPerElGas: bigint;
  allocationCount: bigint;
  allocationBytes: bigint;
  allocationGas: bigint;
  jsonParseCount: bigint;
  jsonParseGas: bigint;
  jsonParseInputBytes: bigint;
  jsonParseValues: bigint;
  jsonParseObjectEntries: bigint;
  jsonParseArrayElements: bigint;
  jsonStringifyCount: bigint;
  jsonStringifyGas: bigint;
  jsonStringifyOutputBytes: bigint;
  jsonStringifyValues: bigint;
  jsonStringifyObjectEntries: bigint;
  jsonStringifyArrayElements: bigint;
  jsonStringifySortComparisons: bigint;
  hostCallPreCount: bigint;
  hostCallPreGas: bigint;
  hostCallPostCount: bigint;
  hostCallPostGas: bigint;
}

function parseGasTrace(raw: string): GasTrace {
  const obj = expectRecord(parseJson(raw, 'gasTrace'), 'gasTrace');

  return {
    opcodeCount: expectBigIntString(obj.opcodeCount, 'gasTrace.opcodeCount'),
    opcodeGas: expectBigIntString(obj.opcodeGas, 'gasTrace.opcodeGas'),
    arrayCbBaseCount: expectBigIntString(
      obj.arrayCbBaseCount,
      'gasTrace.arrayCbBaseCount',
    ),
    arrayCbBaseGas: expectBigIntString(
      obj.arrayCbBaseGas,
      'gasTrace.arrayCbBaseGas',
    ),
    arrayCbPerElCount: expectBigIntString(
      obj.arrayCbPerElCount,
      'gasTrace.arrayCbPerElCount',
    ),
    arrayCbPerElGas: expectBigIntString(
      obj.arrayCbPerElGas,
      'gasTrace.arrayCbPerElGas',
    ),
    allocationCount: expectBigIntString(
      obj.allocationCount,
      'gasTrace.allocationCount',
    ),
    allocationBytes: expectBigIntString(
      obj.allocationBytes,
      'gasTrace.allocationBytes',
    ),
    allocationGas: expectBigIntString(
      obj.allocationGas,
      'gasTrace.allocationGas',
    ),
    jsonParseCount: expectBigIntString(
      obj.jsonParseCount,
      'gasTrace.jsonParseCount',
    ),
    jsonParseGas: expectBigIntString(obj.jsonParseGas, 'gasTrace.jsonParseGas'),
    jsonParseInputBytes: expectBigIntString(
      obj.jsonParseInputBytes,
      'gasTrace.jsonParseInputBytes',
    ),
    jsonParseValues: expectBigIntString(
      obj.jsonParseValues,
      'gasTrace.jsonParseValues',
    ),
    jsonParseObjectEntries: expectBigIntString(
      obj.jsonParseObjectEntries,
      'gasTrace.jsonParseObjectEntries',
    ),
    jsonParseArrayElements: expectBigIntString(
      obj.jsonParseArrayElements,
      'gasTrace.jsonParseArrayElements',
    ),
    jsonStringifyCount: expectBigIntString(
      obj.jsonStringifyCount,
      'gasTrace.jsonStringifyCount',
    ),
    jsonStringifyGas: expectBigIntString(
      obj.jsonStringifyGas,
      'gasTrace.jsonStringifyGas',
    ),
    jsonStringifyOutputBytes: expectBigIntString(
      obj.jsonStringifyOutputBytes,
      'gasTrace.jsonStringifyOutputBytes',
    ),
    jsonStringifyValues: expectBigIntString(
      obj.jsonStringifyValues,
      'gasTrace.jsonStringifyValues',
    ),
    jsonStringifyObjectEntries: expectBigIntString(
      obj.jsonStringifyObjectEntries,
      'gasTrace.jsonStringifyObjectEntries',
    ),
    jsonStringifyArrayElements: expectBigIntString(
      obj.jsonStringifyArrayElements,
      'gasTrace.jsonStringifyArrayElements',
    ),
    jsonStringifySortComparisons: expectBigIntString(
      obj.jsonStringifySortComparisons,
      'gasTrace.jsonStringifySortComparisons',
    ),
    hostCallPreCount: expectBigIntString(
      obj.hostCallPreCount,
      'gasTrace.hostCallPreCount',
    ),
    hostCallPreGas: expectBigIntString(
      obj.hostCallPreGas,
      'gasTrace.hostCallPreGas',
    ),
    hostCallPostCount: expectBigIntString(
      obj.hostCallPostCount,
      'gasTrace.hostCallPostCount',
    ),
    hostCallPostGas: expectBigIntString(
      obj.hostCallPostGas,
      'gasTrace.hostCallPostGas',
    ),
  };
}

function parseJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${label} payload is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function expectUint32(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative integer`);
  }
  if (value > 0xffffffff) {
    throw new Error(`${path} exceeds uint32`);
  }
  return value;
}

function expectBigIntString(value: unknown, path: string): bigint {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new Error(`${path} must be non-negative`);
    }
    return value;
  }
  if (typeof value !== 'string') {
    throw new Error(`${path} must be a string`);
  }
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) {
      throw new Error(`${path} must be non-negative`);
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `${path} is not a valid bigint string: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function expectHex(value: unknown, path: string, length: number): string {
  if (typeof value !== 'string') {
    throw new Error(`${path} must be a hex string`);
  }
  if (value.length !== length) {
    throw new Error(`${path} must be ${length} hex characters`);
  }
  if (!/^[0-9a-f]+$/.test(value)) {
    throw new Error(`${path} must be lowercase hex`);
  }
  return value;
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} payload is not an object`);
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

function parseUint64(text: string, label: string): bigint {
  try {
    const value = BigInt(text);
    if (value < 0n) {
      throw new Error(`${label} must be non-negative`);
    }
    return value;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : `Invalid ${label} value`;
    throw new Error(`${message}: ${text}`);
  }
}

function assertEngineBuildHash(
  program: { engineBuildHash?: string },
  runtime: RuntimeInstance,
): void {
  if (!program.engineBuildHash) {
    return;
  }

  const runtimeHash =
    runtime.artifact.variantMetadata.engineBuildHash ??
    runtime.metadata.engineBuildHash ??
    null;

  if (!runtimeHash) {
    throw new Error(
      'Engine build hash is unavailable; cannot verify program.engineBuildHash',
    );
  }

  if (runtimeHash !== program.engineBuildHash) {
    throw new Error(
      `engineBuildHash mismatch: program=${program.engineBuildHash} runtime=${runtimeHash}`,
    );
  }
}

function assertGasVersion(
  program: { gasVersion?: number },
  runtime: RuntimeInstance,
): void {
  if (program.gasVersion === undefined) {
    return;
  }

  const runtimeGasVersion = runtime.metadata.gasVersion;
  if (runtimeGasVersion === null || runtimeGasVersion === undefined) {
    throw new Error(
      'Runtime gasVersion is unavailable; cannot verify program.gasVersion',
    );
  }

  if (runtimeGasVersion !== program.gasVersion) {
    throw new Error(
      `gasVersion mismatch: program=${program.gasVersion} runtime=${runtimeGasVersion}`,
    );
  }
}

function assertReleaseArtifactPins(program: {
  engineBuildHash?: string;
  gasVersion?: number;
  executionProfile?: string;
}): void {
  if (!program.engineBuildHash) {
    throw new Error(
      'release-mode requires program.engineBuildHash to be provided',
    );
  }
  if (program.gasVersion === undefined) {
    throw new Error('release-mode requires program.gasVersion to be provided');
  }
  if (!program.executionProfile) {
    throw new Error(
      'release-mode requires program.executionProfile to be provided',
    );
  }
}

type NormalizedProgramForExecution =
  | {
      mode: 'script';
      legacyArtifact: ProgramArtifact;
    }
  | {
      mode: 'module-pack';
      legacyArtifact: ProgramArtifact;
      modulePack: ModulePackV1;
      entryExport: string;
    };

function normalizeProgramForExecution(
  program: unknown,
): NormalizedProgramForExecution {
  if (isProgramArtifactV2(program)) {
    const validated = validateProgramArtifactV2(program);
    if (validated.sourceKind === 'script') {
      if (!('code' in validated.source)) {
        throw new Error(
          'INVALID_PROGRAM: script source is missing code payload',
        );
      }

      return {
        mode: 'script',
        legacyArtifact: {
          code: validated.source.code,
          abiId: validated.abiId,
          abiVersion: validated.abiVersion,
          abiManifestHash: validated.abiManifestHash,
          ...(validated.engineBuildHash
            ? { engineBuildHash: validated.engineBuildHash }
            : {}),
          ...(validated.gasVersion !== undefined
            ? { gasVersion: validated.gasVersion }
            : {}),
          executionProfile: validated.executionProfile,
        },
      };
    }

    if (!('modulePack' in validated.source)) {
      throw new Error(
        'INVALID_PROGRAM: module-pack source is missing modulePack payload',
      );
    }

    return {
      mode: 'module-pack',
      legacyArtifact: {
        code: '',
        abiId: validated.abiId,
        abiVersion: validated.abiVersion,
        abiManifestHash: validated.abiManifestHash,
        ...(validated.engineBuildHash
          ? { engineBuildHash: validated.engineBuildHash }
          : {}),
        ...(validated.gasVersion !== undefined
          ? { gasVersion: validated.gasVersion }
          : {}),
        executionProfile: validated.executionProfile,
      },
      modulePack: validated.source.modulePack,
      entryExport: validated.source.modulePack.entryExport ?? 'default',
    };
  }

  return {
    mode: 'script',
    legacyArtifact: validateProgramArtifact(program),
  };
}

async function assertModulePackHash(modulePack: ModulePackV1): Promise<void> {
  const computed = await computeModulePackGraphHash(modulePack);
  if (computed !== modulePack.graphHash) {
    throw new Error(
      `MODULE_PACK_HASH_MISMATCH: expected=${modulePack.graphHash} computed=${computed}`,
    );
  }
}

async function computeModulePackGraphHash(
  modulePack: ModulePackV1,
): Promise<string> {
  const canonical = {
    version: modulePack.version,
    entrySpecifier: modulePack.entrySpecifier,
    entryExport: modulePack.entryExport ?? 'default',
    modules: [...modulePack.modules]
      .sort((left, right) => left.specifier.localeCompare(right.specifier))
      .map((module) => ({
        specifier: module.specifier,
        source: module.source,
        ...(module.sourceMap ? { sourceMap: module.sourceMap } : {}),
      })),
    builderVersion: modulePack.builderVersion,
    dependencyIntegrity: modulePack.dependencyIntegrity,
  };
  const payload = new TextEncoder().encode(stableStringify(canonical));
  const subtle = getSubtleCrypto();
  const digest = await subtle.digest('SHA-256', payload);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function serializeModulePackModules(modulePack: ModulePackV1): string {
  return JSON.stringify(
    modulePack.modules.map((module) => ({
      specifier: module.specifier,
      source: module.source,
    })),
  );
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

type SubtleDigestApi = {
  digest(
    algorithm: string,
    data: ArrayBuffer | ArrayBufferView,
  ): Promise<ArrayBuffer>;
};

function getSubtleCrypto(): SubtleDigestApi {
  const subtle =
    globalThis.crypto && 'subtle' in globalThis.crypto
      ? globalThis.crypto.subtle
      : null;
  if (!subtle) {
    throw new Error(
      'MODULE_PACK_HASH_MISMATCH: crypto.subtle is unavailable for graph hash verification',
    );
  }
  return subtle;
}

function isProgramArtifactV2(value: unknown): value is ProgramArtifactV2 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return (value as { version?: unknown }).version === 2;
}

export type {
  EvaluateInvalidOutputDetail,
  EvaluateVmErrorDetail,
} from './evaluate-errors.js';
