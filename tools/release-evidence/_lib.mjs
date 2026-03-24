import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(targetDir) {
  await mkdir(targetDir, { recursive: true });
}

export function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

export async function sha256FileHex(filePath) {
  const content = await readFile(filePath);
  return sha256Hex(content);
}

export async function copyIntoEvidenceDir(sourcePath, targetDir, targetName) {
  await ensureDir(targetDir);
  const destinationPath = path.join(targetDir, targetName ?? path.basename(sourcePath));
  await copyFile(sourcePath, destinationPath);
  return destinationPath;
}

export async function createManifestEntry(filePath, evidenceRoot, category) {
  const digest = await sha256FileHex(filePath);
  const fileStat = await stat(filePath);
  return {
    category,
    file: path.relative(evidenceRoot, filePath),
    sha256: digest,
    sizeBytes: fileStat.size,
  };
}

export function createDetachedSignature(payloadBytes, options = {}) {
  if (options.privateKeyPem) {
    const key = createPrivateKey(options.privateKeyPem);
    const signatureBytes = sign(null, payloadBytes, key);
    return {
      mode: 'ed25519',
      algorithm: 'ed25519',
      keyId: options.keyId ?? 'release-evidence',
      signatureBase64: signatureBytes.toString('base64'),
    };
  }

  return {
    mode: 'digest-fallback',
    algorithm: 'sha256',
    keyId: options.keyId ?? 'digest-fallback',
    signatureHex: sha256Hex(payloadBytes),
  };
}

export function verifyDetachedSignature(payloadBytes, signaturePayload, options = {}) {
  if (signaturePayload.mode === 'ed25519') {
    if (!options.publicKeyPem) {
      return {
        ok: false,
        reason: 'missing public key for ed25519 signature verification',
      };
    }
    const key = createPublicKey(options.publicKeyPem);
    const signatureBytes = Buffer.from(signaturePayload.signatureBase64, 'base64');
    const isValid = verify(null, payloadBytes, key, signatureBytes);
    return {
      ok: isValid,
      reason: isValid ? null : 'ed25519 signature mismatch',
    };
  }

  const expectedDigest = sha256Hex(payloadBytes);
  const isValid = signaturePayload.signatureHex === expectedDigest;
  return {
    ok: isValid,
    reason: isValid ? null : 'sha256 digest signature mismatch',
  };
}

export async function writeChecksumFile(filePath) {
  const digest = await sha256FileHex(filePath);
  const checksumPath = `${filePath}.sha256`;
  await writeFile(
    checksumPath,
    `${digest}  ${path.basename(filePath)}\n`,
    'utf8',
  );
  return checksumPath;
}

export async function writeSignatureFile(filePath, signaturePayload) {
  const signaturePath = `${filePath}.sig`;
  await writeFile(
    signaturePath,
    `${JSON.stringify(signaturePayload, null, 2)}\n`,
    'utf8',
  );
  return signaturePath;
}

export async function loadOptionalText(valueOrPath) {
  if (!valueOrPath) {
    return null;
  }
  const normalized = valueOrPath.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.includes('BEGIN') || normalized.includes('\n')) {
    return normalized;
  }
  return readFile(path.resolve(process.cwd(), normalized), 'utf8');
}

export async function verifyManifestBundle(manifest, evidenceRoot, options = {}) {
  const errors = [];
  let verifiedCount = 0;

  for (const artifact of manifest.artifacts) {
    const artifactPath = path.resolve(evidenceRoot, artifact.file);
    let digest;
    try {
      digest = await sha256FileHex(artifactPath);
    } catch (error) {
      errors.push({
        type: 'missing-artifact',
        file: artifact.file,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    if (digest !== artifact.sha256) {
      errors.push({
        type: 'checksum-mismatch',
        file: artifact.file,
        expected: artifact.sha256,
        actual: digest,
      });
      continue;
    }

    if (artifact.signatureFile) {
      const signaturePath = path.resolve(evidenceRoot, artifact.signatureFile);
      try {
        const signaturePayload = JSON.parse(await readFile(signaturePath, 'utf8'));
        const verification = verifyDetachedSignature(
          await readFile(artifactPath),
          signaturePayload,
          options,
        );
        if (!verification.ok) {
          errors.push({
            type: 'signature-mismatch',
            file: artifact.file,
            signatureFile: artifact.signatureFile,
            reason: verification.reason,
          });
          continue;
        }
      } catch (error) {
        errors.push({
          type: 'signature-read-failure',
          file: artifact.file,
          signatureFile: artifact.signatureFile,
          message: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    verifiedCount += 1;
  }

  return {
    ok: errors.length === 0,
    verifiedCount,
    errorCount: errors.length,
    errors,
  };
}
