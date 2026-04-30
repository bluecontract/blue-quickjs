import assert from 'node:assert/strict';
import test from 'node:test';
import { checkReleaseDocFreshness } from './check-release-doc-freshness.mjs';

const report = ({ branch = 'feature/readiness', date = '2026-04-30' } = {}) =>
  [
    '# Release Readiness Report',
    '',
    `Date: ${date}`,
    `Branch: \`${branch}\``,
    '',
  ].join('\n');

test('release readiness freshness passes for the expected branch and date', () => {
  const result = checkReleaseDocFreshness({
    reportText: report(),
    expectedBranch: 'feature/readiness',
    expectedDate: '2026-04-30',
  });

  assert.deepEqual(result.checks, {
    branchMatches: true,
    dateMatches: true,
  });
});

test('release readiness freshness reports stale dates', () => {
  const result = checkReleaseDocFreshness({
    reportText: report({ date: '2026-04-29' }),
    expectedBranch: 'feature/readiness',
    expectedDate: '2026-04-30',
  });

  assert.deepEqual(result.checks, {
    branchMatches: true,
    dateMatches: false,
  });
});

test('release readiness freshness reports branch mismatches', () => {
  const result = checkReleaseDocFreshness({
    reportText: report({ branch: 'main' }),
    expectedBranch: 'feature/readiness',
    expectedDate: '2026-04-30',
  });

  assert.deepEqual(result.checks, {
    branchMatches: false,
    dateMatches: true,
  });
});

test('release readiness freshness rejects missing report dates', () => {
  assert.throws(
    () =>
      checkReleaseDocFreshness({
        reportText: 'Branch: `feature/readiness`\n',
        expectedBranch: 'feature/readiness',
        expectedDate: '2026-04-30',
      }),
    /missing Date line/,
  );
});
