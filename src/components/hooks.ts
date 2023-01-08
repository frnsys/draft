import React from 'react';

interface DragProps<T> {
  onClick?: (state: T, ev: MouseEvent) => void,
  onDrag: (delta: {dx: number, dy: number}, state: T) => void,
  onDragEnd?: (state: T) => void,
  onDragStart?: (state: T, ev: MouseEvent) => void,
  shouldHandle: (ev: React.MouseEvent) => boolean,
  initDragState: (ev: React.MouseEvent) => T,
}

export function useDraggable<T>({
  shouldHandle,
  onDrag, onDragStart, onDragEnd,
  onClick, initDragState,
}: DragProps<T>) {
  const tracking = React.useRef({x: 0, y: 0});
  const dragStarted = React.useRef(false);
  const dragState = React.useRef<T>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const onMouseDown = (ev: React.MouseEvent) => {
    // Only respond to left-click
    if (ev.button !== 0) return;
    if (!shouldHandle(ev)) return;

    tracking.current.x = ev.clientX;
    tracking.current.y = ev.clientY;
    setIsDragging(true);
    dragState.current = initDragState(ev);
  }
  const onMouseUp = (ev: MouseEvent) => {
    setIsDragging(false);
    if (dragStarted.current) {
      if (onDragEnd) onDragEnd(dragState.current);
    } else {
      if (onClick) onClick(dragState.current, ev);
    }
    dragStarted.current = false;
    dragState.current = null;
  }
  React.useEffect(() => {
    if (isDragging) {
      const onMouseMove = (ev: MouseEvent) => {
        let t = tracking.current;
        const dx = ev.clientX - t.x;
        const dy = ev.clientY - t.y;

        if (dx != 0 && dy != 0) {
          if (!dragStarted.current) {
            dragStarted.current = true;
            if (onDragStart) onDragStart(dragState.current, ev);
          }

          t.y += dy;
          t.x += dx;
          onDrag({dx, dy}, dragState.current);
        }
      }
      document.addEventListener('mousemove', onMouseMove);
      return () => document.removeEventListener('mousemove', onMouseMove);
    }
  }, [isDragging, onDrag]);

  const style: React.CSSProperties = isDragging ? {
    userSelect: 'none',
    WebkitUserSelect: 'none'
  } : {};

  React.useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  return {style, onMouseDown};
}

export function useKeyBindings(bindings: Record<string, (ev: KeyboardEvent) => void>) {
  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key in bindings) {
        bindings[ev.key](ev);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    }
  }, []);
}

export function useSelection() {
  const [selected, setSelected_] = React.useState<string[]>([]);
  const selectedRef = React.useRef([]);

  // TODO this is hacky;
  // the interaction layer can't wait for state updates
  // so a ref is handier for tracking selection state
  // BUT we also want to trigger re-renders when this changes
  // for indicating which nodes are selected...
  // so thus we have both a ref and state
  const setSelected = (update: (selected: string[]) => string[]) => {
    setSelected_((selected) => {
      let updated = update(selected);
      selectedRef.current = updated;
      return updated;
    });
  };

  return {
    selected: selectedRef,
    reset() {
      selectedRef.current = [];
      setSelected_([]);
    },
    replace(id: string) {
      setSelected_([id]);
      selectedRef.current = [id];
    },
    append(id: string) {
      setSelected((selected) => {
        if (selected.includes(id)) {
          return selected;
        } else {
          return [...selected, id];
        }
      });
    },
    remove(id: string) {
      setSelected((selected) => {
        return selected.filter((_id) => _id !== id);
      });
    },
    toggle(id: string, append: boolean) {
      setSelected((selected) => {
        if (selected.includes(id)) {
          return selected.filter((_id) => _id !== id);
        } else {
          if (append) {
            return [...selected, id];
          } else {
            return [id];
          }
        }
      });
    },
    includes(id: string) {
      return selected.includes(id)
    }
  }
}
