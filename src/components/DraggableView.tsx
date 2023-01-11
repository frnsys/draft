import React from 'react';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.0;

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: JSX.Element | JSX.Element[],
}

// Drag to pan and optional zooming
function DraggableView({...props}: Props) {
  const ref = React.useRef<HTMLDivElement>();

  const [isDragging, setIsDragging] = React.useState(false);
  const zoom = React.useRef(1);
  const position = React.useRef({ top: 0, left: 0, x: 0, y: 0 });

  const onMouseDown = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    // Only direct clicks
    if (ev.target !== ref.current.parentElement) return;

    // Only respond to left-click
    if (ev.button !== 0) return;

    position.current.x = ev.clientX;
    position.current.y = ev.clientY;
    setIsDragging(true);
  }
  const onMouseUp = () => {
    setIsDragging(false);
  }
  const onMouseMove = (ev: React.MouseEvent) => {
    if (!isDragging) return;
    let pos = position.current;
    const dx = ev.clientX - pos.x;
    const dy = ev.clientY - pos.y;
    pos.left += dx;
    pos.top += dy;
    pos.x = ev.clientX;
    pos.y = ev.clientY;
    ref.current.style.translate = `${pos.left}px ${pos.top}px`;
  }

  const onWheel = (ev: React.WheelEvent) => {
    let z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom.current - ev.deltaY/800));

    // TODO a more concise way of doing this
    // Can't use pos.left or pos.top here b/c
    // it doesn't take into account the offsets due to the zoom
    let rect = ref.current.getBoundingClientRect();
    let pt = {
      x: (ev.clientX - rect.x)/zoom.current,
      y: (ev.clientY - rect.y)/zoom.current,
    }

    ref.current.style.scale = z.toString();
    rect = ref.current.getBoundingClientRect();
    let newPt = {
      x: (ev.clientX - rect.x)/z,
      y: (ev.clientY - rect.y)/z,
    }

    let pos = position.current;
    pos.left += (newPt.x - pt.x)*z;
    pos.top += (newPt.y - pt.y)*z;
    ref.current.style.translate = `${pos.left}px ${pos.top}px`;

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
    style={style}>
    <div ref={ref}>
      {props.children}
    </div>
  </div>
}

export default DraggableView;