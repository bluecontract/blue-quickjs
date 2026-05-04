(() => {
  const records = [
    { id: 'a', group: 1 },
    { id: 'b', group: 1 },
    { id: 'c', group: 2 },
    { id: 'd', group: 1 },
  ];
  records.sort((left, right) => left.group - right.group);
  return records.map((record) => record.id);
})();
