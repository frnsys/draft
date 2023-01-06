import React from 'react';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.0;

interface Props {
  id?: string,
  className?: string,
  onMouseDown?: (ev: React.MouseEvent) => void,
  onContextMenu?: (ev: React.MouseEvent) => void,
  onDragEnd?: (offset: {
    x: number, y: number,
    top: number, left: number}) => void,
  children: JSX.Element | JSX.Element[],
}

// Drag to pan and optional zooming
function DraggableView({onDragEnd, ...props}: Props) {
  const ref = React.useRef<HTMLDivElement>();

  const [isDragging, setIsDragging] = React.useState(false);
  const zoom = React.useRef(1);
  const position = React.useRef({ top: 0, left: 0, x: 0, y: 0 });

  const onMouseDown = (ev: React.MouseEvent) => {
    // Only direct clicks
    if (ev.target !== ref.current.parentElement) return;

    // Pass event
    if (props.onMouseDown) props.onMouseDown(ev);

    // Only respond to left-click
    if (ev.button !== 0) return;

    const el = ref.current;
    position.current = {
      x: ev.clientX,
      y: ev.clientY,
      top: parseInt(el.style.top) || 0,
      left: parseInt(el.style.left) || 0,
    };
    setIsDragging(true);
  }
  const onMouseUp = () => {
    if (onDragEnd) {
      onDragEnd(position.current);
    }
    setIsDragging(false);
  }
  const onMouseMove = (ev: React.MouseEvent) => {
    if (!isDragging) return;
    let pos = position.current;
    const dx = ev.clientX - pos.x;
    const dy = ev.clientY - pos.y;
    ref.current.style.top = `${pos.top + dy}px`;
    ref.current.style.left = `${pos.left + dx}px`;
  }

  const onWheel = (ev: React.WheelEvent) => {
    let z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.current - ev.deltaY/400));
    ref.current.style.transform = `scale(${z})`;
    zoom.current = z;
  }

  const style: React.CSSProperties = isDragging ? {
    cursor: 'all-scroll',
    WebkitUserSelect: 'none'
  } : {};

  React.useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  return <div {...props}
    onWheel={onWheel}
    onMouseDown={onMouseDown}
    onMouseMove={onMouseMove}
    style={{position: 'relative', ...style}}>
    <div ref={ref} style={{position: 'absolute'}}>
      {props.children}
    </div>
  </div>
}

export default DraggableView;