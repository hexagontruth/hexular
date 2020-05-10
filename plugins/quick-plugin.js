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
    this.registerAdapterHook(this.bgAdapter.onDraw, callFn('onDraw'));
    this.registerAdapterHook(this.bgAdapter.onDrawCell, callFn('onDrawCell'));
    this.registerBoardHook('step', callFn('onStep'));
    this.registerBoardHook('select', callFn('onSelect'));
    this.registerBoardHook('debugSelect', callFn('onDebugSelect'));
    this.registerBoardHook('paint', callFn('onPaint'));
    this.registerBoardHook('updatePreset', callFn('onUpdatePreset'));
    this.registerBoardHook('updateTheme', callFn('onUpdateTheme'));
  }
}
Board.registerPlugin(QuickPlugin);
