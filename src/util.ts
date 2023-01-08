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
