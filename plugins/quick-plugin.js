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
          onEnable: () => {},
          onDisable: () => {},
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
    this.registerHook('draw', this.callFn('onDraw'));
    this.registerHook('drawCell', this.callFn('onDrawCell'));
    this.registerHook('step', this.callFn('onStep'));
    this.registerHook('select', this.callFn('onSelect'));
    this.registerHook('debugSelect', this.callFn('onDebugSelect'));
    this.registerHook('paint', this.callFn('onPaint'));
    this.registerHook('updatePreset', this.callFn('onUpdatePreset'));
    this.registerHook('updateTheme', this.callFn('onUpdateTheme'));
  }

  _enable() {
    this.callFn('onEnable')();
  }

  _disable() {
    this.callFn('onDisable')();
  }

  callFn(key) {
    return (...args) => this.hooks[key] && this.hooks[key](...args);
  }
}
Board.registerPlugin(QuickPlugin);
