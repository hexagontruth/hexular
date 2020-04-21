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
    this.fgAdapter = board.fgAdapter;
    this.config = board.config;
    this.saveSettings(settings || this.defaultSettings());
    this.stateWhitelist = null;
    this.stateBlacklist = null;
    this.activated = false;
    this.enabled = false;
    this.fns = [];
  }

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

  _activate() {}

  _deactivate() {}

  _enable() {}

  _disable() {}

  registerFunction(fn) {
    let wrapper = (...args) => (this.enabled || undefined) && fn(...args);
    this.fns.push(wrapper);
    return wrapper;
  }

  registerBoardHook(hook, fn) {
    let wrapper = this.registerFunction(fn);
    wrapper.plugin = this;
    this.board.addHook(hook, wrapper);
  }

  registerAdapterHook(hookList, fn) {
    let wrapper = this.registerFunction(fn);
    wrapper.plugin = this;
    hookList.push(wrapper);
  }

  deleteHooks() {
    // TODO: Fix this whole thing
    Object.entries(this.board.hooks).forEach(([hook, fns]) => {
      this.board.hooks[hook] = fns.filter((e) => e.plugin != this);
    });
    let bgAdapter = this.bgAdapter;
    let fgAdapter = this.fgAdapter;
    let hookLists = [bgAdapter.onDraw, bgAdapter.onDrawCell, fgAdapter.onDraw, fgAdapter.onDrawCell];
    for (let hookList of hookLists)
      hookList.keep((e) => e.plugin != this);
    this.fns = [];
  }

  getSettings() {
    return this.settingsString;
  }

  getPolicy() {
    return Config.merge({}, Plugin.policy, this.constructor.policy());
  }

  saveSettings(settingsString) {
    let fn = new Function('Board', 'Hexular', 'settings', `return eval('(' + settings + ')');`);
    let settingsObj = fn(Board, Hexular, settingsString);
    if (typeof settingsObj == 'object') {
      this.settingsString = this._trim(settingsString);
      this.settings = settingsObj;
      this._onSaveSettings && this._onSaveSettings();
    }
    else {
      throw new Hexular.classes.HexError('Settings string does not evaluate to an object');
    }
  }

  setStateLists() {
    let isWhitelist = this.settings.stateWhitelist && this.settings.stateWhitelist.length > 0;
    let isBlacklist = this.settings.stateBlacklist && this.settings.stateBlacklist.length > 0;
    this.stateWhitelist = isWhitelist ? new Set(this.settings.stateWhitelist) : null;
    this.stateBlacklist = isBlacklist ? new Set(this.settings.stateBlacklist) : null;
  }

  to(board) {
    return new this.constructor(board, this.getSettings(), this.name);
  }

  toString() {
    return JSON.stringify([this.constructor.name, this.getSettings(), this.name]);
  }

  _trim(string) {
    let lines = string.split('\n');
    let min = Infinity;
    for (let line of lines) {
      let indent = line.match(/^( +?)[^ ]+$/)
      if (indent) {
        min = Math.min(indent[1].length, min);
      }
    }
    min = min < Infinity ? min : 0;
    return lines.map((e) => e.substring(min)).filter((e) => e.length > 0).join('\n');
  }

  _getPivot(q, p=0.5) {
    if (this.config.drawStepInterval == 1)
      return 1;
    else if (p == 0)
      return (1 - q);
    else if (p == 1)
      return q;
    return (q < p ? q / p : (1 - q) / (1 - p));
  }

  _isAllowedState(state) {
    if (this.stateBlacklist)
      return !this.stateBlacklist.has(state);
    else if (this.stateWhitelist)
      return this.stateWhitelist.has(state);
    else return true;
  }
}
