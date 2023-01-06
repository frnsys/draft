import _ from 'lodash';
import React from 'react';
import N, { Control as C, Port as P, nodeTypes } from '@/engine/Node';
import { Spec } from 'immutability-helper';
import { EditText } from 'react-edit-text';

// Load a file from the specified input and read its data,
// then execute the provided callback with the data
function loadFile(input: HTMLInputElement, cb: (text: string | ArrayBuffer) => void) {
  if ('files' in input && input.files.length > 0) {
    let file = input.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target.result;
      cb(text);
    };
    reader.onerror = (err) => console.log(err);
    reader.readAsText(file);
  }
}

function Control({control, onChange}: {control: C, onChange: (val: any, ev: React.ChangeEvent<HTMLInputElement>) => void}) {
  // TODO use other attrs too
  // TODO ensure props.type is React.HTMLInputTypeAttribute
  if (control.type === 'edit-text') {
    return <EditText defaultValue={control.value} onSave={(ev) => {
      onChange(ev.value, null);
    }}/>
  } else {
    return <input type={control.type as any}
      value={control.value}
      onChange={(ev) => {
        onChange(ev.target.value, ev);
      }} />
  }
}

function Port({id, port, onChange, onClick, type, expired}: {
  id: string,
  port: P,
  type: 'input'|'output',
  expired: boolean,
  onChange: (val: any) => void,
  onClick: () => void}) {
  return port.disabled ? null : <div id={id} className={`port port--${port.type}`}>
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
  position: pos,
  onMove,
  onChange,
  startConnecting,
  makeConnection,
  updateConnections,
}: {
  node: N,
  position: {x: number, y: number},
  expired: boolean,
  onChange: (update: Spec<N>) => void,
  onMove: (pos: {x: number, y: number}) => void,
  startConnecting: (portId: string) => void,
  makeConnection: (portId: string) => void,
  updateConnections: (node: N) => void,
}) {
  // Dragging/moving nodes
  const ref = React.useRef<HTMLDivElement>();
  const position = React.useRef({x: 0, y: 0, pos});
  const [isDragging, setIsDragging] = React.useState(false);
  const onMouseDown = (ev: React.MouseEvent) => {
    // Only respond to left-click
    if (ev.button !== 0) return;

    // Ignore if port pip is clicked
    if ((ev.target as HTMLElement).className == 'port-pip') return;

    // Ignore if input is clicked
    if ((ev.target as HTMLElement).tagName == 'INPUT') return;

    position.current.x = ev.clientX;
    position.current.y = ev.clientY;
    setIsDragging(true);
  }
  const onMouseUp = () => {
    setIsDragging(false);
    onMove(position.current.pos);
  }
  React.useEffect(() => {
    if (isDragging) {
      const onMouseMove = (ev: MouseEvent) => {
        let pos = position.current;
        const dx = ev.clientX - pos.x;
        const dy = ev.clientY - pos.y;
        pos.y += dy;
        pos.x += dx;
        pos.pos.y += dy;
        pos.pos.x += dx;
        ref.current.style.transform = `translate(${pos.pos.x}px, ${pos.pos.y}px)`;
        updateConnections(node);
      }
      document.addEventListener('mousemove', onMouseMove);
      return () => document.removeEventListener('mousemove', onMouseMove);
    }
  }, [isDragging, node]);

  const style: React.CSSProperties = isDragging ? {
    cursor: 'all-scroll',
    WebkitUserSelect: 'none'
  } : {};

  React.useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

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

  return <div className={`node node-${node.type}`} id={`n-${node.id}`} ref={ref}
    onMouseDown={onMouseDown}
    style={{...style, transform: `translate(${position.current.pos.x}px, ${position.current.pos.y}px)`}}>
    <div className="node-header">
      <div className="node-label">
        <EditText defaultValue={node.label} onSave={(ev) => {
          onChange({label: {$set: ev.value}});
        }}/>
      </div>
      <div className="node-type">{node.type}</div>
    </div>
    {!_.isEmpty(node.controls) && <div className="node-controls">
      {Object.entries(node.controls).map(([id, c]) => <Control key={id} control={c} onChange={(val, ev) => {
        onChange({controls: {[id]: {value: {$set: val}}}});

        // TODO definitely better way to do this
        if (c.type == 'file') {
          loadFile(ev.target, (text) => {
            // This is ok b/c we check that the control type is 'file'
            onChange({controls: {[id]: {data: {$set: text}}}} as any);
            // console.log(text);
            // let json = JSON.parse(text);
          });
        }

      }}/>)}
    </div>}
    {!_.isEmpty(node.inputs) && <div className="node-inputs ports">
      {Object.entries(node.inputs).map(([id, p]) => <Port key={id} id={`n-${node.id}-i-${id}`} expired={expired} port={p} type="input" onChange={(val) => {
        onChange({inputs: {[id]: {
          control: {value: {$set: val}}
        }}});
      }} onClick={() => {
        makeConnection(id);
      }}/>)}
    </div>}
    {!_.isEmpty(node.outputs) && <div className="node-outputs ports">
      {Object.entries(node.outputs).map(([id, p]) => <Port key={id} id={`n-${node.id}-o-${id}`} expired={expired} port={p} type="output" onChange={(val) => {
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
