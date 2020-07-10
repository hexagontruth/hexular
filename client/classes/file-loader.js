class FileLoader {
  constructor(accept, ...args) {
    const defaults = {
      reader: 'auto',
      multiple: false,
      readIdx: 0,
      fileTypes: [],
      fileNames: [],
      filterFn: () => Array(this.input.files.length).fill(true),
      loadFn: () => null,
      fileReader: new FileReader(),
      input: document.createElement('input'),
    };
    Object.assign(this, defaults, ...args);
    this.input.type = 'file';
    this.input.accept = accept;
    this.input.multiple = this.multiple;
    this.input.onchange = () => {
      this.readFilter = this.filterFn(Array.from(this.input.files));
      this._readNext();
    };
    this.fileReader.onloadend = (ev) => {
      ++this.readIdx < this.input.files.length && this._readNext();
    }
    this.fileReader.onload = (ev) => {
      let idx = this.readIdx;
      this.loadFn(ev.target.result, this.fileNames[idx], this.fileTypes[idx]);
    };
  }

  prompt() {
    this.input.click();
  }

  set filter(fn) {
    this.filterFn = fn;
  }

  set onload(fn) {
    this.loadFn = fn;
  }

  _readNext() {
    let idx = this.readIdx;
    let file = this.input.files[idx];
    this.fileTypes[idx] = file.type;
    this.fileNames[idx] = file.name;
    let reader = this.reader;
    if (reader == 'auto') {
      let isText = ['text/plain', 'application/javascript', 'application/json'].includes(file.type);
      reader = isText ? 'readAsText' : 'readAsArrayBuffer';
    }
    this.readFilter[idx] && this.fileReader[reader](file);
  }
}
