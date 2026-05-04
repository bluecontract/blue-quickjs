import { closest, distance } from 'fastest-levenshtein';

const dictionary = [
  'consensus',
  'determinism',
  'compatibility',
  'gas-metering',
];
const target = 'deterministic';

export default {
  target,
  closest: closest(target, dictionary),
  distances: dictionary.map((entry) => ({
    entry,
    value: distance(target, entry),
  })),
};
