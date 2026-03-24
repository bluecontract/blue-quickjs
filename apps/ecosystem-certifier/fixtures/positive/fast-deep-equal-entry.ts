import deepEqual from 'fast-deep-equal';

const left = {
  id: 'deterministic',
  values: [1, 2, 3],
  nested: { ok: true },
};
const right = JSON.parse(JSON.stringify(left));

export default {
  equal: deepEqual(left, right),
};
