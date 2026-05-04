import type {
  HostDispatcherHandlers,
  HostCallResult,
} from '@blue-quickjs/quickjs-runtime';

const TEXT_DOCUMENTS = new Map<string, string>([
  [
    'pack/metadata.json',
    JSON.stringify(
      {
        packId: 'kp-2026-rc',
        release: '1.2.3',
        requires: ['>=1.2.0 <2.0.0', '^1.2.0'],
        links: ['docs/a.md', 'docs/b.md', 'docs/c.md', 'docs/d.md'],
      },
      null,
      2,
    ),
  ],
  [
    'pack/metadata.yaml',
    [
      'packId: kp-2026-rc',
      'release: 1.2.3',
      'requires:',
      '  - ">=1.2.0 <2.0.0"',
      '  - "^1.2.0"',
      'links:',
      '  - docs/a.md',
      '  - docs/b.md',
      '',
    ].join('\n'),
  ],
  [
    'docs/a.md',
    [
      '# Alpha',
      '',
      'See [Beta](docs/b.md), [Gamma](docs/c.md), and https://example.com/path.',
      '',
      'Encoded value: &amp; deterministic.',
      '',
      'Paragraph: Deterministic workloads should remain stable across',
      'wasm-node and wasm-browser executors.',
      '',
    ].join('\n'),
  ],
  [
    'docs/b.md',
    [
      '# Beta',
      '',
      'Backlink to [Alpha](docs/a.md) and [Delta](docs/d.md).',
      '',
      'Extra URL: https://example.net/release-notes.',
      '',
    ].join('\n'),
  ],
  [
    'docs/c.md',
    [
      '# Gamma',
      '',
      'Cross-link to [Delta](docs/d.md).',
      '',
      'Reference URL: https://example.org/matrix.',
      '',
    ].join('\n'),
  ],
  [
    'docs/d.md',
    [
      '# Delta',
      '',
      'Back to [Alpha](docs/a.md) and [Beta](docs/b.md).',
      '',
      'Reference URL: https://example.dev/consensus.',
      '',
    ].join('\n'),
  ],
  [
    'rules/findings.json',
    JSON.stringify(
      {
        and: [
          { '>=': [{ var: 'linkCount' }, 8] },
          { '==': [{ var: 'releaseOk' }, true] },
        ],
      },
      null,
      2,
    ),
  ],
  ['text/semver-case', '1.2.3'],
  ['text/path-case', '/document/:id/version/:version'],
  ['text/yaml-case', 'name: Blue\nvalue: 42\n'],
  ['text/markdown-case', '# Heading\n\nA [link](https://example.com).\n'],
  ['text/he-case', '&lt;b&gt;safe&lt;/b&gt;'],
  ['text/diff-left', 'alpha\nbeta\ngamma\n'],
  ['text/diff-right', 'alpha\nbeta2\ngamma\n'],
  ['text/json-logic-case', JSON.stringify({ score: 7, threshold: 5 })],
]);

const BINARY_DOCUMENTS = new Map<string, Uint8Array>([
  [
    'bytes/payload',
    Uint8Array.from(
      Array.from({ length: 64 }, (_, index) => (index * 17) % 251),
    ),
  ],
  [
    'bytes/flagship-extra',
    Uint8Array.from(
      Array.from({ length: 192 }, (_, index) => (index * 29 + 11) % 251),
    ),
  ],
  [
    'pack/attachment.deflated',
    Uint8Array.from([
      120, 156, 179, 73, 77, 206, 79, 73, 45, 86, 112, 46, 41, 202, 204, 75, 87,
      72, 206, 207, 43, 73, 45, 2, 0, 101, 57, 8, 181,
    ]),
  ],
]);

export function createCertificationHost(): {
  handlers: HostDispatcherHandlers;
  emitted: unknown[];
} {
  const emitted: unknown[] = [];

  const handlers: HostDispatcherHandlers = {
    document: {
      get: (docPath: string): HostCallResult => {
        const binaryDocument = BINARY_DOCUMENTS.get(docPath);
        if (binaryDocument !== undefined) {
          return { ok: binaryDocument, units: 6 };
        }
        const textDocument = TEXT_DOCUMENTS.get(docPath);
        if (textDocument !== undefined) {
          return { ok: textDocument, units: 2 };
        }
        return {
          err: { code: 'NOT_FOUND', tag: 'host/not_found' },
          units: 1,
        };
      },
      getCanonical: (docPath: string): HostCallResult => {
        const textDocument = TEXT_DOCUMENTS.get(docPath);
        if (textDocument !== undefined) {
          return { ok: textDocument, units: 2 };
        }
        const binaryDocument = BINARY_DOCUMENTS.get(docPath);
        if (binaryDocument !== undefined) {
          return { ok: binaryDocument, units: 6 };
        }
        return {
          err: { code: 'NOT_FOUND', tag: 'host/not_found' },
          units: 1,
        };
      },
    },
    emit: (value: unknown) => {
      emitted.push(value);
      return { ok: null, units: 1 };
    },
  };

  return { handlers, emitted };
}
