#!/usr/bin/env node

import { HOST_V1_MANIFEST } from '@blue-quickjs/abi-manifest';
import { encodeDv } from '@blue-quickjs/dv';
import { evaluate } from '@blue-quickjs/quickjs-runtime';
import {
  artifactPath,
  createInputEnvelope,
  nodeResultPath,
  readJson,
  snapshotFromResult,
  writeJson,
} from './_helpers.mjs';
import { createConsumerHost } from './consumer-host.mjs';

const args = parseArgs(process.argv.slice(2));
const payload = await readJson(args.artifactPath ?? artifactPath);

const host = createConsumerHost();
const result = await evaluate({
  program: payload.artifact,
  input: createInputEnvelope(),
  gasLimit: BigInt(args.gasLimit),
  manifest: HOST_V1_MANIFEST,
  handlers: host.handlers,
  tape: { capacity: 32 },
});

const snapshot = snapshotFromResult(result, encodeDv);
const output = {
  generatedAt: new Date().toISOString(),
  gasLimit: args.gasLimit,
  snapshot,
  emitted: host.emitted,
};

await writeJson(nodeResultPath, output);
console.log(JSON.stringify({ nodeResultPath, snapshot }, null, 2));

function parseArgs(argv) {
  let gasLimit = '1000000';
  let targetArtifactPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--gas-limit') {
      gasLimit = argv[index + 1] ?? gasLimit;
      index += 1;
      continue;
    }
    if (arg === '--artifact') {
      targetArtifactPath = argv[index + 1] ?? targetArtifactPath;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { gasLimit, artifactPath: targetArtifactPath };
}
