import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

test('QuickJS source manifest pins a vendored base archive checksum', async () => {
  const manifest = await readManifest();

  assert.equal(typeof manifest.baseArchive, 'string');
  assert.equal(typeof manifest.baseArchiveSha256, 'string');
  assert.match(manifest.baseArchiveSha256, /^[0-9a-f]{64}$/);

  const archivePath = path.join(repoRoot, manifest.baseArchive);
  const checksumPath = `${archivePath}.sha256`;
  const archiveStat = await stat(archivePath);
  assert.equal(archiveStat.isFile(), true);

  const archiveBytes = await readFile(archivePath);
  const actualHash = createHash('sha256').update(archiveBytes).digest('hex');
  assert.equal(actualHash, manifest.baseArchiveSha256);

  const checksumText = await readFile(checksumPath, 'utf8');
  assert.equal(checksumText.split(/\s+/)[0], manifest.baseArchiveSha256);
});

test('QuickJS patch manifest matches the committed patch series', async () => {
  const manifest = await readManifest();

  assert.equal(typeof manifest.baseCommit, 'string');
  assert.match(manifest.baseCommit, /^[0-9a-f]{40}$/);
  assert.equal(typeof manifest.headCommit, 'string');
  assert.match(manifest.headCommit, /^[0-9a-f]{40}$/);
  assert.equal(Number.isInteger(manifest.patchCount), true);
  assert.ok(manifest.patchCount > 0);

  const patchDir = path.join(repoRoot, manifest.patchDirectory);
  const patchFiles = (await readdir(patchDir))
    .filter((name) => name.endsWith('.patch'))
    .sort();

  assert.equal(patchFiles.length, manifest.patchCount);
  assert.equal(new Set(patchFiles).size, patchFiles.length);
  assert.deepEqual(patchFiles, [...patchFiles].sort());

  for (const [index, patchFile] of patchFiles.entries()) {
    const expectedPrefix = String(index + 1).padStart(4, '0');
    assert.match(
      patchFile,
      new RegExp(`^${expectedPrefix}-[A-Za-z0-9._-]+\\.patch$`),
      `${patchFile} must use a deterministic numbered patch filename`,
    );
    await stat(path.join(patchDir, patchFile));
  }
});

async function readManifest() {
  const manifestPath = path.join(
    repoRoot,
    'vendor/quickjs-patches/manifest.json',
  );
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}
