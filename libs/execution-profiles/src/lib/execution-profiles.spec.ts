import {
  executionProfileHasCapability,
  getExecutionProfileCapabilities,
  isKnownExecutionProfile,
  listExecutionProfiles,
} from './execution-profiles.js';

describe('execution profile registry', () => {
  it('recognizes known public profiles', () => {
    expect(isKnownExecutionProfile('baseline-v1')).toBe(true);
    expect(isKnownExecutionProfile('compat-general-v1')).toBe(true);
    expect(isKnownExecutionProfile('compat-binary-v1')).toBe(true);
    expect(isKnownExecutionProfile('compat-unknown-v1')).toBe(false);
  });

  it('returns deterministic capability sets per profile', () => {
    expect(getExecutionProfileCapabilities('baseline-v1')).toEqual([]);
    expect(getExecutionProfileCapabilities('compat-regexp-v1')).toEqual([
      'regexp',
    ]);
    expect(getExecutionProfileCapabilities('compat-general-v1')).toEqual([
      'regexp',
      'promiseJobs',
      'queueMicrotask',
      'stableSort',
      'consoleShim',
    ]);
    expect(getExecutionProfileCapabilities('compat-binary-v1')).toEqual([
      'regexp',
      'promiseJobs',
      'queueMicrotask',
      'stableSort',
      'consoleShim',
      'typedArrays',
      'dvBytes',
    ]);
  });

  it('checks individual capability membership', () => {
    expect(executionProfileHasCapability('baseline-v1', 'regexp')).toBe(false);
    expect(executionProfileHasCapability('compat-regexp-v1', 'regexp')).toBe(
      true,
    );
    expect(
      executionProfileHasCapability('compat-binary-v1', 'typedArrays'),
    ).toBe(true);
  });

  it('lists all profiles in deterministic order', () => {
    expect(listExecutionProfiles()).toEqual([
      'baseline-v1',
      'compat-regexp-v1',
      'compat-general-v1',
      'compat-binary-v1',
    ]);
  });
});
