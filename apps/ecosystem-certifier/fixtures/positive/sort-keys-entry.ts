import sortKeys from 'sort-keys';

const payload = {
  zeta: 4,
  alpha: 1,
  gamma: 3,
  beta: 2,
};

export default {
  sorted: sortKeys(payload),
  keys: Object.keys(sortKeys(payload)),
};
