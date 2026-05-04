import { match } from 'path-to-regexp';

const pattern = Host.v1.document.get('text/path-case');
const matcher = match(pattern);
const matched = matcher('/document/42/version/1.2.3');

export default {
  matched: Boolean(matched),
  params: matched?.params ?? null,
};
