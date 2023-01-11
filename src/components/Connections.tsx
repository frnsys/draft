import React from 'react';
import { adjustPosition } from '@/util';
import { line, curveBasis } from 'd3-shape';
import { Node, PortAddress } from '@/engine/types';

// From <https://github.com/chrisjpatty/flume>
const calculateCurve = (from: Point, to: Point) => {
  const length = to.x - from.x;
  const thirdLength = length / 3;
  const curve = line().curve(curveBasis)([
    [from.x, from.y],
    [from.x + thirdLength, from.y],
    [from.x + thirdLength * 2, to.y],
    [to.x, to.y]
  ]);
  return curve;
};
const createSvg = (
  from: Point,
  to: Point,
  stage: HTMLElement,
) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const curve = calculateCurve(from, to)
  path.setAttribute("d", curve)
  path.setAttribute("stroke", "rgb(185, 186, 189)");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("fill", "none");
  svg.appendChild(path);
  stage.appendChild(svg);
  return path;
};

function lineId([fromId, fromPortId]: PortAddress, [toId, toPortId]: PortAddress) {
  return `${fromId}-${fromPortId}--${toId}-${toPortId}`;
}

export type ConnectionsRef = {
  connecting: PortAddress,
  startConnecting: (addr: PortAddress) => void,
  stopConnecting: () => void,
  deleteLine: (fromAddr: PortAddress, toAddr: PortAddress) => void,
  updateLine: (fromAddr: PortAddress, toAddr: PortAddress) => boolean,
  updateNode: (node: Node) => void,
  deleteNode: (node: Node) => void,
  reset: () => void,
}

function Connections(
  {onDelete}: {onDelete: (fromAddr: PortAddress, toAddr: PortAddress) => void},
  ref: React.MutableRefObject<ConnectionsRef>) {
  const stage = React.useRef<HTMLDivElement>(null);
  const [connecting, setConnecting] = React.useState<PortAddress>(null);

  const {current: lines} = React.useRef<Record<string, SVGPathElement>>({});
  const newLine = React.useRef(null);

  const getPortPosition = ([nId, pId]: PortAddress, type: 'i'|'o') => {
    let sel = `#n-${nId}-${type}-${pId} .port-pip`;
    let port = document.querySelector(sel);
    const rect = port.getBoundingClientRect();
    let pos = adjustPosition({
      x: rect.x + rect.width/2,
      y: rect.y + rect.height/2,
    }, stage.current);
    return pos;
  }

  const fns = React.useMemo(() => ({
    deleteLine(fromAddr: PortAddress, toAddr: PortAddress) {
      let lId = lineId(fromAddr, toAddr)
      if (lId in lines) {
        lines[lId].remove();
        delete lines[lId];
        onDelete(fromAddr, toAddr);
      }
    },

    // Returns if line already existed
    updateLine(fromAddr: PortAddress, toAddr: PortAddress) {
      let lId = lineId(fromAddr, toAddr)
      let fromPos = getPortPosition(fromAddr, 'o');
      let toPos = getPortPosition(toAddr, 'i');
      if (!(lId in lines)) {
        let line = createSvg(fromPos, toPos, stage.current);
        lines[lId] = line;
        line.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          fns.deleteLine(fromAddr, toAddr);
          return false;
        });
        return false;
      } else {
        let line = lines[lId];
        line.setAttribute("d", calculateCurve(fromPos, toPos));
        return true;
      }
    },

    updateNode(node: Node) {
      Object.entries(node.outputs).forEach(([id, {connections}]) => {
        for (const con of connections) {
          fns.updateLine([node.id, id], con);
        }
      });
      Object.entries(node.inputs).forEach(([id, {connections}]) => {
        for (const con of connections) {
          fns.updateLine(con, [node.id, id]);
        }
      });
    },

    deleteNode(node: Node) {
      Object.entries(node.inputs).forEach(([id, inp]) => {
        for (const con of inp.connections) {
          fns.deleteLine(con, [node.id, id]);
        }
      });
      Object.entries(node.outputs).forEach(([id, out]) => {
        for (const con of out.connections) {
          fns.deleteLine([node.id, id], con);
        }
      });
    },

    reset() {
      let ids = Object.keys(lines);
      for (const id of ids) {
        lines[id].remove();
        delete lines[id];
      }
    },
  }), []);

  React.useEffect(() => {
    const onMouseMove = (ev: MouseEvent) => {
      let line = newLine.current;
      if (!line) return;
      let pos = adjustPosition({
        x: ev.clientX,
        y: ev.clientY,
      }, stage.current);
      line.el.setAttribute("d", calculateCurve(line.start, pos));
    }

    document.addEventListener('mousemove', onMouseMove);
    return () => document.removeEventListener('mousemove', onMouseMove);
  }, []);

  React.useEffect(() => {
    if (connecting) {
      let start = getPortPosition(connecting, 'o');
      newLine.current = {
        start,
        el: createSvg(start, start, stage.current)
      }
    } else if (newLine.current) {
      newLine.current.el.remove();
      newLine.current = null;
    }
  }, [connecting]);

  ref.current = {
    connecting,
    startConnecting: (addr: PortAddress) => {
      setConnecting(addr);
    },
    stopConnecting: () => {
      setConnecting(null);
    },
    ...fns,
  }

  return <div id="connections" ref={stage} />
}

export default React.forwardRef(Connections);
