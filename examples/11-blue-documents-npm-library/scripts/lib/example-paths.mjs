import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const exampleRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export const artifactsDir = resolve(exampleRoot, 'artifacts');
export const libraryArtifactPath = resolve(
  artifactsDir,
  'chess-library-artifact.json',
);
export const userDocumentPath = resolve(artifactsDir, 'user-document.yaml');
export const programArtifactPath = resolve(
  artifactsDir,
  'user-program-artifact.json',
);

export const chessLibraryDocumentId = 'npm:chess.js@1.0.0';
