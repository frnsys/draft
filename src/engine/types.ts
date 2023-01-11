import React from 'react';

export type Value = number|string|boolean;
export type Results = Record<string, Value>;
export type ControlData = Record<string, Control['value']>;
export type NodeData = {
  inputs: Record<string, Value|Value[]>,
  outputs: Results,
  controls: ControlData,
}

export type Graph = Record<string, Node>;

// Node id, port id
export type PortAddress = [string, string];

export type PortTypes = Record<string, PortType>;

export interface PortType {
  dtype: string,
  multi?: boolean,
  control?: PortControl,
}

export interface NodePort {
  type: keyof PortTypes,
  label: string,
  disabled?: boolean,
}

export interface Port extends NodePort {
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
  inputs?: Record<string, NodePort>,
  outputs?: Record<string, NodePort>,
  controls?: Record<string, Control>,
  compute?: (nodeData: NodeData) => Results,
  onChange?: (node: Node) => Node,
  style?: React.CSSProperties|((node: Node) => React.CSSProperties),
  render?: (node: Node) => JSX.Element
}

export interface Node {
  id: string,
  type: string,
  label: string,
  inputs: Record<string, Port>,
  outputs: Record<string, Port>,
  controls: ControlData,
  comments: string|null,
  // state: Record<string, Value>,
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
  min?: number,
  max?: number,
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
  value?: {
    file: string,
    data: string,
  },
}
export type SelectControl = {
  type: 'select',
  value: string,
  options: {
    label: string,
    value: string,
  }[],
}

export type Control =
  RangeControl|NumberControl|TextControl|EditTextControl|FileUploadControl|SelectControl;

export type PortControl =
  RangeControl|NumberControl|SelectControl;