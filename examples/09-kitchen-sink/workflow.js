export async function summarize(path, canonical) {
  const queue = [];
  queueMicrotask(() => queue.push('micro'));
  await Promise.resolve();
  const records = [
    { id: 'b', rank: 2 },
    { id: 'a', rank: 1 },
    { id: 'c', rank: 2 },
  ];
  records.sort((left, right) => left.rank - right.rank);
  return {
    path,
    canonical,
    order: records.map((record) => record.id).join(','),
    queue: queue.join(','),
  };
}
