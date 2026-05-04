import camelCase from 'camelcase';

const samples = ['hello-world', 'blue_quickjs', 'deterministic vm'];

export default {
  values: samples.map((sample) => camelCase(sample)),
};
