#!/usr/bin/env node

import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const targets =
  args.files.length > 0 ? args.files : await discoverDefaultTargets(repoRoot);

const missingLinks = [];
const checkedLinks = [];

for (const target of targets) {
  const sourcePath = path.resolve(repoRoot, target);
  const markdown = await readFile(sourcePath, 'utf8');
  const links = extractMarkdownLinks(markdown);
  for (const link of links) {
    if (isExternalOrAnchor(link.href)) {
      continue;
    }
    const normalizedHref = normalizeHref(link.href);
    const resolvedPath = path.resolve(path.dirname(sourcePath), normalizedHref);
    checkedLinks.push({
      file: target,
      href: link.href,
      resolvedPath: path.relative(repoRoot, resolvedPath),
    });
    try {
      await access(resolvedPath);
    } catch {
      missingLinks.push({
        file: target,
        href: link.href,
        resolvedPath: path.relative(repoRoot, resolvedPath),
      });
    }
  }
}

const output = {
  checkedFileCount: targets.length,
  checkedLinkCount: checkedLinks.length,
  missingLinkCount: missingLinks.length,
  missingLinks,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (missingLinks.length > 0) {
  process.exitCode = 1;
}

function parseArgs(argv) {
  const files = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--file') {
      const file = argv[index + 1];
      if (!file) {
        throw new Error('--file requires a value');
      }
      files.push(file);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { files };
}

function extractMarkdownLinks(markdown) {
  const links = [];
  const pattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match = pattern.exec(markdown);
  while (match) {
    links.push({ href: match[1] });
    match = pattern.exec(markdown);
  }
  return links;
}

function isExternalOrAnchor(href) {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#')
  );
}

function normalizeHref(href) {
  const withoutFragment = href.split('#', 1)[0];
  const withoutQuery = withoutFragment.split('?', 1)[0];
  return withoutQuery;
}

async function discoverDefaultTargets(repoRoot) {
  const docsDir = path.join(repoRoot, 'docs');
  const docsFiles = await walkMarkdownFiles(repoRoot, docsDir);
  return ['README.md', ...docsFiles, 'examples/README.md'];
}

async function walkMarkdownFiles(repoRoot, currentDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(repoRoot, absolutePath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.relative(repoRoot, absolutePath));
    }
  }

  return files.sort();
}
