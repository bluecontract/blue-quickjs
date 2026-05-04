import decamelize from 'decamelize';

const samples = ['deterministicRuntime', 'gasVersionPin', 'hostCallTape'];

export default {
  values: samples.map((sample) => decamelize(sample)),
};
