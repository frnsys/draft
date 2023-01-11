import _ from 'lodash';
import React from 'react';
import Control from './Control';
import { Spec } from 'immutability-helper';
import { EditText, EditTextarea } from 'react-edit-text';
import { nodeTypes, portTypes } from '@/engine/node';
import { PortControl, Control as C, Node as N, Port as P, Value } from '@/engine/types';

function fmtValue(value: Value|Value[]) {
  if (_.isArray(value)) {
    if (value.length > 1) {
      return `[${value[0]},...]`;
    } else {
      return `[${value[0]}]`;
    }
  } else {
    return value;
  }
}

function Port({id, port, control, onChange, onClick, type, expired}: {
  id: string,
  port: P,
  type: 'input'|'output',
  expired: boolean,
  control: PortControl,
  onChange: (value: PortControl['value']) => void,
  onClick: () => void}) {
  return port.disabled ? null : <div id={id}
    className={`port port--${port.type}`}>
    <div className="port-pip" onClick={onClick}></div>
    <label>{port.label}</label>
    {(_.isEmpty(port.connections) || type == 'output') && control ?
      <Control control={control}
        value={port.value as typeof control['value']}
        onChange={onChange} /> :
        (type == 'output' && port.value !== undefined ?
          <span className="port-value">{port.value}</span>
          : <span className={`port-value ${expired ? 'expired' : ''}`}>{fmtValue(port.lastValue)}</span>)}
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

  let nodeType = nodeTypes[node.type];
  let style = {};
  if (_.isFunction(nodeType.style)) {
    style = nodeType.style(node);
  } else if (_.isObject(nodeType.style)) {
    style = nodeType.style;
  }

  return <div
    data-id={node.id}
    id={`n-${node.id}`}
    style={style}
    className={`node node-${node.type} ${className}`}>
    <div className="node-header">
      <div className="node-label">
        <EditText defaultValue={node.label} onSave={(ev) => {
          onChange({label: {$set: ev.value}});
        }}/>
      </div>
      <div className="node-type">{node.type}</div>
    </div>
    {nodeType.render && nodeType.render(node)}
    {!_.isEmpty(node.controls) && <div className="node-controls">
      {Object.entries(node.controls).map(([id, c]) => <Control
        key={id}
        value={c}
        control={nodeType.controls[id]}
        onChange={(value) => {
          onChange({controls: {[id]: {$set: value}}});
        }} />)}
    </div>}
    {!_.isEmpty(node.inputs) && <div className="node-inputs ports">
      {Object.entries(node.inputs).map(([id, p]) => {
        let pType = portTypes[p.type];
        return <Port key={id}
          port={p}
          type="input"
          control={pType.control}
          id={`n-${node.id}-i-${id}`}
          expired={expired}
          onChange={(value) => {
            onChange({inputs: {[id]: {value: {$set: value}}}});
          }}
          onClick={() => {
            makeConnection(id);
          }}/>
      })}
    </div>}
    {!_.isEmpty(node.outputs) && <div className="node-outputs ports">
      {Object.entries(node.outputs).map(([id, p]) => {
        let pType = portTypes[p.type];
        return <Port key={id}
          port={p}
          type="output"
          control={pType.control}
          id={`n-${node.id}-o-${id}`}
          expired={expired}
          onChange={(value) => {
            onChange({outputs: {[id]: {value: {$set: value}}}});
          }} onClick={() => {
            startConnecting(id);
          }}/>
      })}
    </div>}
    {!_.isNil(node.comments) && <div className="node-comments">
      <EditTextarea
        defaultValue={node.comments}
        placeholder="Comments"
        rows={'auto' as any}
        onSave={(ev) => {
          let text = ev.value;
          if (text.length === 0) {
            onChange({comments: {$set: null}});
          } else {
            onChange({comments: {$set: text}});
          }
        }} />
      </div>}
  </div>
}

export default Node;
