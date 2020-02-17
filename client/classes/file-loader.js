class FileLoader {
  constructor(accept, ...args) {
    const defaults = {
      reader: 'readAsText',
      multiple: false,
      readIdx: 0,
      fileTypes: [],
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
      this.loadFn(ev.target.result);
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
    this.fileTypes[idx] = this.input.files[idx].type;
    this.readFilter[idx] && this.fileReader[this.reader](this.input.files[idx]);
  }
}