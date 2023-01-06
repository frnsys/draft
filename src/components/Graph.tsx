import _ from 'lodash';
import React from 'react';
import Node from './Node';
import { nanoid } from 'nanoid';
import { getStatus }  from './Status';
import { adjustPosition } from '@/util';
import DraggableView from './DraggableView';
import Connections, { ConnectionsRef } from './Connections';
import ContextMenu, { useContextMenu } from './ContextMenu';
import { newNode, nodeTypes } from '@/engine/node';
import { compute, graphHash } from '@/engine/graph';
import { Node as N, PortAddress } from '@/engine/types';
import update from 'immutability-helper';

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

function Graph() {
  const [id, setId] = React.useState(nanoid());
  const [nodes, setNodes] = React.useState<Record<string, N>>({});
  const [layout, setLayout] = React.useState<Record<string, {x: number, y: number}>>({});

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
  const {
    open: menuOpen,
    props: menuProps,
    onContextMenu
  } = useContextMenu(switchFn);

  const ref = React.useRef<HTMLDivElement>(null);
  const addNode = (type: string, position: Point) => {
    let node = newNode(type);
    setLayout((layout) => {
      return update(layout, {
        [node.id]: {
          $set: adjustPosition(position, ref.current),
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
  };

  React.useEffect(() => {
    // Existing connections
    Object.values(nodes).forEach((node) => {
      connections.current.updateNode(node);
    });

    const exitConnectionMode = (ev: KeyboardEvent) => {
      if (ev.key == 'Escape') {
        connections.current.stopConnecting();
      }
    }
    document.addEventListener('keydown', exitConnectionMode);
    return () => {
      document.removeEventListener('keydown', exitConnectionMode);
    }
  }, []);

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


  return <div>
    <div id="controls">
      <button onClick={save}>Save</button>
      <button onClick={computeGraph}>Compute</button>
    </div>
    <DraggableView id="stage"
      onContextMenu={onContextMenu}>
      {menuOpen && <ContextMenu {...menuProps} />}
      <Connections onDelete={onDeleteConnection} ref={connections} />
      <div id="nodes" ref={ref}>
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
          />)}
      </div>
    </DraggableView>
  </div>
}

export default Graph;