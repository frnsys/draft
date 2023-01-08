export type Value = number|string;
export type Results = Record<string, Value>;
export type NodeData = {
  inputs: Record<string, Value|Value[]>,
  outputs: Results,
  controls: Results,
}

export type Graph = Record<string, Node>;

// Node id, port id
export type PortAddress = [string, string];

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

export interface NodeType {
  label: string,
  desc: string,
  resizable?: boolean,
  inputs?: Record<string, PortType>,
  outputs?: Record<string, PortType>,
  controls?: Record<string, Control>,
  compute?: (nodeData: NodeData) => Results,
  onChange?: (node: Node) => Node,
}

export interface Node {
  id: string,
  type: string,
  label: string,
  inputs: Record<string, Port>,
  outputs: Record<string, Port>,
  controls: Record<string, Control>,
}

export type RangeControl = {
  type: 'range',
  step: number,
  min: number,
  max: number,
  value: number,
}
export type NumberControl = {
  type: 'number',
  step: number,
  value: number,
}
export type TextControl = {
  type: 'text',
  value: string,
}
export type EditTextControl = {
  type: 'edit-text',
  value: string,
}
export type FileUploadControl = {
  type: 'file',
  value: string,
  data?: string,
}
export type Control =
  RangeControl|NumberControl|TextControl|EditTextControl|FileUploadControl;