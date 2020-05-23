 class Plugin {
  static restore(board, pluginName, settings, name) {
    return new Board.plugins[pluginName](board, settings, name);
  }

  static policy() {
    return {
      autostart: true
    };
  }

  static baseSettings() {
    return {
      stateBlacklist: null,
      stateWhitelist: null,
    };
  }

  constructor(board, settings, name) {
    this.name = name || this.constructor.name;
    this.board = board;
    this.model = board.model;
    this.bgAdapter = board.bgAdapter;
    this.adapter = board.adapter;
    this.fgAdapter = board.fgAdapter;
    this.config = board.config;
    this.stateWhitelist = null;
    this.stateBlacklist = null;
    this.activated = false;
    this.enabled = false;
    this.fns = [];
    this.globalAlpha = 1;
    this.saveSettings(settings || this.defaultSettings());
  }

  _activate() {}

  _deactivate() {}

  _enable() {}

  _disable() {}

  defaultSettings() {
    return `{}`;
  }

  enable() {
    this.activated || this.activate();
    if (!this.enabled) {
      this.enabled = true;
      this._enable();
    }
  }

  disable() {
    this.enabled = false;
    this._disable();
  }

  activate() {
    if (!this.activated) {
      this.activated = true;
      this._activate();
    }
  }

  deactivate() {
    if (this.activated) {
      this.activated = false;
      this.deleteHooks();
      this._deactivate();
    }
  }

  registerFunction(fn) {
    let wrapper = (...args) => (this.enabled || undefined) && fn(...args);
    wrapper.plugin = this;
    this.fns.push(wrapper);
    return wrapper;
  }

  registerHook(hook, fn) {
    let wrapper = this.registerFunction(fn);
    this.board.addHook(hook, wrapper);
  }

  deleteHooks() {
    Object.entries(this.board.hooks).forEach(([hook, fns]) => {
      this.board.hooks[hook] = fns.filter((e) => e.run.plugin != this);
    });
    this.fns = [];
  }

  getSettings() {
    return this.settingsString;
  }

  getPolicy() {
    return Hexular.util.merge({}, Plugin.policy, this.constructor.policy());
  }

  saveSettings(settingsString) {
    let fn;
    let settingsObj;
    try {
      fn = new Function('Board', 'Hexular', 'settings', `return eval('(' + settings + ')');`);
      settingsObj = fn(Board, Hexular, settingsString);
    }
    catch (e) {
      this.board.setMessage(e, 'error');
      throw e;
    }
    if (typeof settingsObj == 'object') {
      this.settingsString = this.trim(settingsString);
      this.settings = settingsObj;
      this.setStateLists();
      this._onSaveSettings && this._onSaveSettings();
    }
    else {
      throw new Hexular.HexError('Settings string does not evaluate to an object');
    }
    this.config.setPlugins();
  }

  setStateLists() {
    let isWhitelist = this.settings.stateWhitelist && this.settings.stateWhitelist.length > 0;
    let isBlacklist = this.settings.stateBlacklist && this.settings.stateBlacklist.length > 0;
    this.stateWhitelist = isWhitelist ? new Set(this.settings.stateWhitelist) : null;
    this.stateBlacklist = isBlacklist ? new Set(this.settings.stateBlacklist) : null;
  }

  drawEachCell(...args) {
    let fn = args.pop();
    let ctx = args.pop() || this.adapter.context;
    ctx.save();
    ctx.globalAlpha = this.globalAlpha;
    ctx.globalCompositeOperation = this.settings.blendMode;
    this.model.eachCell(fn);
    ctx.restore();
  }

  trim(string) {
    let lines = string.split('\n');
    let min = Infinity;
    for (let line of lines) {
      let indent = line.match(/^( *?)[^ ]+$/)
      if (indent) {
        min = Math.min(indent[1].length, min);
      }
    }
    min = min < Infinity ? min : 0;
    return lines.map((e) => e.substring(min)).filter((e) => e.length > 0).join('\n');
  }

  getPivot(q, p=0.5) {
    // Always draw specific step (default 1) when drawStepInterval == 1
    if (this.config.drawStepInterval == this.config.drawDefaultQ)
      return 1;
    // Return q or inverse for 0 or 1 values
    else if (p == 0)
      return (1 - q);
    else if (p == 1)
      return q;
    // Easing functions
    if (typeof p == 'function') {
      return p(q);
    }
    // Single number (original form) or two-element array
    else {
      let [a, b] = typeof p == 'number' ? [p, p] : p;
      if (q < a)
        return q / a;
      else if (q > b)
        return (1 - q) / (1 - b);
      return 1;
    }
  }

  getFade(q, f=this.settings.fadeIndex) {
    return q >= f ? 1 : q / f;
  }

  isAllowedState(state) {
    if (this.stateBlacklist)
      return !this.stateBlacklist.has(state);
    else if (this.stateWhitelist)
      return this.stateWhitelist.has(state);
    else return true;
  }

  to(board) {
    return new this.constructor(board, this.getSettings(), this.name);
  }

  toString() {
    return JSON.stringify([this.constructor.name, this.getSettings(), this.name, this.enabled]);
  }
}