import React from 'react';
import { adjustPosition, Encoder } from '@/util';
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
  const selPort = React.useRef<HTMLElement>(null);

  const getPort = ([nId, pId]: PortAddress, type: 'i'|'o') => {
    let sel = `#n-${nId}-${type}-${pId} .port-pip`;
    return document.querySelector(sel) as HTMLElement;
  }

  const getPortPosition = (addr: PortAddress, type: 'i'|'o') => {
    let port = getPort(addr, type);
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
    if (newLine.current) {
      newLine.current.el.parentElement.remove();
      newLine.current = null;
    }

    if (selPort.current) {
      selPort.current.classList.remove('selected');
    }

    // Hacky
    document.querySelectorAll('.target-tip').forEach((el) => {
      el.remove();
    });

    if (connecting) {
      // Show currently selected port
      let port = getPort(connecting, 'o');
      selPort.current = port as HTMLElement;
      selPort.current.classList.add('selected');

      // Start the connecting line
      let start = getPortPosition(connecting, 'o');
      newLine.current = {
        start,
        el: createSvg(start, start, stage.current)
      }

      // TODO hacky
      // Use keys to quick-connect ports.
      // Only select those with a matching dtype,
      // and not on the same node itself.
      const nId = connecting[0];
      const dtype = port.dataset.dtype;
      let inputPorts = document.querySelectorAll(
        `.node:not([data-id="${nId}"]) .node-inputs .port-pip[data-dtype=${dtype}]`);

      const enc = new Encoder(inputPorts.length, 'asdf');
      const lookup: Record<string, HTMLElement> = {};

      inputPorts.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        let pos = adjustPosition({
          x: rect.x + rect.width/2,
          y: rect.y + rect.height/2,
        }, stage.current);
        let target = document.createElement('div');
        target.className = 'target-tip';
        target.style.translate = `calc(${pos.x}px - 50%) calc(${pos.y}px - 50%)`;

        let code = enc.encode(i);
        target.innerText = code;
        lookup[code] = el as HTMLElement;
        stage.current.appendChild(target);
      });

      const buffer: string[] = [];
      let bufferTimeout: NodeJS.Timeout = null;
      const selectTarget = (ev: KeyboardEvent) => {
        buffer.push(ev.key);

        if (buffer.length == enc.nChars) {
          let code = buffer.join('');
          if (code in lookup) {
            lookup[code].click();
          }
        }

        // Reset the buffer after some time
        if (bufferTimeout) clearTimeout(bufferTimeout);
        bufferTimeout = setTimeout(() => {
          buffer.length = 0;
        }, 200);
      }
      document.addEventListener('keydown', selectTarget);
      return () => {
        document.removeEventListener('keydown', selectTarget);
      }
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
