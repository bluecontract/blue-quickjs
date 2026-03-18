import { toByteArray, fromByteArray } from 'base64-js';
import { diffLines } from 'diff';
import { inflateSync } from 'fflate';
import stableStringify from 'fast-json-stable-stringify';
import { Graph } from 'graphlib';
import he from 'he';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { match as pathMatch } from 'path-to-regexp';
import semver from 'semver';
import TinyQueue from 'tinyqueue';
import CRC32 from 'crc-32';

const metadataText = Host.v2.document.get('pack/metadata.json');
const docAText = Host.v2.document.get('docs/a.md');
const docBText = Host.v2.document.get('docs/b.md');
const compressedAttachment = Host.v2.document.get('pack/attachment.deflated');

const metadata = JSON.parse(metadataText);
const linkMatches = [...`${docAText}\n${docBText}`.matchAll(/https?:\/\/\S+/g)].map(
  (match) => match[0],
);
const releaseChecks = (metadata.requires ?? []).map((range) =>
  semver.satisfies(metadata.release, range),
);

const graph = new Graph({ directed: true });
for (const docPath of ['docs/a.md', 'docs/b.md']) {
  graph.setNode(docPath);
}
graph.setEdge('docs/a.md', 'docs/b.md');
graph.setEdge('docs/b.md', 'docs/a.md');
for (const url of linkMatches) {
  graph.setNode(url);
  graph.setEdge('docs/a.md', url);
}

const queue = new TinyQueue([], (left, right) => left.priority - right.priority);
for (const link of linkMatches) {
  queue.push({ link, priority: link.length });
}
const orderedLinks = [];
while (queue.length > 0) {
  orderedLinks.push(queue.pop().link);
}

const orderedFindingIds = [
  { id: 'links', value: linkMatches.length },
  { id: 'rules', value: Number(releaseChecks.every(Boolean)) },
  { id: 'text-size', value: docAText.length + docBText.length },
].sort((left, right) => left.id.localeCompare(right.id));

const decompressed = inflateSync(compressedAttachment);
const base64RoundTrip = toByteArray(fromByteArray(decompressed));
const digestHex = bytesToHex(sha256(base64RoundTrip));
const crc32 = (CRC32.buf(base64RoundTrip) >>> 0).toString(16).padStart(8, '0');

const decodedEntities = he.decode('&lt;b&gt;safe&lt;/b&gt;');
const rulePasses = releaseChecks.every(Boolean) && linkMatches.length >= 1;

const versionCapture = pathMatch('/document/:id/version/:version')(
  '/document/42/version/1.2.3',
);
const docDiff = diffLines(docAText, docBText);

export default (async () => {
  const microtaskEvents = [];
  queueMicrotask(() => {
    microtaskEvents.push('queueMicrotask');
  });
  await Promise.resolve();

  const summary = {
    packId: metadata.packId,
    release: metadata.release,
    checks: releaseChecks,
    docTokenCount: docDiff.reduce(
      (count, segment) => count + segment.value.split('\n').length - 1,
      0,
    ),
    linkCount: linkMatches.length,
    uniqueLinks: [...new Set(orderedLinks)],
    graph: {
      nodeCount: graph.nodeCount(),
      edgeCount: graph.edgeCount(),
    },
    binary: {
      byteLength: base64RoundTrip.length,
      digestHex,
      crc32,
    },
    decodedEntities,
    versionCapture,
    diffSegments: docDiff.length,
    findings: orderedFindingIds,
    rulePasses,
    microtaskEvents,
  };

  Host.v2.emit({
    type: 'knowledge-pack-summary',
    summaryHash: bytesToHex(
      sha256(new TextEncoder().encode(stableStringify(summary))),
    ),
  });

  return summary;
})();
