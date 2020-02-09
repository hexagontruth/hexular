// A wrapper in anticipation of using non-native select boxes at some point

class Select {
  static init(arg, ...args) {
    if (!arg)
      return Select.init(document.querySelectorAll('select'));
    else if (arg instanceof HTMLSelectElement)
      return new Select(arg, ...arg);
    else if (typeof arg == 'string')
      return Select.init(document.querySelectorAll(arg), ...args);
    else if (arg.length)
      return Array.from(arg).map((e) => Select.init(e, ...args));
  }

  constructor(elArg, ...args) {
    this._onchange = () => null;
    this.el = elArg instanceof HTMLSelectElement ? elArg : this._create(elArg);
    this.el.select = this;
    this.el.addEventListener('change', this.onchange);
  }

  set onchange(fn) {
    this.el.addEventListener('change', fn);
  }

  set value(value) {
    this.select.value = value;
  }

  get value() {
    return this.select.value;
  }

  replace(opts, selected) {
    let data = opts;
    if (opts.length) {
      data = {};
      opts.forEach((e) => data[e] = e);
    }
    this.el.options.length = 1;
    Object.entries(data).forEach(([key, value]) => {
      let option = document.createElement('option');
      option.value = key;
      option.text = value;
      option.selected = key == selected;
      this.el.appendChild(option);
    });
  }

  _create(...args) {
    let strArgs = [];
    let objArgs = {};
    for (let arg of args)
      if (typeof arg == 'string')
        strArgs.push(arg);
      else if (typeof arg == 'object')
        Object.assign(objArgs, arg);
    let [tag, className] = Object.assign(['div', ''], strArgs);
    let el = document.createElement(tag);
    className && (el.className = className)
    Object.entries(objArgs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
    return el;
  }
}