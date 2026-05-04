import { satisfies } from 'semver';
import corpus from '../../src/shared/fixtures/stress-corpus.generated.json';

const firstDoc = corpus.markdownDocs[0]?.id ?? null;
const semverPasses = corpus.semverChecks.filter((entry) =>
  satisfies(entry.version, entry.range),
).length;
const sortedNumeric = [...corpus.numericWork].sort(
  (left, right) => left - right,
);

export default {
  seed: corpus.seed,
  docs: corpus.markdownDocs.length,
  firstDoc,
  semverPasses,
  numericMin: sortedNumeric[0],
  numericMax: sortedNumeric[sortedNumeric.length - 1],
  numericMedian: sortedNumeric[Math.floor(sortedNumeric.length / 2)],
};
