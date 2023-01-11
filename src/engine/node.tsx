import _ from 'lodash';
import { nanoid } from 'nanoid';
import { evaluate } from 'mathjs';
import {
  Node, NodeType, Port, PortType,
  NodeData, FileUploadControl,
  ControlData
} from './types';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const VAR_REGEX = /{([0-9A-Za-z_]+)}/g;

export const portTypes: Record<string, PortType> = {
  number: {
    type: 'number',
    label: 'Number',
  },
  numberInput: {
    type: 'number',
    label: 'Number',
    control: {
      type: 'number',
      value: 0,
      step: 1,
    }
  }
}

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
  flag: {
    label: 'Flag',
    desc: 'Indicates a boolean value',
    resizable: true,
    inputs: {
      boolean: {
        type: 'boolean',
        label: '',
      }
    },
    style: (node) => {
      let color = node.inputs.boolean.lastValue ? '#3fc66d' : '#ff4040';
      return {
        background: color,
        borderColor: color
      }
    }
  },
  chart: {
    label: 'Chart',
    desc: 'Simple chart',
    inputs: {
      number: {
        type: 'number',
        label: 'Values',
        multi: true,
      }
    },
    render(node) {
      // TODO better type handling
      let values = (node.inputs.number.lastValue || []) as number[];
      let data = values.map((val, i) => ({
        name: node.inputs.number.connections[i][1],
        value: val,
      }));
      let barWidth = 20;
      let width = barWidth * values.length;
      return <BarChart width={width} height={250} data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#8884d8" />
      </BarChart>
    }
  },
  arithmetic: {
    label: 'Arithmetic',
    desc: 'Simple arithmetic',
    controls:  {
      op: {
        type: 'select',
        options: [{
          label: '+',
          value: '+',
        }, {
          label: '-',
          value: '-',
        }, {
          label: '/',
          value: '/',
        }, {
          label: '*',
          value: '*',
        }],
        value: '+'
      }
    },
    inputs: {
      left: {
        type: 'number',
        label: 'Left',
      },
      right: {
        type: 'number',
        label: 'Right',
      }
    },
    outputs: {
      result: {
        type: 'number',
        label: 'Result'
      }
    },
    compute: (nodeData: NodeData) => {
      // TODO better type handling
      let l = nodeData.inputs.left as number;
      let r = nodeData.inputs.right as number;
      switch (nodeData.controls.op) {
        case '+':
          return {result: l + r}
        case '-':
          return {result: l - r}
        case '*':
          return {result: l * r}
        case '/':
          return {result: l / r}
      }
    }
  },
  comparison: {
    label: 'Comparison',
    desc: 'Compares two numerical values',
    controls:  {
      op: {
        type: 'select',
        options: [{
          label: '==',
          value: 'eq',
        }, {
          label: '~=',
          value: 'aeq',
        }, {
          label: '!=',
          value: 'neq',
        }, {
          label: '>',
          value: 'gt',
        }, {
          label: '>=',
          value: 'geq',
        }, {
          label: '<',
          value: 'lt',
        }, {
          label: '<=',
          value: 'leq',
        }],
        value: 'eq'
      }
    },
    inputs: {
      left: {
        type: 'number',
        label: 'Left',
      },
      right: {
        type: 'number',
        label: 'Right',
      }
    },
    outputs: {
      result: {
        type: 'boolean',
        label: 'Result'
      }
    },
    compute: (nodeData: NodeData) => {
      // TODO better type handling
      let l = nodeData.inputs.left as number;
      let r = nodeData.inputs.right as number;
      switch (nodeData.controls.op) {
        case 'eq':
          return {result: l == r}
        case 'aeq':
          return {result: Math.abs(l - r) < 0.1}
        case 'neq':
          return {result: l != r}
        case 'gt':
          return {result: l > r}
        case 'geq':
          return {result: l >= r}
        case 'lt':
          return {result: l < r}
        case 'leq':
          return {result: l <= r}
      }
    }
  },
  reduce: {
    label: 'Reduce',
    desc: 'Reduces numerical inputs',
    controls:  {
      op: {
        type: 'select',
        options: [{
          label: 'Sum',
          value: 'sum',
        }, {
          label: 'Product',
          value: 'prod',
        }],
        value: 'sum'
      }
    },
    inputs: {
      number: {
        type: 'number',
        label: 'Values',
        multi: true,
      }
    },
    outputs: {
      result: {
        type: 'number',
        label: 'Result',
      }
    },
    compute: (nodeData: NodeData) => {
      // TODO better type handling here
      let values = nodeData.inputs.number as number[];
      switch (nodeData.controls.op) {
        case 'sum':
          return {
            result: _.sum(values)
          }
        case 'prod':
          return {
            result: values.reduce((acc, val) => acc * val, 1)
          }
      }
    }
  },
  json: {
    label: 'JSON',
    desc: 'For uploading JSON data.',
    controls: {
      file: {
        type: 'file',
      }
    },
    onChange: (node) => {
      let {data} = node.controls.file as FileUploadControl['value'];
      if (data) {
        try {
          let json = JSON.parse(data);
          let vars = Object.keys(json);
          vars.forEach((v) => {
            let id = _.kebabCase(v);
            if (!(id in node.outputs)) {
              node.outputs[id] = {
                type: 'number',
                label: v,
                value: json[v],
                connections: [],
              };
            }
          });
          Object.entries(node.outputs).forEach(([_id, out]) => {
            out.disabled = !vars.includes(out.label);
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
      let expr = node.controls.expression as string;
      const vars = [...expr.matchAll(VAR_REGEX)].map((m) => m[1]);
      vars.forEach((v) => {
        if (!(v in node.inputs)) {
          node.inputs[v] = {
            type: 'numberInput',
            label: v,
            connections: [],
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
      connections: [],
      type: portType.type,
      label: portType.label,
      value: portType.control ? portType.control.value : undefined,
    }
  });
  return ports;
}

export function newNode(typeId: keyof typeof nodeTypes) : Node {
  const type = nodeTypes[typeId];
  const controls: ControlData = {};
  Object.entries(type.controls || {}).forEach(([id, ctrl]) => {
    controls[id] = ctrl.value;
  });
  return {
    id: nanoid(),
    type: typeId,
    label: type.label,
    inputs: newPorts(type.inputs || {}),
    outputs: newPorts(type.outputs || {}),
    controls: controls,
    comments: null,
  }
}
