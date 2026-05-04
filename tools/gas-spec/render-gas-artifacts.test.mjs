import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { renderGasScheduleDocument } from './render-gas-artifacts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(__dirname, 'gas-spec.v3.json');

test('rendered gas schedule ends with exactly one newline', async () => {
  const spec = JSON.parse(await readFile(specPath, 'utf8'));
  const rendered = renderGasScheduleDocument(spec);

  assert.match(rendered, /\n$/);
  assert.doesNotMatch(rendered, /\n\n$/);
});
