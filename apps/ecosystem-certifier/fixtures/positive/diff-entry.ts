import { diffLines } from 'diff';

const left = Host.v1.document.get('text/diff-left');
const right = Host.v1.document.get('text/diff-right');
const chunks = diffLines(left, right);

export default {
  chunkCount: chunks.length,
  added: chunks.filter((chunk) => chunk.added).length,
  removed: chunks.filter((chunk) => chunk.removed).length,
};
