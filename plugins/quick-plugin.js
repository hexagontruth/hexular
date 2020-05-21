class QuickPlugin extends Plugin {
  defaultSettings() {
    return `
      {
        onDraw: (adapter) => {},
        onDrawCell: (cell, adapter) => {},
        onStep: () => {},
        onSelect: (cell) => {},
        onDebugSelect: (cell) => {},
        onPaint: (cells) => {},
        onUpdatePreset: () => {},
        onUpdateTheme: () => {},
      }
    `;
  }
  _activate() {
    let callFn = (key) => (...args) => this.settings[key] && this.settings[key](...args);
    this.registerHook('draw', callFn('onDraw'));
    this.registerHook('drawCell', callFn('onDrawCell'));
    this.registerHook('step', callFn('onStep'));
    this.registerHook('select', callFn('onSelect'));
    this.registerHook('debugSelect', callFn('onDebugSelect'));
    this.registerHook('paint', callFn('onPaint'));
    this.registerHook('updatePreset', callFn('onUpdatePreset'));
    this.registerHook('updateTheme', callFn('onUpdateTheme'));
  }
}
Board.registerPlugin(QuickPlugin);
