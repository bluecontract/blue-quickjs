import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  linkify: true,
});
const source = Host.v1.document.get('text/markdown-case');
const tokens = md.parse(source, {});
const links = md.render(source).match(/<a /g)?.length ?? 0;

export default {
  tokenTypes: tokens.slice(0, 6).map((token) => token.type),
  tokenCount: tokens.length,
  linkCount: links,
};
