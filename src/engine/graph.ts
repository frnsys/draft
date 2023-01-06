import { Md5 } from 'ts-md5';
import { nodeTypes } from './node';
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
  return Object.values(node.inputs).every((inp) => {
    return inp.connections.length > 0 || inp.control;
  });
}

// Check that all nodes have all inputs satisfied
function nodeReady(node: Node, computed: Record<string, Results>) {
  return Object.values(node.inputs).every((inp) => {
    // Must either have a connection or a control
    // If a connection, check that we have data for it
    if (inp.connections.length > 0) {
      return inp.connections.every(([nId, pId]) => nId in computed && computed[nId][pId] !== undefined);
    } else if (inp.control) {
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

  const fringe: Node[] = [];

  // Find the root nodes (any orphans)
  Object.values(graph).forEach((n) => {
    // No parents
    if (Object.values(n.inputs).every((inp) => inp.connections.length === 0)) {
      fringe.push(n);
    }
  });

  // Node output results
  const results: Record<string, Results> = {};
  while (fringe.length > 0) {
    let n = fringe.pop();

    // If node inputs aren't ready, push to compute later
    // TODO there is probably a more efficient way to do this by tracking dependencies?
    if (!nodeReady(n, results)) {
      fringe.push(n);
      continue;
    }

    let {outputs} = processNode(n, results);
    results[n.id] = outputs;
    Object.values(n.outputs).forEach((out) => {
      for (const [nId, _] of out.connections) {
        fringe.push(graph[nId]);
      }
    });
  }

  console.log(results);

  return graph;
}

export function graphHash(graph: Record<string, Node>) {
  return Md5.hashStr(JSON.stringify(graph));
}

function processNode(node: Node, computed: Record<string, Results>) {
  // Get all input and control values,
  // and prepare/compute outputs
  let inputs: Record<string, Value|Value[]> = {};
  Object.entries(node.inputs).forEach(([id, inp]) => {
    if (inp.connections.length > 0) {
      if (inp.multi) {
        inputs[id] = inp.connections.map(([nId, pId]) => computed[nId][pId]);
      } else {
        let [nId, pId] = inp.connections[0];
        inputs[id] = computed[nId][pId];
      }
    } else if (inp.control) {
      inputs[id] = inp.control.value;
    } else {
      inputs[id] = undefined;
    }
    inp.lastValue = inputs[id];
  });

  let controls: Results = {};
  Object.entries(node.controls).forEach(([id, ctrl]) => {
    controls[id] = ctrl.value;
  });

  let outputs: Results = {};
  Object.entries(node.outputs).forEach(([id, out]) => {
    if (out.control) {
      outputs[id] = out.control.value;
    } else if (out.value !== undefined) {
      outputs[id] = out.value;
    } else {
      outputs[id] = null;
    }
  });

  let nType = nodeTypes[node.type];
  if (nType.compute) {
    outputs = nType.compute({inputs, controls, outputs});
  }
  Object.entries(outputs).forEach(([id, val]) => {
    node.outputs[id].lastValue = val;
  });

  return {inputs, outputs, controls};
}
