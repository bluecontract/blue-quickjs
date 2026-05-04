import stableStringify from 'fast-json-stable-stringify';

const payload = {
  zebra: 1,
  alpha: 2,
  nested: {
    gamma: 3,
    beta: 4,
  },
};

export default {
  serialized: stableStringify(payload),
};
