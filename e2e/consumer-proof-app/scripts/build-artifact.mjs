#!/usr/bin/env node

import { HOST_V1_HASH } from '@blue-quickjs/abi-manifest';
import { buildDeterministicModulePack } from '@blue-quickjs/deterministic-bundler';
import path from 'node:path';
import {
  appRoot,
  artifactPath,
  ensureReportsDir,
  writeJson,
} from './_helpers.mjs';

await ensureReportsDir();

const built = await buildDeterministicModulePack({
  absWorkingDir: appRoot,
  entryPath: 'src/shared/consumer-workload.ts',
  profile: 'compat-general-v1',
  emitProgramArtifact: true,
  abiId: 'Host.v1',
  abiVersion: 1,
  abiManifestHash: HOST_V1_HASH,
});

if (!built.compatibility.ok) {
  throw new Error(
    `consumer workload is incompatible: ${JSON.stringify(
      built.compatibility.diagnostics,
    )}`,
  );
}
if (!built.programArtifact) {
  throw new Error('builder did not produce ProgramArtifact.v2');
}

const payload = {
  generatedAt: new Date().toISOString(),
  graphHash: built.modulePack.graphHash,
  moduleCount: built.modulePack.modules.length,
  artifact: built.programArtifact,
};

await writeJson(artifactPath, payload);

console.log(
  JSON.stringify(
    {
      artifactPath,
      graphHash: payload.graphHash,
      moduleCount: payload.moduleCount,
      relativeEntry: path.relative(appRoot, 'src/shared/consumer-workload.ts'),
    },
    null,
    2,
  ),
);
