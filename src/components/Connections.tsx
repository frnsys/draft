import Node, { PortAddress } from '@/engine/Node';
import { line, curveBasis } from 'd3-shape';

type Point = {
  x: number,
  y: number,
};

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

class Connections {
  stage: HTMLDivElement;
  parent: HTMLElement;
  lines: Record<string, SVGPathElement>;
  newLine: SVGPathElement;
  newLineStart: Point;
  onDelete: (fromAddr: PortAddress, toAddr: PortAddress) => void;
  _mousemove: (ev: MouseEvent) => void;

  constructor(stage: HTMLDivElement, onDelete: (fromAddr: PortAddress, toAddr: PortAddress) => void) {
    this.stage = stage;
    this.parent = this.stage.parentElement;

    this.lines = {};
    this.newLineStart = {x: 0, y: 0};
    this.newLine = createSvg(this.newLineStart, {x: 0, y: 0}, this.stage);
    this.endNewLine();

    this.onDelete = onDelete;
    this._mousemove = this.onMouseMove.bind(this);
  }

  enable() {
    document.addEventListener('mousemove', this._mousemove);
  }

  disable() {
    document.removeEventListener('mousemove', this._mousemove);
  }

  createFromNodes(nodes: Node[]) {
    nodes.forEach((n) => {
      Object.entries(n.outputs).forEach(([id, {connections}]) => {
        for (const con of connections) {
          this.update([n.id, id], con);
        }
      });
    });
  }

  updateNodeConnections(node: Node) {
    Object.entries(node.outputs).forEach(([id, {connections}]) => {
      for (const con of connections) {
        this.update([node.id, id], con);
      }
    });
    Object.entries(node.inputs).forEach(([id, {connections}]) => {
      for (const con of connections) {
        this.update(con, [node.id, id]);
      }
    });
  }

  onMouseMove(ev: MouseEvent) {
    if (this.newLine.style.display != 'block') return;
    let paRect = this.parent.getBoundingClientRect();
    // TODO adjust for scale
    let pos = {
      x: ev.clientX - paRect.x,
      y: ev.clientY - paRect.y,
    };
    this.updateNewLine(this.newLineStart, pos);
  }

  getPortPosition([nId, pId]: PortAddress, type: 'i'|'o') {
    let port = document.querySelector(`#n-${nId}-${type}-${pId} .port-pip`);
    const rect = port.getBoundingClientRect();

    let paRect = this.parent.getBoundingClientRect();
    return {
      x: rect.x - paRect.x + rect.width/2,
      y: rect.y - paRect.y + rect.height/2
    };
  }

  lineId([fromId, fromPortId]: PortAddress, [toId, toPortId]: PortAddress) {
    return `${fromId}-${fromPortId}--${toId}-${toPortId}`;
  }

  // Returns if line already existed
  update(fromAddr: PortAddress, toAddr: PortAddress) {
    let lineId = this.lineId(fromAddr, toAddr)
    let fromPos = this.getPortPosition(fromAddr, 'o');
    let toPos = this.getPortPosition(toAddr, 'i');
    if (!(lineId in this.lines)) {
      let line = createSvg(fromPos, toPos, this.stage);
      this.lines[lineId] = line;
      line.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        this.delete(fromAddr, toAddr);
        return false;
      });
      return false;
    } else {
      let line = this.lines[lineId];
      line.setAttribute("d", calculateCurve(fromPos, toPos));
      return true;
    }
  }

  delete(fromAddr: PortAddress, toAddr: PortAddress) {
    let lineId = this.lineId(fromAddr, toAddr)
    if (lineId in this.lines) {
      this.lines[lineId].remove();
      delete this.lines[lineId];
      this.onDelete(fromAddr, toAddr);
    }
  }

  deleteNode(node: Node) {
    Object.entries(node.inputs).forEach(([id, inp]) => {
      for (const con of inp.connections) {
        this.delete(con, [node.id, id]);
      }
    });
    Object.entries(node.outputs).forEach(([id, out]) => {
      for (const con of out.connections) {
        this.delete([node.id, id], con);
      }
    });
  }

  startNewLine(fromAddr: PortAddress) {
    this.newLine.style.display = 'block';
    this.newLineStart = this.getPortPosition(fromAddr, 'o');
  }

  updateNewLine(fromPos: Point, toPos: Point) {
    this.newLine.setAttribute("d", calculateCurve(fromPos, toPos));
  }

  endNewLine() {
    this.newLine.style.display = 'none';
  }
}

export default Connections;
