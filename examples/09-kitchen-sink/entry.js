import { summarize } from './workflow.js';

export default (async () => {
  const doc = document('path/to/doc');
  const canonical = document.canonical('path/to/doc');
  const result = await summarize(doc.path, canonical.canonical);
  Host.v1.emit({ kind: 'kitchen', result });
  return result;
})();
