import React from 'react';
import { loadFile } from '@/util';
import { EditText } from 'react-edit-text';
import { Control } from '@/engine/types';

export default function({control, value, onChange}: {
  control: Control,
  value: Control['value'],
  onChange: (update: Control['value']) => void}) {
  if (control.type === 'edit-text') {
    return <EditText
      defaultValue={value as string}
      onSave={(ev) => onChange(ev.value)} />

  } else if (control.type === 'select') {
    return <select
      value={value as string}
      onChange={(ev) => onChange(ev.target.value)}>
      {control.options.map(({label, value}) => {
        return <option key={value} value={value}>{label}</option>
      })}
    </select>

  } else if (control.type === 'file') {
    const ref = React.useRef<HTMLInputElement>();
    return <div className="control-file">
      <span onClick={() => ref.current?.click()}>
        {(value as typeof control['value'])?.file || 'Upload file'}</span>
      <input
        ref={ref}
        type="file"
        style={{display: 'none'}}
        onChange={(ev) => {
          let fname = ev.target.files[0].name;
          loadFile(ev.target as HTMLInputElement, (text) => {
            onChange({
              file: fname,
              data: text.toString(),
            });
          });
        }} />
    </div>

  } else {
    return <input
      type={control.type as React.HTMLInputTypeAttribute}
      value={value as typeof control['value']}
      onChange={(ev) => {
        let val = ev.target.value;
        if (control.type == 'number') {
          onChange(parseFloat(val));
        } else {
          onChange(ev.target.value);
        }
      }} />
  }
}

