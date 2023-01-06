import _ from 'lodash';
import React from 'react';
import Node from './Node';
import Connections from './Connections';
import ContextMenu from './ContextMenu';
import DraggableView from './DraggableView';
import update from 'immutability-helper';
import N, { PortAddress, newNode, nodeTypes, compute, graphHash } from '@/engine/Node';
import { getStatus }  from './Status';

const options = Object.entries(nodeTypes).map(([id, n]) => ({
  id,
  label: n.label,
  desc: n.desc,
}));

// TODO
interface Props {
}

function Graph({}: Props) {
  const [nodes, setNodes] = React.useState<Record<string, N>>({});
  const [layout, setLayout] = React.useState<Record<string, {x: number, y: number}>>({});

  const menuRef = React.useRef<HTMLDivElement>();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuType, setMenuType] = React.useState<'graph'|N>('graph');
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });
  const onContextMenu = (ev: React.MouseEvent) => {
    ev.preventDefault();
    setMenuPosition({ x: ev.clientX, y: ev.clientY });
    setMenuOpen(true);
    // TODO REALLY hacky
    let nodeEl = (ev.target as HTMLElement).closest('.node');
    if (nodeEl) {
      let nId = nodeEl.id.slice(2);
      let node = nodes[nId];
      setMenuType(node);
    } else {
      setMenuType('graph');
    }
    return false;
  }
  const onMouseDown = (ev: React.MouseEvent) => {
    if (!menuRef.current?.contains(ev.target as Node)) {
      setMenuOpen(false);
    }
  }
  const addNode = (type: string) => {
    let node = newNode(type);
    setLayout((layout) => {
      // TODO hacky
      let pa = connectionStageRef.current.parentElement;
      let paRect = pa.getBoundingClientRect();
      // TODO adjust for zoom
      return update(layout, {
        [node.id]: {
          $set: {
            x: menuPosition.x - paRect.x,
            y: menuPosition.y - paRect.y,
          }
        }
      });
    });
    setNodes((nodes) => {
      return update(nodes, {
        $merge: {[node.id]: node}
      });
    });
    setMenuOpen(false);
  }
  const editNode = (op: 'delete') => {
    switch (op) {
      case 'delete':
        deleteNode(menuType as N);
        break;
    }
    setMenuOpen(false);
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

  const connections = React.useRef<Connections>(null);
  const connectionStageRef = React.useRef<HTMLDivElement>(null);
  const [connecting, setConnecting] = React.useState<PortAddress>(null);
  React.useEffect(() => {
    const cons = new Connections(connectionStageRef.current, (fromAddr, toAddr) => {
      let [fromId, fromPortId] = fromAddr;
      let [toId, toPortId] = toAddr;
      setNodes((nodes) => {
        let fromRemIdx = nodes[fromId].outputs[fromPortId].connections.findIndex((addr) => _.isEqual(toAddr, addr));
        let toRemIdx = nodes[toId].inputs[toPortId].connections.findIndex((addr) => _.isEqual(fromAddr, addr));
        console.log('fromidx', fromRemIdx);
        console.log('toidx', toRemIdx);
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
    });
    connections.current = cons;
    cons.enable();

    // Existing connections
    cons.createFromNodes(Object.values(nodes));

    const exitConnectionMode = (ev: KeyboardEvent) => {
      if (ev.key == 'Escape') {
        setConnecting(null);
        connections.current.endNewLine();
      }
    }
    document.addEventListener('keydown', exitConnectionMode);
    return () => {
      connections.current.disable();
      document.removeEventListener('keydown', exitConnectionMode);
    }
  }, []);
  const updateConnections = React.useCallback((node: N) => {
    if (connections.current === null) return;
    connections.current.updateNodeConnections(node);
  }, []);

  const [hash, setHash] = React.useState(graphHash(nodes));
  const [lastComputedHash, setLastComputedHash] = React.useState(graphHash(nodes));
  React.useEffect(() => {
    setHash(graphHash(nodes));
  }, [nodes]);
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
      let {nodes, layout, lastComputedHash} = JSON.parse(savedData);
      setLastComputedHash(lastComputedHash);
      setLayout(layout);
      setNodes(nodes);
      // TODO definitely a better way to do this
      setTimeout(() => {
        connections.current.createFromNodes(Object.values(nodes));
      }, 100);
    }
  }, []);


  return <div>
    <div id="controls">
      <button onClick={save}>Save</button>
      <button onClick={computeGraph}>Compute</button>
    </div>
    <DraggableView id="stage"
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}>
      {menuOpen && (menuType == 'graph' ? <ContextMenu
        ref={menuRef}
        position={menuPosition}
        onSelect={addNode}
        options={options}
      /> : <ContextMenu
        ref={menuRef}
        position={menuPosition}
        onSelect={editNode}
        options={[{
          id: 'delete',
          label: 'Delete',
          desc: 'Delete this node.',
        }]}
      />)}
      <div id="connections" ref={connectionStageRef} />
      <div id="nodes">
        {Object.entries(nodes).map(([id, n]) => <Node
          key={n.id} node={n}
          position={layout[n.id]}
          onMove={(pos) => {
            setLayout((layout) => {
              return update(layout, {
                [n.id]: {$set: pos}
              });
            });
          }}
          expired={expired}
          updateConnections={updateConnections}
          startConnecting={(portId) => {
            setConnecting([id, portId]);
            connections.current.startNewLine([id, portId]);
          }}
          makeConnection={(toPortId) => {
            if (connecting !== null) {
              let toId = n.id;
              let [fromId, fromPortId] = connecting;
              // Check that port types align
              let input = n.inputs[toPortId];
              if (input.type == nodes[fromId].outputs[fromPortId].type) {
                // Delete previous connection, if any
                if (!input.multi && input.connections.length > 0) {
                  for (const con of input.connections) {
                    connections.current.delete(con, [toId, toPortId]);
                  }
                }
                let exists = connections.current.update([fromId, fromPortId], [toId, toPortId]);
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
                setConnecting(null);
                connections.current.endNewLine();
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
          />)}
      </div>
    </DraggableView>
  </div>
}

export default Graph;