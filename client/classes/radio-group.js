class RadioGroup {
  constructor(keys, cb=()=>()=>{}) {
    this.keys = keys.slice();
    this.cb = cb;
    this.active = null;
    this._fn = () => {};
    this.fn = (...args) => this._fn(...args);
    this.fn.radio = this;
  }

  add(key) {
    this.keys.includes(key) || this.keys.push(key);
  }

  has(key) {
    return this.keys.includes(key);
  }

  alts(key=this.active) {
    return this.keys.filter((e) => e != key);
  }

  set(key) {
    this.active = key;
    this._fn = this.cb(this.active, this.alts()) || (() => {});
  }
}
