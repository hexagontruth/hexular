class Preset extends Array {
  static fromString(str) {
    let obj = JSON.parse(str);
    return new Preset(obj.rules, obj.nh);
  }

  constructor(functions, nh) {
    super(functions.length);
    Object.assign(this, functions);
    this.nh = nh;
  }

  toString() {
    let obj = {rules: this, nh: this.nh};
    return JSON.stringify(obj);
  }
}