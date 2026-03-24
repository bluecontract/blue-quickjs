#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(
  __dirname,
  '../src/shared/fixtures/stress-corpus.generated.json',
);
const seed = 0x6d2b79f5;

const rng = createXorShift(seed);
const markdownDocs = [];
const semverChecks = [];
const numericWork = [];

for (let i = 0; i < 32; i += 1) {
  const id = `doc-${i.toString().padStart(2, '0')}`;
  const links = [
    `https://example.com/${Math.floor(rng() * 5000)}`,
    `https://example.org/${Math.floor(rng() * 5000)}`,
  ];
  markdownDocs.push({
    id,
    markdown: `# ${id}\n\nLink A: ${links[0]}\n\nLink B: ${links[1]}\n`,
  });
}

for (let i = 0; i < 128; i += 1) {
  const major = 1 + Math.floor(rng() * 3);
  const minor = Math.floor(rng() * 10);
  const patch = Math.floor(rng() * 20);
  const version = `${major}.${minor}.${patch}`;
  semverChecks.push({
    version,
    range: `>=${major}.${Math.max(0, minor - 1)}.0 <${major + 1}.0.0`,
  });
}

for (let i = 0; i < 256; i += 1) {
  numericWork.push(Math.floor(rng() * 100_000));
}

const payload = {
  version: 1,
  seed,
  markdownDocs,
  semverChecks,
  numericWork,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, docs: markdownDocs.length }, null, 2));

function createXorShift(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}
