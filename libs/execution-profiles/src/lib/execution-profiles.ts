export type DeterministicCapability =
  | 'regexp'
  | 'promiseJobs'
  | 'queueMicrotask'
  | 'stableSort'
  | 'consoleShim'
  | 'typedArrays'
  | 'dvBytes';

export type PublicExecutionProfile =
  | 'baseline-v1'
  | 'compat-general-v1'
  | 'compat-binary-v1';

export interface ExecutionProfileDefinition {
  id: PublicExecutionProfile;
  capabilities: readonly DeterministicCapability[];
}

const PROFILE_CAPABILITIES: Record<
  PublicExecutionProfile,
  readonly DeterministicCapability[]
> = {
  'baseline-v1': [],
  'compat-general-v1': [
    'regexp',
    'promiseJobs',
    'queueMicrotask',
    'stableSort',
    'consoleShim',
  ],
  'compat-binary-v1': [
    'regexp',
    'promiseJobs',
    'queueMicrotask',
    'stableSort',
    'consoleShim',
    'typedArrays',
    'dvBytes',
  ],
};

export const EXECUTION_PROFILE_REGISTRY: Record<
  PublicExecutionProfile,
  ExecutionProfileDefinition
> = Object.freeze(
  Object.fromEntries(
    Object.entries(PROFILE_CAPABILITIES).map(([id, capabilities]) => [
      id,
      {
        id: id as PublicExecutionProfile,
        capabilities,
      },
    ]),
  ) as Record<PublicExecutionProfile, ExecutionProfileDefinition>,
);

const KNOWN_PROFILES = Object.freeze(
  new Set(Object.keys(PROFILE_CAPABILITIES) as PublicExecutionProfile[]),
);

export function isKnownExecutionProfile(
  value: unknown,
): value is PublicExecutionProfile {
  return (
    typeof value === 'string' &&
    KNOWN_PROFILES.has(value as PublicExecutionProfile)
  );
}

export function getExecutionProfileCapabilities(
  profile: PublicExecutionProfile,
): readonly DeterministicCapability[] {
  return PROFILE_CAPABILITIES[profile];
}

export function executionProfileHasCapability(
  profile: PublicExecutionProfile,
  capability: DeterministicCapability,
): boolean {
  return PROFILE_CAPABILITIES[profile].includes(capability);
}

export function listExecutionProfiles(): readonly PublicExecutionProfile[] {
  return Object.keys(PROFILE_CAPABILITIES) as PublicExecutionProfile[];
}
