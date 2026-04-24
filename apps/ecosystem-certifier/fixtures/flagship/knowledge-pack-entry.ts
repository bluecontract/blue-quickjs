import { toByteArray, fromByteArray } from 'base64-js';
import { inflateSync } from 'fflate';
import deepEqual from 'fast-deep-equal';
import stableStringify from 'fast-json-stable-stringify';
import he from 'he';
import jsonLogic from 'json-logic-js';
import LinkifyIt from 'linkify-it';
import MarkdownIt from 'markdown-it';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { match as pathMatch } from 'path-to-regexp';
import semver from 'semver';
import TinyQueue from 'tinyqueue';
import CRC32 from 'crc-32';

let summary;
try {
  const metadataText = Host.v2.document.get('pack/metadata.json');
  const ruleText = Host.v2.document.get('rules/findings.json');
  const compressedAttachment = Host.v2.document.get('pack/attachment.deflated');
  const payload = Host.v2.document.get('bytes/payload');
  const extraPayload = Host.v2.document.get('bytes/flagship-extra');

  const metadata = JSON.parse(metadataText);
  const docPaths = metadata.links ?? ['docs/a.md', 'docs/b.md'];
  const docs = docPaths.map((docPath) => ({
    docPath,
    text: Host.v2.document.get(docPath),
  }));
  const markdown = new MarkdownIt({ linkify: true });
  const linkify = new LinkifyIt();
  const markdownSource = docs.map((doc) => doc.text).join('\n');
  const markdownTokens = markdown.parse(markdownSource, {});
  const linkMatches = docs
    .flatMap((doc) => linkify.match(doc.text) ?? [])
    .map((item) => item.url);

  const releaseChecks = (metadata.requires ?? []).map((range) =>
    semver.satisfies(metadata.release, range),
  );
  const rules = JSON.parse(ruleText);
  const findingInput = {
    linkCount: linkMatches.length,
    releaseOk: releaseChecks.every(Boolean),
  };
  const ruleInputStable = deepEqual(
    findingInput,
    JSON.parse(stableStringify(findingInput)),
  );
  const rulePasses = Boolean(jsonLogic.apply(rules, findingInput));

  const queue = new TinyQueue(
    [],
    (left, right) => left.priority - right.priority,
  );
  for (const link of linkMatches) {
    queue.push({ link, priority: link.length });
  }
  const orderedLinks = [];
  while (queue.length > 0) {
    orderedLinks.push(queue.pop().link);
  }

  const decompressed = inflateSync(compressedAttachment);
  const attachmentRoundTrip = toByteArray(fromByteArray(decompressed));
  const mergedBinary = new Uint8Array(
    attachmentRoundTrip.length + payload.length + extraPayload.length,
  );
  mergedBinary.set(attachmentRoundTrip, 0);
  mergedBinary.set(payload, attachmentRoundTrip.length);
  mergedBinary.set(extraPayload, attachmentRoundTrip.length + payload.length);
  const digestHex = bytesToHex(sha256(mergedBinary));
  const crc32 = (CRC32.buf(mergedBinary) >>> 0).toString(16).padStart(8, '0');

  const decodedEntities = he.decode('&lt;b&gt;safe&lt;/b&gt;');
  const versionCapture = pathMatch('/document/:id/version/:version')(
    '/document/42/version/1.2.3',
  );
  const orderedFindings = [
    { id: 'links', value: linkMatches.length },
    { id: 'rules', value: Number(rulePasses) },
    { id: 'tokens', value: markdownTokens.length },
  ].sort((left, right) => left.id.localeCompare(right.id));

  Promise.resolve('scheduled').then(() => undefined);
  queueMicrotask(() => undefined);

  for (const doc of docs) {
    Host.v2.emit({
      type: 'knowledge-pack-doc',
      docPath: doc.docPath,
      length: doc.text.length,
    });
  }

  summary = {
    status: 'ok',
    packId: metadata.packId,
    release: metadata.release,
    checks: releaseChecks,
    docTokenCount: markdownTokens.length,
    linkCount: linkMatches.length,
    uniqueLinks: [...new Set(orderedLinks)],
    binary: {
      byteLength: mergedBinary.length,
      digestHex,
      crc32,
    },
    decodedEntities,
    versionCapture,
    findings: orderedFindings,
    ruleInputStable,
    rulePasses,
  };
} catch (error) {
  summary = {
    status: 'error',
    message: String(error instanceof Error ? error.message : error),
  };
}

Host.v2.emit({
  type: 'knowledge-pack-summary',
  summaryHash: bytesToHex(
    sha256(
      toByteArray(
        fromByteArray(
          new Uint8Array([
            ...Host.v2.document.get('bytes/payload'),
            ...Host.v2.document.get('bytes/flagship-extra'),
          ]),
        ),
      ),
    ),
  ),
  status: summary.status,
});

export default summary;
