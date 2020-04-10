class QuickPlugin extends Plugin {
  defaultSettings() {
    return `
      {
        onDraw: (adapter) => {},
        onDrawCell: (cell, adapter) => {},
      }
    `;
  }

  _activate() {
    let onDrawFn = (...args) => this.settings.onDraw && this.settings.onDraw(...args);
    let onDrawCellFn = (...args) => this.settings.onDrawCell && this.settings.onDrawCell(...args);
    this.registerAdapterHook(this.bgAdapter.onDraw, onDrawFn);
    this.registerAdapterHook(this.bgAdapter.onDrawCell, onDrawCellFn);
  }
}
Board.registerPlugin(QuickPlugin);
