import TinyQueue from 'tinyqueue';

const queue = new TinyQueue(
  [],
  (left, right) => left.priority - right.priority,
);
queue.push({ id: 'b', priority: 2 });
queue.push({ id: 'a', priority: 1 });
queue.push({ id: 'c', priority: 3 });

const ordered = [];
while (queue.length > 0) {
  ordered.push(queue.pop().id);
}

export default {
  ordered,
};
