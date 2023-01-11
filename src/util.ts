export function adjustPosition({x, y}: Point, ref: HTMLElement) : Point {
  let rect = ref.getBoundingClientRect();
  let scale = rect.width/ref.offsetWidth;
  return {
    x: (x - rect.x)/scale,
    y: (y - rect.y)/scale,
  }
}

export function getTranslate(ref: HTMLElement) {
  let [x, y] = ref.style.translate.split(' ').map((p) => parseInt(p));
  return {x, y};
}

// Load a file from the specified input and read its data,
// then execute the provided callback with the data
export function loadFile(input: HTMLInputElement, cb: (text: string | ArrayBuffer) => void) {
  if ('files' in input && input.files.length > 0) {
    let file = input.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target.result;
      cb(text);
    };
    reader.onerror = (err) => console.log(err);
    reader.readAsText(file);
  }
}

// Download string as a file for the user
// <https://stackoverflow.com/a/34156339>
export function download(content: string, fileName: string, contentType: string) {
  let a = document.createElement('a');
  let file = new Blob([content], {type: contentType});
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
}

// Encode a numeric value into the provided character set.
// E.g. if charset='abc', maxValue=27, value=12 this returns 'bba'
export class Encoder {
  charset: string;
  nChars: number;
  maxValue: number;

  constructor(maxValue: number, charset: string) {
    this.charset = charset;
    this.maxValue = maxValue;

    // Ensure we use enough characters to fully
    // represent the values
    let nChars = 1;
    while (maxValue > charset.length**nChars) {
      nChars++;
    }
    this.nChars = nChars;
  }

  encode(value: number) {
    if (value >= this.maxValue) {
      throw Error('Value cannot be greater than maxValue');
    }

    let chars: string[] = [];
    for (let i=this.nChars; i--; i>=0) {
      let dem = this.charset.length ** i;
      let idx = Math.floor(value/dem)%this.charset.length;
      chars.push(this.charset[idx]);
    }

    return chars.join('');
  }
}
