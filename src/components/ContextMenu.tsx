import React from 'react';
import ReactDOM from "react-dom";

interface Option {
  id: string,
  label: string,
  desc?: string,
}

interface Props {
  options: Option[],
  position: {x: number, y: number},
  onSelect: (option: string) => void,
}

function ContextMenu({position, options, onSelect}: Props, ref: React.MutableRefObject<HTMLDivElement>) {
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

export default React.forwardRef(ContextMenu);
