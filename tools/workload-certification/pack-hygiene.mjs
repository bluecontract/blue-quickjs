import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const EMITTED_TEXT_FILE_PATTERN =
  /(?:^|\/)dist\/.*\.(?:[cm]?js|[cm]?ts|d\.[cm]?ts)$/;
const TEST_FILE_PATTERN = /\.(?:spec|test)\.[^/]+$/;
const VITEST_REFERENCE_PATTERN = /\bvitest\b/;

export async function validatePackedPackageHygiene(packageName, tarballPath) {
  const { stdout } = await execFileAsync('tar', ['-tzf', tarballPath], {
    maxBuffer: 1024 * 1024 * 16,
  });
  const entries = stdout
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const files = [];

  for (const entry of entries) {
    const normalizedPath = normalizeTarEntry(entry);
    const file = { path: normalizedPath };

    if (isEmittedTextFile(normalizedPath)) {
      const extracted = await execFileAsync('tar', ['-xOf', tarballPath, entry], {
        maxBuffer: 1024 * 1024 * 16,
      });
      file.text = extracted.stdout;
    }

    files.push(file);
  }

  const violations = findPackedPackageHygieneViolations(files);
  if (violations.length > 0) {
    throw new Error(
      [
        `${packageName} packed output contains test-only artifacts:`,
        ...violations.map((violation) => `- ${violation}`),
      ].join('\n'),
    );
  }
}

export function findPackedPackageHygieneViolations(files) {
  const violations = [];

  for (const file of files) {
    const normalizedPath = normalizeTarEntry(file.path);

    if (normalizedPath === 'dist/test' || normalizedPath.startsWith('dist/test/')) {
      violations.push(`${normalizedPath} is under dist/test`);
    }

    if (TEST_FILE_PATTERN.test(normalizedPath)) {
      violations.push(`${normalizedPath} is a test/spec artifact`);
    }

    if (
      isEmittedTextFile(normalizedPath) &&
      typeof file.text === 'string' &&
      VITEST_REFERENCE_PATTERN.test(file.text)
    ) {
      violations.push(`${normalizedPath} references vitest`);
    }
  }

  return violations;
}

function isEmittedTextFile(filePath) {
  return EMITTED_TEXT_FILE_PATTERN.test(filePath);
}

function normalizeTarEntry(entry) {
  return entry.replaceAll('\\', '/').replace(/^package\//, '').replace(/\/$/, '');
}
