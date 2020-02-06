class Preset {
  static fromString(str) {
    let obj = JSON.parse(str);
    return new Preset(obj);
  }

  constructor(...args) {
    this.nh = 6;
    for (let arg of args)
      if (arg.length)
        this.rules = arg.slice();
      else
        Object.assign(this, arg);
    this.numStates = this.numStates || this.rules.length;
  }

  toString() {
    return JSON.stringify(this);
  }
}