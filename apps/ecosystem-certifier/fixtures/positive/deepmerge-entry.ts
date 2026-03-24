import merge from 'deepmerge';

const left = {
  release: {
    consensus: true,
    executors: ['wasm-node'],
  },
};
const right = {
  release: {
    executors: ['wasm-browser'],
    profiles: ['compat-general-v1'],
  },
};

export default merge(left, right);
