import { Graph } from 'graphlib';

const graph = new Graph({ directed: true });
graph.setNode('a');
graph.setNode('b');
graph.setEdge('a', 'b');

export default graph.edgeCount();
