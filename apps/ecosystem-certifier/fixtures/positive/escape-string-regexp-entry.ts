import escapeStringRegexp from 'escape-string-regexp';

const raw = Host.v1.document.get('text/path-case');

export default {
  escaped: escapeStringRegexp(raw),
};
