import queryString from 'query-string';

const query = 'profile=compat-general-v1&gasVersion=8&checks=parity&checks=oog';
const parsed = queryString.parse(query);
const stringified = queryString.stringify(parsed, { arrayFormat: 'none' });

export default {
  parsed,
  stringified,
};
