import _ from 'lodash';
import React from 'react';
import { loadFile } from '@/util';
import { Spec } from 'immutability-helper';
import { EditText } from 'react-edit-text';
import { nodeTypes } from '@/engine/node';
import { Node as N, Control as C, Port as P } from '@/engine/types';

function Control({control, onChange}: {
  control: C,
  onChange: (val: any, ev: React.ChangeEvent<HTMLInputElement>) => void}) {
  if (control.type === 'edit-text') {
    return <EditText
      defaultValue={control.value}
      onSave={(ev) => onChange(ev.value, null)} />
  } else {
    return <input
      type={control.type as React.HTMLInputTypeAttribute}
      value={control.value}
      onChange={(ev) => onChange(ev.target.value, ev)} />
  }
}

function Port({id, port, onChange, onClick, type, expired}: {
  id: string,
  port: P,
  type: 'input'|'output',
  expired: boolean,
  onChange: (val: any) => void,
  onClick: () => void}) {
  return port.disabled ? null : <div id={id}
    className={`port port--${port.type}`}>
    <div className="port-pip" onClick={onClick}></div>
    <label>{port.label}</label>
    {(_.isEmpty(port.connections) || type == 'output') && port.control ?
      <Control control={port.control} onChange={onChange} /> :
        (type == 'output' && port.value !== undefined ?
          <span>{port.value}</span>
          : <span className={expired ? 'expired' : ''}>{port.lastValue}</span>)}
  </div>
}

function Node({
  node,
  expired,
  className,
  onChange,
  startConnecting,
  makeConnection,
  updateConnections,
}: {
  node: N,
  expired: boolean,
  className: string,
  onChange: (update: Spec<N>) => void,
  startConnecting: (portId: string) => void,
  makeConnection: (portId: string) => void,
  updateConnections: (node: N) => void,
}) {
  const prevNode = React.useRef(node);
  React.useEffect(() => {
    if (_.isEqual(node, prevNode.current)) return;
    let nodeType = nodeTypes[node.type];
    if (nodeType.onChange) {
      let updated = nodeType.onChange(_.cloneDeep(node));
      prevNode.current = updated;
      onChange({$set: updated});
      updateConnections(updated);
    }
  }, [node]);

  return <div
    data-id={node.id}
    id={`n-${node.id}`}
    className={`node node-${node.type} ${className}`}>
    <div className="node-header">
      <div className="node-label">
        <EditText defaultValue={node.label} onSave={(ev) => {
          onChange({label: {$set: ev.value}});
        }}/>
      </div>
      <div className="node-type">{node.type}</div>
    </div>
    {!_.isEmpty(node.controls) && <div className="node-controls">
      {Object.entries(node.controls).map(([id, c]) => <Control
        key={id}
        control={c}
        onChange={(val, ev) => {
          onChange({controls: {[id]: {value: {$set: val}}}});

          // TODO definitely better way to do this
          if (c.type == 'file') {
            loadFile(ev.target, (text) => {
              // This is ok b/c we check that the control type is 'file'
              onChange({controls: {[id]: {data: {$set: text}}}} as any);
            });
          }
        }}/>)}
    </div>}
    {!_.isEmpty(node.inputs) && <div className="node-inputs ports">
      {Object.entries(node.inputs).map(([id, p]) =>
        <Port key={id}
          port={p}
          type="input"
          id={`n-${node.id}-i-${id}`}
          expired={expired}
          onChange={(val) => {
            onChange({inputs: {[id]: {
              control: {value: {$set: val}}
            }}});
          }}
          onClick={() => {
            makeConnection(id);
          }}/>)}
    </div>}
    {!_.isEmpty(node.outputs) && <div className="node-outputs ports">
      {Object.entries(node.outputs).map(([id, p]) =>
        <Port key={id}
          port={p}
          type="output"
          id={`n-${node.id}-o-${id}`}
          expired={expired}
          onChange={(val) => {
            onChange({outputs: {[id]: {
              control: {value: {$set: val}}
            }}});
          }} onClick={() => {
            startConnecting(id);
          }}/>)}
    </div>}
  </div>
}

export default Node;
