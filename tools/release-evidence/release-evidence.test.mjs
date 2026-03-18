import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createDetachedSignature,
  createManifestEntry,
  verifyDetachedSignature,
  verifyManifestBundle,
  writeSignatureFile,
} from './_lib.mjs';

test('digest fallback signatures verify deterministically', async () => {
  const payload = Buffer.from('release-evidence');
  const signature = createDetachedSignature(payload);
  const verification = verifyDetachedSignature(payload, signature);
  assert.equal(verification.ok, true);
});

test('ed25519 signatures verify with public key', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const payload = Buffer.from('consensus-evidence');
  const signature = createDetachedSignature(payload, {
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }),
    keyId: 'test-key',
  });
  const verification = verifyDetachedSignature(payload, signature, {
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }),
  });
  assert.equal(verification.ok, true);
});

test('manifest verification fails when artifact content is tampered', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'release-evidence-test-'));
  try {
    const artifactPath = path.join(tempDir, 'sample.json');
    await writeFile(artifactPath, '{"ok":true}\n', 'utf8');

    const artifactEntry = await createManifestEntry(
      artifactPath,
      tempDir,
      'release-evidence',
    );
    const signaturePayload = createDetachedSignature(
      await readFile(artifactPath),
      {},
    );
    const signaturePath = await writeSignatureFile(artifactPath, signaturePayload);
    artifactEntry.signatureFile = path.relative(tempDir, signaturePath);

    const manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      branch: 'cursor/test',
      date: '2026-03-18',
      artifacts: [artifactEntry],
    };

    const valid = await verifyManifestBundle(manifest, tempDir, {});
    assert.equal(valid.ok, true);

    await writeFile(artifactPath, '{"ok":false}\n', 'utf8');
    const tampered = await verifyManifestBundle(manifest, tempDir, {});
    assert.equal(tampered.ok, false);
    assert.equal(
      tampered.errors.some((error) => error.type === 'checksum-mismatch'),
      true,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
