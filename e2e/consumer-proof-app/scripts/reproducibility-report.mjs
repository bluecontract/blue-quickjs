#!/usr/bin/env node

import { spawn } from 'node:child_process';
import {
  appRoot,
  artifactPath,
  browserResultPath,
  nodeResultPath,
  oogBoundaryPath,
  readJson,
  reproPath,
  sha256Hex,
  writeJson,
} from './_helpers.mjs';

await run('node', ['scripts/build-artifact.mjs']);
await run('node', ['scripts/run-node.mjs']);
await run('node', ['scripts/run-browser.mjs']);
await run('node', ['scripts/find-oog-boundary.mjs']);

const artifact = await readJson(artifactPath);
const nodeResult = await readJson(nodeResultPath);
const browserResult = await readJson(browserResultPath);
const oogBoundary = await readJson(oogBoundaryPath);

const nodeSnapshot = nodeResult.snapshot;
const browserSnapshot = browserResult.snapshot;
const parity = {
  snapshotEqual:
    JSON.stringify(nodeSnapshot) === JSON.stringify(browserSnapshot),
  oogEqual:
    oogBoundary.parity.firstSuccessEqual && oogBoundary.parity.lastFailureEqual,
};

const report = {
  generatedAt: new Date().toISOString(),
  artifact: {
    graphHash: artifact.graphHash,
    moduleCount: artifact.moduleCount,
  },
  node: nodeSnapshot,
  browser: browserSnapshot,
  oogBoundary,
  parity,
  signature: {
    algorithm: 'sha256',
    digest: sha256Hex(JSON.stringify({ artifact, nodeSnapshot, browserSnapshot, oogBoundary })),
  },
};

await writeJson(reproPath, report);
await writeJson(`${reproPath}.sha256`, {
  algorithm: 'sha256',
  digest: sha256Hex(JSON.stringify(report)),
});

console.log(JSON.stringify({ reproPath, parity }, null, 2));
if (!parity.snapshotEqual || !parity.oogEqual) {
  process.exitCode = 1;
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: appRoot, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`command failed (${command} ${args.join(' ')})`));
    });
  });
}
