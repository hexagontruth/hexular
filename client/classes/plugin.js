 class Plugin {
  static restore(board, pluginName, settings, name) {
    return new Board.availablePlugins[pluginName](board, settings, name);
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

  static getNewId() {
    Plugin._counter = (Plugin._counter || 0) + 1;
    return Plugin._counter;
  }

  constructor(board, settings, name) {
    this.id = Plugin.getNewId();
    this.name = name || this.constructor.name;
    this.board = board;
    this.model = board.model;
    this.bgAdapter = board.bgAdapter;
    this.adapter = board.adapter;
    this.fgAdapter = board.fgAdapter;
    this.config = board.config;
    this.shared = board.shared;
    this.meta = this.config.meta;
    this.stateWhitelist = null;
    this.stateBlacklist = null;
    this.activated = false;
    this.enabled = false;
    this.fns = [];
    this.globalAlpha = null;
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
    let wrapper = (...args) => {
      let result;
      try {
        result = (this.enabled || undefined) && fn(...args);
      }
      catch (err) {
        this.board.setMessage(err, 'error');
        console.error(err);
      }
      return result;
    };
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
      this.board.hooks[hook] = fns.filter((e) => e.fn.plugin != this);
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
      fn = new Function('Board', 'Hexular', 'Util', 'settings', `return eval('(' + settings + ')');`);
      settingsObj = fn(Board, Hexular, Util, settingsString);
    }
    catch (e) {
      this.board.setMessage(e, 'error');
      throw e;
    }
    if (typeof settingsObj == 'object') {
      this.settingsString = Util.indentTrim(settingsString);
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
    this.stateWhitelist = this.settings.stateWhitelist && new Set(this.settings.stateWhitelist);
    this.stateBlacklist = this.settings.stateBlacklist && new Set(this.settings.stateBlacklist);
  }

  drawEachCell(...args) {
    let fn = args.pop();
    let ctx = args.pop() || this.adapter.context;
    ctx.save();
    ctx.globalAlpha = this.globalAlpha != null ? this.globalAlpha : this.config.alpha;
    ctx.globalCompositeOperation = this.settings.blendMode;
    this.model.eachCell(fn);
    ctx.restore();
  }

  getPivot(q=this.board.drawStepQ, p=0.5) {
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

  getFade(q=this.board.drawStepQ, f=this.settings.fadeIndex) {
    if (f == null)
      f = 1;
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
