import sortBy from 'lodash-es/sortBy.js';

const findings = [
  { id: 'b', score: 2 },
  { id: 'a', score: 1 },
  { id: 'c', score: 2 },
];

export default {
  orderedIds: sortBy(findings, ['score', 'id']).map((item) => item.id),
};
