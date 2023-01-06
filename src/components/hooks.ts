import React from 'react';

export function useDraggable(
  ref: React.MutableRefObject<HTMLElement>,
  startPosition: Point,
  shouldHandle: (ev: React.MouseEvent) => boolean,
  onDrag: (pos: Point) => void,
  onDragEnd: (pos: Point) => void) {
  const tracking = React.useRef({x: 0, y: 0, position: startPosition});
  const [isDragging, setIsDragging] = React.useState(false);
  const onMouseDown = (ev: React.MouseEvent) => {
    // Only respond to left-click
    if (ev.button !== 0) return;
    if (!shouldHandle(ev)) return;

    tracking.current.x = ev.clientX;
    tracking.current.y = ev.clientY;
    setIsDragging(true);
  }
  const onMouseUp = () => {
    setIsDragging(false);
    onDragEnd(tracking.current.position);
  }
  React.useEffect(() => {
    if (isDragging) {
      const onMouseMove = (ev: MouseEvent) => {
        let rect = ref.current.getBoundingClientRect();
        let scale = rect.width/ref.current.offsetWidth;
        let t = tracking.current;
        const dx = ev.clientX - t.x;
        const dy = ev.clientY - t.y;
        t.y += dy;
        t.x += dx;
        t.position.y += dy/scale;
        t.position.x += dx/scale;
        ref.current.style.translate = `${t.position.x}px ${t.position.y}px`;
        onDrag(t.position);
      }
      document.addEventListener('mousemove', onMouseMove);
      return () => document.removeEventListener('mousemove', onMouseMove);
    }
  }, [isDragging, onDrag]);

  const style: React.CSSProperties = isDragging ? {
    cursor: 'all-scroll',
    WebkitUserSelect: 'none'
  } : {};
  let {position} = tracking.current;
  style.translate = `${position.x}px ${position.y}px`;

  React.useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  return {style, onMouseDown};
}
