import LinkifyIt from 'linkify-it';

const parser = new LinkifyIt();
const value = Host.v1.document.get('text/markdown-case');
const links = parser.match(value) ?? [];

export default {
  linkCount: links.length,
  urls: links.map((item) => item.url),
};
