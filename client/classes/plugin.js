class Plugin {
  static restore(board, PluginClass, settings) {
    return new PluginClass(board, settings);
  }

  constructor(board, settings) {
    this.board = board;
    this.model = board.model;
    this.bgAdapter = board.bgAdapter;
    this.fgAdapter = board.fgAdapter;
    this.config = board.config;
    this.saveSettings(settings || this.defaultSettings());
  }

  defaultSettings() {
    return `{}`;
  }

  activate() {

  }

  deactivate() {

  }

  getSettings() {
    return this.settingsString;
  }

  saveSettings(settingsString) {
    let fn = new Function('Board', 'Hexular', 'settings', `return eval('(' + settings + ')');`);
    let settingsObj = fn(Board, Hexular, settingsString);
    if (typeof settingsObj == 'object') {
      this.settingsString = this._trim(settingsString);
      this.settings = settingsObj;
    }
    else {
      throw new Hexular.classes.HexError('Settings string does not evaluate to an object');
    }
  }

  toString() {
    return JSON.stringify([this.constructor.name, this.getSettings()]);
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
    return lines.map((e) => e.substring(min)).filter((e) => e.length > 0).join('\n');
  }

}
