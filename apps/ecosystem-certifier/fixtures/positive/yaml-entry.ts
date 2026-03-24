import { parse } from 'yaml';

const text = Host.v1.document.get('text/yaml-case');
const parsed = parse(text) as { name: string; value: number };

export default {
  keys: Object.keys(parsed).sort(),
  name: parsed.name,
  value: parsed.value,
};
