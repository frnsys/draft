import _ from 'lodash';
import React from 'react';
import Node from './Node';
import { nanoid } from 'nanoid';
import { getStatus }  from './Status';
import { adjustPosition, getTranslate } from '@/util';
import DraggableView from './DraggableView';
import Connections, { ConnectionsRef } from './Connections';
import ContextMenu, { useContextMenu } from './ContextMenu';
import { newNode, nodeTypes } from '@/engine/node';
import { compute, graphHash } from '@/engine/graph';
import { Node as N, PortAddress } from '@/engine/types';
import update, { Spec } from 'immutability-helper';
import { useDraggable, useKeyBindings, useSelection } from './hooks';

const addNodeOptions = Object.entries(nodeTypes).map(([id, n]) => ({
  id,
  label: n.label,
  desc: n.desc,
}));
const editNodeOptions = [{
  id: 'delete',
  label: 'Delete',
  desc: 'Delete this node.',
}];

type Layout = Record<string, {x: number, y: number, w: number, h: number}>;

function Graph() {
  const [id, setId] = React.useState(nanoid());
  const [nodes, setNodes] = React.useState<Record<string, N>>({});
  const [layout, setLayout] = React.useState<Layout>({});

  const selection = useSelection();

  const nodeRefs = React.useRef<Record<string, HTMLDivElement>>({});

  // Context menu
  const switchFn = (target: HTMLElement, _currentTarget: HTMLElement) => {
    let nodeEl = target.closest('.node') as HTMLElement;
    if (nodeEl) {
      let nodeId = nodeEl.dataset.id;
      let node = nodes[nodeId];
      return {
        options: editNodeOptions,
        onSelect: (optionId: string) => editNode(node, optionId)
      }
    } else if (target.id == 'stage') {
      return {
        options: addNodeOptions,
        onSelect: addNode
      }
    }
  }
  const ctxMenu = useContextMenu(switchFn);

  const ref = React.useRef<HTMLDivElement>(null);
  const addNode = (type: string, position: Point) => {
    let node = newNode(type);
    setLayout((layout) => {
      let pos = adjustPosition(position, ref.current);
      return update(layout, {
        [node.id]: {
          $set: {...layout[node.id], ...pos}
        }
      });
    });
    setNodes((nodes) => {
      return update(nodes, {
        $merge: {[node.id]: node}
      });
    });
  }
  const editNode = (node: N, op: string) => {
    switch (op) {
      case 'delete':
        deleteNode(node);
        break;
    }
  }
  const deleteNode = (node: N) => {
    // First delete connections.
    // The `onDelete` hook we pass to `Connections`
    // will automatically remove the corresponding port connection data
    // on the relevant nodes.
    connections.current.deleteNode(node);
    setNodes((nodes) => {
      return update(nodes, {
        $unset: [node.id],
      });
    });
    setLayout((layout) => {
      return update(layout, {$unset: [node.id]});
    });
  }

  const connections = React.useRef<ConnectionsRef>(null);
  const onDeleteConnection = (fromAddr: PortAddress, toAddr: PortAddress) => {
    let [fromId, fromPortId] = fromAddr;
    let [toId, toPortId] = toAddr;
    setNodes((nodes) => {
      // TODO ugh
      let fromRemIdx = nodes[fromId].outputs[fromPortId].connections.findIndex((addr) => _.isEqual(toAddr, addr));
      let toRemIdx = nodes[toId].inputs[toPortId].connections.findIndex((addr) => _.isEqual(fromAddr, addr));
      return update(nodes, {
        [fromId]: {
          outputs: {
            [fromPortId]: {
              connections: {$splice: [[fromRemIdx, 1]]}
            }
          }
        },
        [toId]: {
          inputs: {
            [toPortId]: {
              connections: {$splice: [[toRemIdx, 1]]}
            }
          }
        }
      });
    });
  };

  useKeyBindings({
    'Escape': () => {
      connections.current.stopConnecting();
    }
  });

  const [hash, setHash] = React.useState(graphHash(nodes));
  const [lastComputedHash, setLastComputedHash] = React.useState(graphHash(nodes));
  React.useEffect(() => setHash(graphHash(nodes)), [nodes]);
  const computeGraph = () => {
    try {
      let updatedNodes = compute(_.cloneDeep(nodes));
      setLastComputedHash(graphHash(updatedNodes));
      setNodes(updatedNodes);
    } catch (err) {
      status.addMessage('error', err.toString());
    }
  };
  const expired = hash !== lastComputedHash;

  const status = getStatus();
  const save = () => {
    let graph = {
      id,
      nodes,
      layout,
      lastComputedHash,
    }
    localStorage.setItem('graph', JSON.stringify(graph));
    status.addMessage('notice', 'Graph saved.', 3);
  };
  React.useEffect(() => {
    let savedData = localStorage.getItem('graph');
    if (savedData && !_.isEmpty(savedData)) {
      let {id, nodes, layout, lastComputedHash} = JSON.parse(savedData);
      setLastComputedHash(lastComputedHash);
      setLayout(layout);
      setNodes(nodes);
      setId(id)
    }
  }, []);
  React.useEffect(() => {
    connections.current.reset();
    Object.values(nodes).forEach((node: N) => {
      connections.current.updateNode(node);
    });
  }, [id]);

  const {style: dragStyle, onMouseDown: dragMouseDown} = useDraggable({
    shouldHandle(ev) {
      let el = ev.target as HTMLElement;

      // Ignore if port pip is clicked
      if (el.className == 'port-pip') return false;

      // Ignore if input is clicked
      if (el.tagName == 'INPUT') return false;

      return true;
    },
    initDragState(ev) {
      let el = ev.currentTarget as HTMLElement;
      let nodeId = el.dataset.id;

      // Ignore if resizing
      let mode = 'move';
      if ((ev.target as HTMLElement).className == 'node-resize-handle') {
        mode = 'resize';
      }
      return {
        nodeId,
        node: nodes[nodeId],
        mode,
      }
    },
    onDrag(delta, {nodeId, mode}) {
      if (mode == 'move') {
        moveNode(delta);
        selection.selected.current.forEach((nId) => {
          connections.current.updateNode(nodes[nId]);
        });
      } else if (mode == 'resize') {
        let rect = ref.current.getBoundingClientRect();
        let scale = rect.width/ref.current.offsetWidth;
        let nRef = nodeRefs.current[nodeId];
        nRef.style.maxWidth = `${nRef.offsetWidth + delta.dx/scale}px`;
        // nRef.style.minHeight = `${nRef.offsetHeight + delta.dy/scale}px`;
      }
    },
    onDragStart({nodeId}, ev) {
      if (!selection.includes(nodeId)) {
        if (ev.shiftKey) {
          selection.append(nodeId);
        } else {
          selection.replace(nodeId);
        }
      }
    },
    onClick(state, ev) {
      // If shift key is down, we're panning
      if (state === null) {
        if (!ev.shiftKey) selection.reset();
        return
      }
      let {nodeId} = state;

      // TODO feels hacky
      if (ev.shiftKey) {
        // Toggle from group selection
        selection.toggle(nodeId, ev.shiftKey);
      } else {
        // Set as only selection
        selection.replace(nodeId);
      }
    },
    onDragEnd() {
      // Update layout here instead of onDrag, which is too slow
      setLayout((layout) => {
        let changes = Object.entries(nodeRefs.current).reduce((acc, [nId, ref]) => {
          let {x, y} = getTranslate(ref);
          (acc as any)[nId] = {$set: {
            x, y
          }};
          return acc;
        }, {} as Spec<Layout>);
        return update(layout, changes);
      });
    }
  });

  // Move node *without* updating the layout
  const moveNode = React.useCallback(({dx, dy}: {dx: number, dy: number}) => {
    let rect = ref.current.getBoundingClientRect();
    let scale = rect.width/ref.current.offsetWidth;

    selection.selected.current.forEach((nId) => {
      let {x, y} = getTranslate(nodeRefs.current[nId]);
      nodeRefs.current[nId].style.translate = `${x+dx/scale}px ${y+dy/scale}px`;
    });
  }, [selection.selected]);

  return <div>
    <div id="controls">
      <button onClick={save}>Save</button>
      <button onClick={computeGraph}>Compute</button>
    </div>
    <DraggableView id="stage"
      onContextMenu={ctxMenu.onContextMenu}
      onDoubleClick={() => selection.reset()}>
      {ctxMenu.open && <ContextMenu {...ctxMenu.props} />}
      <Connections onDelete={onDeleteConnection} ref={connections} />
      <div id="nodes" ref={ref} style={dragStyle}>
        {Object.entries(nodes).map(([id, n]) =>
          <div className="node-wrapper"
            key={n.id}
            data-id={n.id}
            ref={(el) => nodeRefs.current[n.id] = el}
            style={{
              translate: `${layout[n.id].x}px ${layout[n.id].y}px`,
              width: `${layout[n.id].w}px`,
              height: `${layout[n.id].h}px`,
            }}
            onMouseDown={(ev) => {
              ev.preventDefault();
              dragMouseDown(ev);
              return false;
            }}>
              <Node
                node={n}
                expired={expired}
                className={selection.includes(n.id) ? 'selected' : ''}
                updateConnections={connections.current.updateNode}
                startConnecting={(portId) => {
                  connections.current.startConnecting([id, portId]);
                }}
                makeConnection={(toPortId) => {
                  if (connections.current.connecting !== null) {
                    let toId = n.id;
                    let [fromId, fromPortId] = connections.current.connecting;
                    // Check that port types align
                    let input = n.inputs[toPortId];
                    if (input.type == nodes[fromId].outputs[fromPortId].type) {
                      // Delete previous connection, if any
                      if (!input.multi && input.connections.length > 0) {
                        for (const con of input.connections) {
                          connections.current.deleteLine(con, [toId, toPortId]);
                        }
                      }
                      let exists = connections.current.updateLine([fromId, fromPortId], [toId, toPortId]);
                      if (!exists) {
                        setNodes((nodes) => {
                          return update(nodes, {
                            [fromId]: {
                              outputs: {
                                [fromPortId]: {
                                  connections: {$push: [[toId, toPortId]]}
                                }
                              }
                            },
                            [toId]: {
                              inputs: {
                                [toPortId]: {
                                  connections: {$push: [[fromId, fromPortId]]}
                                }
                              }
                            }
                          });
                        });
                      }
                      connections.current.stopConnecting();
                    }
                  }
                }}
                onChange={(changes) => {
                  setNodes((nodes) => {
                    return update(nodes, {
                      [n.id]: changes
                    });
                  });
                }}
                />
          {nodeTypes[n.type].resizable && <div className="node-resize-handle"></div>}
        </div>)}
      </div>
    </DraggableView>
  </div>
}

export default Graph;