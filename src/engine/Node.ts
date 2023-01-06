import _ from 'lodash';
import { Md5 } from 'ts-md5';
import { nanoid } from 'nanoid';
import { evaluate } from 'mathjs';

const VAR_REGEX = /{([0-9A-Za-z_]+)}/g;

type Value = number|string;

type RangeControl = {
  type: 'range',
  step: number,
  min: number,
  max: number,
  value: number,
}
type NumberControl = {
  type: 'number',
  step: number,
  value: number,
}
type TextControl = {
  type: 'text',
  value: string,
}
type EditTextControl = {
  type: 'edit-text',
  value: string,
}
type FileUploadControl = {
  type: 'file',
  value: string,
  data?: string,
}
export type Control = RangeControl|NumberControl|TextControl|EditTextControl|FileUploadControl;

export interface PortType {
  type: string,
  label: string,
  multi?: boolean,
  control?: Control,
}

export interface Port extends PortType {
  disabled?: boolean,
  connections: PortAddress[],

  // Holds a fixed value,
  // used as last resort if not undefined
  value?: Value,

  // Holds the last computed value
  lastValue?: Value|Value[],
}

// export interface SinglePort extends Port {
//   multi: false,
//   lastValue?: Value,
// }

// export interface MultiPort extends Port {
//   multi: true,
//   lastValue?: Value[],
// }

type Results = Record<string, Value>;
type NodeData = {
  inputs: Record<string, Value|Value[]>,
  outputs: Results,
  controls: Results,
}

interface NodeType {
  label: string,
  desc: string,
  inputs?: Record<string, PortType>,
  outputs?: Record<string, PortType>,
  controls?: Record<string, Control>,
  compute?: (nodeData: NodeData) => Results,
  onChange?: (node: Node) => Node,
}

// Node id, port id
export type PortAddress = [string, string];

interface Node {
  id: string,
  type: string,
  label: string,
  inputs: Record<string, Port>,
  outputs: Record<string, Port>,
  controls: Record<string, Control>,
}

export const nodeTypes: Record<string, NodeType> = {
  comment: {
    label: 'Comment',
    desc: 'A comment node.',
    controls: {
      comment: {
        type: 'edit-text',
        value: 'Comment',
      }
    }
  },
  number: {
    label: 'Number',
    desc: 'A simple number node.',
    outputs: {
      number: {
        type: 'number',
        label: 'Number',
        control: {
          type: 'number',
          value: 0,
          step: 1,
        }
      }
    },
  },
  display: {
    label: 'Display',
    desc: 'Displays a number value.',
    inputs: {
      number: {
        type: 'number',
        label: '',
      }
    },
  },
  json: {
    label: 'JSON',
    desc: 'For uploading JSON data.',
    controls: {
      file: {
        type: 'file',
        value: '',
      }
    },
    onChange: (node) => {
      let data = (node.controls.file as FileUploadControl).data;
      if (data) {
        try {
          let json = JSON.parse(data);
          let vars = Object.keys(json);
          vars.forEach((v) => {
            if (!(v in node.outputs)) {
              node.outputs[v] = {
                type: 'number',
                label: v,
                value: json[v],
                connections: [],
              };
            }
          });
          Object.entries(node.outputs).forEach(([id, inp]) => {
            inp.disabled = !vars.includes(id);
          });

        } catch {
          // TODO what to do? how to propagate error?
        }
      }
      return node;
    }
  },
  expression: {
    label: 'Expression',
    desc: 'Dynamic math expression.',
    outputs: {
      result: {
        type: 'number',
        label: 'Result',
      }
    },
    controls: {
      expression: {
        type: 'text',
        value: '1+1',
      }
    },
    onChange: (node) => {
      let expr = node.controls.expression.value as string;
      const vars = [...expr.matchAll(VAR_REGEX)].map((m) => m[1]);
      vars.forEach((v) => {
        if (!(v in node.inputs)) {
          node.inputs[v] = {
            type: 'number',
            label: v,
            connections: [],
            control: {
              type: 'number',
              value: 0,
              step: 1,
            }
          };
        }
      });
      Object.entries(node.inputs).forEach(([id, inp]) => {
        inp.disabled = !vars.includes(id);
      });
      return node;
    },
    compute: (nodeData: NodeData) => {
      let expr = nodeData.controls.expression as string;

      [...expr.matchAll(VAR_REGEX)].forEach((m) => {
        expr = expr.replaceAll(m[0], m[1]);
      });
      console.log(expr);
      let result = evaluate(expr, nodeData.inputs);
      if (result === undefined) result = null;
      return {
        result,
      }
    }
  }
};

function newPorts(portTypes: Record<string, PortType>) : Record<string, Port> {
  let ports: Record<string, Port> = {};
  Object.entries(portTypes).forEach(([id, portType]) => {
    ports[id] = {
      ..._.cloneDeep(portType),
      connections: [],
    }
  });
  return ports;
}

export function newNode(typeId: keyof typeof nodeTypes) : Node {
  const type = nodeTypes[typeId];
  return {
    id: nanoid(),
    type: typeId,
    label: type.label,
    inputs: newPorts(type.inputs || {}),
    outputs: newPorts(type.outputs || {}),
    controls: _.cloneDeep(type.controls || {}),
  }
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

// Check that graph has no cycles
// and all inputs for all nodes are satisfied (either with a control or with a connection)
export function validate(graph: Record<string, Node>) {
  return !hasCycles(graph) && Object.values(graph).every((n) => nodeSatisfied(n));
}

function hasCycles(graph: Record<string, Node>) {
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

export default Node;
