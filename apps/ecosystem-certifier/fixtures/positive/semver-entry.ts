import { satisfies, valid } from 'semver';

const version = Host.v1.document.get('text/semver-case');
const ranges = ['>=1.2.0 <2.0.0', '^1.2.0', '~1.2.3'];

export default {
  version,
  valid: valid(version) !== null,
  checks: ranges.map((range) => ({ range, ok: satisfies(version, range) })),
};
