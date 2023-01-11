import _ from 'lodash';
import { nanoid } from 'nanoid';
import { evaluate } from 'mathjs';
import {
  Node, NodeType, Port, PortType,
  NodeData, FileUploadControl,
  PortTypes, ControlData, NodePort,
} from './types';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const VAR_REGEX = /{([0-9A-Za-z_]+)}/g;

export const portTypes: PortTypes = {
  number: {
    dtype: 'number',
  },
  multiNumber: {
    dtype: 'number',
    multi: true,
  },
  boolean: {
    dtype: 'boolean',
  },
  numberInput: {
    dtype: 'number',
    control: {
      type: 'number',
      value: 0,
      step: 1,
    }
  }
}

function defPort(type: keyof typeof portTypes, config: Partial<Exclude<NodePort, 'type'>>) : NodePort {
  return {
    label: type,
    disabled: false,
    ...config,
    type,
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
      number: defPort('numberInput', {label: 'Value'}),
    },
  },
  display: {
    label: 'Display',
    desc: 'Displays a number value.',
    inputs: {
      number: defPort('number', {label: ''}),
    },
  },
  flag: {
    label: 'Flag',
    desc: 'Indicates a boolean value',
    resizable: true,
    inputs: {
      boolean: defPort('boolean', {label: ''}),
    },
    style: (node) => {
      let color = node.inputs.boolean.lastValue ? '#3fc66d' : '#ff4040';
      return {
        background: color,
        borderColor: color
      }
    }
  },
  gate: {
    label: 'Gate',
    desc: 'Return a different value depending on the control value.',
    controls: {
      inputs: {
        type: 'number',
        value: 2,
        min: 2,
        step: 1,
      }
    },
    inputs: {
      control: defPort('numberInput', {label: 'Input Index'}),
      0: defPort('numberInput', {label: '0'}),
      1: defPort('numberInput', {label: '1'}),
    },
    outputs: {
      value: defPort('number', {label: 'Value'})
    },
    onChange: (node) => {
      let n = node.controls.inputs as number;
      [...Array(n).keys()].forEach((i) => {
        let id = i.toString();
        if (!(id in node.inputs)) {
          node.inputs[id] = {
            value: 0,
            type: 'numberInput',
            label: i.toString(),
            connections: []
          }
        }
      });
      return node;
    },
    compute: (nodeData: NodeData) => {
      let idx = nodeData.inputs.control.toString();
      let value = nodeData.inputs[idx] as number;
      return {
        value,
      };
    }
  },

  // TODO
  // also need a "gate" which is like the inverse of a router;
  // multiple values in, one value out based on a control value
  // router: {
  //   label: 'Router',
  //   desc: 'Route input value to different outputs',
  //   // TODO switch on string equals, bool equals, number
  //   // each output port has a matching bool input port
  //   controls: {
  //     ports: {
  //       type: 'number',
  //       value: 2,
  //       min: 2,
  //       step: 1,
  //     }
  //   },
  //   inputs: {
  //     value: portTypes.number,
  //   },
  //   onChange: (node) => {
  //     let n = node.controls.ports as number;
  //     [...Array(n).keys()].forEach((i) => {
  //       if (_.size(node.outputs) < i) {
  //         node.outputs[i] = {
  //           type: 'number',
  //           label: i.toString(),
  //           connections: [],
  //         };
  //         node.inputs[i] = {
  //           type: 'boolean',
  //           label: i.toString(),
  //           connections: []
  //         };
  //       }
  //     });
  //     console.log(node);
  //     return node;
  //   },
  //   compute: (nodeData: NodeData) => {
  //     let results: Record<string, Value> = {};
  //     let value = nodeData.inputs.value as Value;
  //     Object.keys(nodeData.outputs).forEach((id) => {
  //       results[id] = value;
  //     });
  //     return results;
  //   }
  // },
  chart: {
    label: 'Chart',
    desc: 'Simple chart',
    inputs: {
      number: defPort('multiNumber', {label: 'Values'}),
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
    controls: {
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
      left: defPort('number', {label: 'Left'}),
      right: defPort('number', {label: 'Right'}),
    },
    outputs: {
      result: defPort('number', {label: 'Result'})
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
    controls: {
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
      left: defPort('number', {label: 'Left'}),
      right: defPort('number', {label: 'Right'}),
    },
    outputs: {
      result: defPort('boolean', {label: 'Result'})
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
    controls: {
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
      number: defPort('multiNumber', {label: 'Values'}),
    },
    outputs: {
      result: defPort('number', {label: 'Result'})
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
      result: defPort('number', {label: 'Result'})
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

function initPorts(pTypes: Record<string, NodePort>) : Record<string, Port> {
  let ports: Record<string, Port> = {};
  Object.entries(pTypes).forEach(([id, portSpec]) => {
    // TODO
    let pType: PortType = portTypes[portSpec.type as keyof typeof portTypes];
    ports[id] = {
      connections: [],
      type: portSpec.type,
      label: portSpec.label,
      value: pType.control ? pType.control.value : undefined,
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
    inputs: initPorts(type.inputs || {}),
    outputs: initPorts(type.outputs || {}),
    controls: controls,
    comments: null,
  }
}
