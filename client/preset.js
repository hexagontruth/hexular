class Preset {
  static fromString(str) {
    let obj = JSON.parse(str);
    return new Preset(obj);
  }

  constructor(...args) {
    let defaults = {
      defaultRule: 'identityRule',
      nh: 6,
      filters: {
        clipBottomFilter: false,
        clipTopFilter: false,
        binaryFilter: false,
        modFilter: true,
        edgeFilter: false
      },
      rules: [],
    };
    Config.merge(this, defaults);
    for (let arg of args)
      if (!arg)
        continue;
      else if (arg.length)
        this.rules = arg.slice();
      else
        Config.merge(this, arg);
    this.numStates = this.numStates || this.rules.length;
  }

  toString() {
    return JSON.stringify(this);
  }
}