import _ from 'lodash';
import { nanoid } from 'nanoid';
import { evaluate } from 'mathjs';
import {
  Node, NodeType, Port, PortType,
  NodeData, FileUploadControl
} from './types';

const VAR_REGEX = /{([0-9A-Za-z_]+)}/g;

export const nodeTypes: Record<string, NodeType> = {
  comment: {
    label: 'Comment',
    desc: 'A comment node.',
    resizable: true,
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
