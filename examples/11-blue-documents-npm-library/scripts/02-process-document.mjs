#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

import { parse } from 'yaml';

import {
  chessLibraryDocumentId,
  libraryArtifactPath,
  programArtifactPath,
  userDocumentPath,
} from './lib/example-paths.mjs';
import { loadBlueQuickjsPackage } from './lib/load-bluequickjs-package.mjs';

const { buildStepArtifact, inspectBlueDocument } = await loadBlueQuickjsPackage(
  '@blue-quickjs/blue-documents',
  'libs/blue-documents/src/index.ts',
);

const libraryArtifact = JSON.parse(await readFile(libraryArtifactPath, 'utf8'));
const userDocument = parse(await readFile(userDocumentPath, 'utf8'));

const built = await buildStepArtifact(userDocument.step, userDocument, {
  documents: {
    [chessLibraryDocumentId]: libraryArtifact,
  },
});

await writeFile(
  programArtifactPath,
  `${JSON.stringify(built.programArtifact, null, 2)}\n`,
);

console.log('Processed user document into ProgramArtifact.v2');
console.log(`Wrote ${programArtifactPath}`);
console.log('Document JavaScript entry:');
console.log(userDocument.step.entry);
console.log(
  JSON.stringify(
    {
      userStep: inspectBlueDocument(userDocument.step),
      importedLibraries: built.importedLibraries,
      programArtifact: {
        version: built.programArtifact.version,
        sourceKind: built.programArtifact.sourceKind,
        executionProfile: built.programArtifact.executionProfile,
        abiId: built.programArtifact.abiId,
        abiVersion: built.programArtifact.abiVersion,
        modulePackGraphHash:
          built.programArtifact.sourceKind === 'module-pack'
            ? built.programArtifact.source.modulePack.graphHash
            : null,
      },
    },
    null,
    2,
  ),
);
