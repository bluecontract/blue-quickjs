import he from 'he';
import { match } from 'path-to-regexp';
import { satisfies } from 'semver';

const version = Host.v1.document.get('consumer/version');
const encoded = Host.v1.document.get('consumer/encoded');
const routePattern = Host.v1.document.get('consumer/route');

const releaseChecks = ['>=1.2.0 <2.0.0', '^1.2.0'].map((range) =>
  satisfies(version, range),
);
const routeMatch = match(routePattern)('/contract/42/release/1.2.3');

const summary = {
  version,
  releaseChecks,
  decoded: he.decode(encoded),
  routeParams: routeMatch?.params ?? null,
};

Host.v1.emit({
  type: 'consumer-proof-summary',
  releaseOk: releaseChecks.every(Boolean),
});

export default summary;
