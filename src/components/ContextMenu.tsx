import React from 'react';
import ReactDOM from "react-dom";

interface Option {
  id: string,
  label: string,
  desc?: string,
}

type SelectFn = (optionId: string, position?: Point) => void;

interface Props {
  // Options to display
  options: Option[],

  // Where to render the menu
  position: Point,

  // Function called when an option is selected
  onSelect: SelectFn,

  // Called when requesting to close
  onClose: () => void,
}

function ContextMenu({position, options, onSelect, onClose}: Props) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    const tryClose = (ev: MouseEvent) => {
      let clickedOutside = !ref.current?.contains(ev.target as Node);
      if (clickedOutside) onClose();
    }
    document.addEventListener('click', tryClose);
    return () => document.removeEventListener('click', tryClose);
  }, [onClose]);

  return ReactDOM.createPortal(<div
    ref={ref}
    className="context-menu"
    style={{
      left: position.x,
      top: position.y,
    }}>
    {options.map((opt) => <div key={opt.id} onClick={() => onSelect(opt.id)}>
      <div className="context-menu-option-label">{opt.label}</div>
      {opt.desc && <div className="context-menu-option-desc">{opt.desc}</div>}
    </div>)}
  </div>, document.getElementById('menus'));
}

type MenuProps = {
  options: Option[],
  onSelect: SelectFn
}
export function useContextMenu(
  switchFn: (target: HTMLElement, currentTarget: HTMLElement) => MenuProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [props, setProps] = React.useState<MenuProps>({
    options: [],
    onSelect: () => {}
  });

  const onContextMenu = React.useCallback((ev: React.MouseEvent) => {
    ev.preventDefault();
    setPosition({ x: ev.clientX, y: ev.clientY });
    setOpen(true);
    setProps(switchFn(
      ev.target as HTMLElement,
      ev.currentTarget as HTMLElement));
    return false;
  }, []);
  const onClose = React.useCallback(() => setOpen(false), []);

  return {
    open,
    props: {
      position,
      onClose,
      options: props.options,
      onSelect: (optionId: string) => {
        props.onSelect(optionId, position);
        setOpen(false);
      },
    },
    onContextMenu
  }
}

export default ContextMenu;
