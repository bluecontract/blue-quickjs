import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

test('QuickJS source manifest pins a vendored base archive checksum', async () => {
  const manifestPath = path.join(
    repoRoot,
    'vendor/quickjs-patches/manifest.json',
  );
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

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
