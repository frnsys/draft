import { Md5 } from 'ts-md5';
import { nodeTypes, portTypes } from './node';
import { Node, Graph, Value, Results } from './types';

// Check that graph has no cycles
// and all inputs for all nodes are satisfied (either with a control or with a connection)
export function validate(graph: Graph) {
  return !hasCycles(graph) && Object.values(graph).every((n) => nodeSatisfied(n));
}

function hasCycles(graph: Graph) {
  // TODO walk through the graph, if any ids show up after being seen once, we have a cycle
  return false;
}

// Check that node inputs have either a control or a connection
function nodeSatisfied(node: Node) {
  return Object.entries(node.inputs).every(([_pId, inp]) => {
    let pType = portTypes[inp.type];
    return inp.connections.length > 0 || pType.control;
  });
}

// Check that all nodes have all inputs satisfied
function nodeReady(node: Node, computed: Record<string, Results>) {
  return Object.entries(node.inputs).every(([_pId, inp]) => {
    let pType = portTypes[inp.type];

    // Must either have a connection or a control
    // If a connection, check that we have data for it
    if (inp.connections.length > 0) {
      return inp.connections.every(([nId, pId]) => nId in computed && computed[nId][pId] !== undefined);
    } else if (pType.control) {
      return true;
    } else {
      return false;
    }
  });
}

// Compute all values in the graph
// Returns the graph where all ports' `lastValue`s are updated
export function compute(graph: Record<string, Node>) {
  if (!validate(graph)) {
    throw new Error('Graph is invalid');
  }

  const fringe: string[] = [];

  // Find the root nodes (any orphans)
  Object.values(graph).forEach((n) => {
    // No parents
    if (Object.values(n.inputs).every((inp) => inp.connections.length === 0)) {
      fringe.push(n.id);
    }
  });

  // Node output results
  const results: Record<string, Results> = {};
  while (fringe.length > 0) {
    let nId = fringe.shift();
    let n = graph[nId];

    // If node inputs aren't ready, push to compute later
    // TODO there is probably a more efficient way to do this by tracking dependencies?
    if (!nodeReady(n, results)) {
      fringe.push(n.id);
      continue;
    }

    let {outputs} = processNode(n, results);
    results[n.id] = outputs;
    Object.values(n.outputs).forEach((out) => {
      for (const [nId, _] of out.connections) {
        if (!fringe.includes(nId)) {
          fringe.push(nId);
        }
      }
    });
  }

  return graph;
}

export function graphHash(graph: Record<string, Node>) {
  return Md5.hashStr(JSON.stringify(graph));
}

function processNode(node: Node, computed: Record<string, Results>) {
  let nType = nodeTypes[node.type];

  // Get all input and control values,
  // and prepare/compute outputs
  let inputs: Record<string, Value|Value[]> = {};
  Object.entries(node.inputs).forEach(([id, inp]) => {
    let pType = portTypes[inp.type];
    if (inp.connections.length > 0) {
      if (pType.multi) {
        inputs[id] = inp.connections.map(([nId, pId]) => computed[nId][pId]);
      } else {
        let [nId, pId] = inp.connections[0];
        inputs[id] = computed[nId][pId];
      }
    } else if (pType.control) {
      inputs[id] = inp.value;
    } else {
      inputs[id] = undefined;
    }
    inp.lastValue = inputs[id];
  });

  let controls = node.controls;

  let outputs: Results = {};
  Object.entries(node.outputs).forEach(([id, out]) => {
    outputs[id] = out.value;
    // let pType = portTypes[out.type];
    // if (pType.control) {
    //   outputs[id] = out.control.value;
    // } else if (out.value !== undefined) {
    //   outputs[id] = out.value;
    // } else {
    //   outputs[id] = null;
    // }
  });

  if (nType.compute) {
    outputs = nType.compute({inputs, controls, outputs});
  }
  Object.entries(outputs).forEach(([id, val]) => {
    node.outputs[id].lastValue = val;
  });

  return {inputs, outputs, controls};
}
