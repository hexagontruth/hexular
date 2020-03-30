class DrawModal extends Modal {
  constructor(...args) {
    super(...args);
    this.defaultInterval = Config.defaults.interval;
    this.radius = this.defaultRadius = Config.defaults.radius;
    this.drawButtons = {
      drawModelBackground: document.querySelector('#draw-model-background'),
      sortCellsAsc: document.querySelector('#sort-cells-asc'),
      sortCellsDesc: document.querySelector('#sort-cells-desc'),
      drawFilledPointyHex: document.querySelector('#draw-filled-pointy-hex'),
      drawOutlinePointyHex: document.querySelector('#draw-outline-pointy-hex'),
      drawFilledFlatHex: document.querySelector('#draw-filled-flat-hex'),
      drawOutlineFlatHex: document.querySelector('#draw-outline-flat-hex'),
      drawFilledCircle: document.querySelector('#draw-filled-circle'),
      drawOutlineCircle: document.querySelector('#draw-outline-circle'),
    };
    this.autopause = document.querySelector('#autopause');
    this.drawSteps = document.querySelector('#draw-step-slider');
    this.drawStepIndicator = document.querySelector('#draw-step-indicator');
    this.interval = document.querySelector('#interval-slider');
    this.intervalIndicator = document.querySelector('#interval-indicator');
    this.scale = document.querySelector('#scale-slider');
    this.scaleIndicator = document.querySelector('#scale-indicator');
    this.scaleMin = parseFloat(this.scale.min);
    this.scaleMax = parseFloat(this.scale.max);
    this.selectPlugin = document.querySelector('#select-plugin').select;
    this.addPlugin = document.querySelector('#add-plugin');
    this.pluginList = document.querySelector('#plugin-list');
    this.pluginEditor = document.querySelector('#plugin-editor');

    Object.entries(this.drawButtons).forEach(([fnName, button]) => button.onclick = () => this._setDraw(fnName));
    this.drawSteps.oninput = (ev) => this._setDrawSteps(this.drawSteps.value);
    this.autopause.onclick = (ev) => this._setAutopause(!this.config.autopause);
    this.interval.oninput = (ev) => this._updateInterval(this.interval.value);
    this.scale.oninput = (ev) => this._updateScale(this.scale.value);
    this.selectPlugin.onchange = (ev) => this._updatePlugins();
    this.addPlugin.onclick = (ev) => this._addPlugin(this.selectPlugin.value);
  }

  reset() {
    this._setDrawSteps(this.config.drawStepInterval);
    this._setAutopause();
    this._setDraw();
    this.interval.value = this.config.interval;
    this._updateInterval();
    this._updateScale(this.config.defaultScale);
    this._updatePlugins();
  }

  update() {
    this.selectPlugin.replace(Object.keys(Board.plugins), this.selectPlugin.value, 1);
  }

  _setDrawSteps(value) {
    this.config.setDrawStepInterval(parseFloat(value || this.config.drawStepInterval));
    this.drawStepIndicator.innerHTML = this.config.drawStepInterval;
  }

  _setAutopause(value) {
    this.config.setAutopause(value != null ? value : this.config.autopause);
  }

  _setDraw(fnName) {
    this.config.setDraw(fnName, !this.config.drawFunctions[fnName]);
    this.board.draw();
  }

  _updateInterval(value) {
    if (value != null)
      this.config.interval = parseInt(value) || this.defaultInterval;
    this.intervalIndicator.innerHTML = this.config.interval;
  }

  _updateScale(value) {
    value = parseFloat(value);
    if (value != this.config.defaultScale)
      this.config.setDefaultScale(value || 1);
  }

  _addPlugin(pluginName) {
    let plugin = new PluginControl(this.board, pluginName);
    plugin && this.board.setMessage(`Added ${pluginName} plugin!`);
  }

  _updatePlugins() {
    this.addPlugin.disabled = !this.selectPlugin.value;
  }
}
