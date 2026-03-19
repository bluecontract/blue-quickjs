import dijkstra from 'dijkstrajs';

const graph = {
  start: { parse: 2, hash: 5 },
  parse: { graph: 1, hash: 2 },
  hash: { graph: 2, done: 3 },
  graph: { done: 1 },
  done: {},
};

export default {
  route: dijkstra.find_path(graph, 'start', 'done'),
};
