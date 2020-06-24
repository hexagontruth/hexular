class QuickPlugin extends Plugin {
  defaultSettings() {
    return `
      {
        hooks: (plugin) => ({
          onDraw: (adapter) => {
            let opts = {
              type: Hexular.enums.TYPE_POINTY,
              fill: true,
              stroke: false,
              fillStyle: null,
              strokeStyle: null,
              lineWidth: plugin.config.cellBorderWidth,
              lineJoin: 'miter',
            };
            let radius = plugin.config.innerRadius;
            plugin.drawEachCell((cell) => {
              if (!plugin.isAllowedState(cell.state)) return;
              opts.fillStyle = plugin.config.fillColors[cell.state];
              plugin.adapter.drawShape(cell, radius, opts);
            });
          },
          onDrawCell: (cell, adapter) => {},
          onStep: () => {},
          onSelect: (cell) => {},
          onDebugSelect: (cell) => {},
          onPaint: (cells) => {},
          onUpdatePreset: () => {},
          onUpdateTheme: () => {},
        }),
        stateWhitelist: null,
        stateBlacklist: null,
      }
    `;
  }

  _onSaveSettings() {
    this.hooks = this.settings.hooks && this.settings.hooks(this);
    this.board.draw();
  }

  _activate() {
    let callFn = (key) => (...args) => this.hooks[key] && this.hooks[key](...args);
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
