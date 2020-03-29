class RadioGroup {
  constructor(name, group={}) {
    this.name = name;
    this.keys = new Set(Object.keys(group));
    this.fns = Object.merge({}, group);
    this._fn = () => {};
    let radioGroup = this;
    this.fn = function(...args) {
      radioGroup._fn(...args);
    };
  }

  add(key, fn) {
    this.keys.add(key);
    this.fns[key] = fn;
  }

  has(key) {
    return this.keys.has(key);
  }

  set(key) {
    if (!key)
      this._fn = () => {};
    else if (!this.fns[key])
      throw new Hexular.classes.HexError(`Key "${key}" does not belong to radio group "${this.name}"`);
    else
      this._fn = this.fns[key];
  }
}
