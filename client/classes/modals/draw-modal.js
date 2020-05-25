class DrawModal extends Modal {
  constructor(...args) {
    super(...args);
    this.defaultInterval = Config.defaults.interval;
    this.radius = this.defaultRadius = Config.defaults.radius;
    this.drawButtons = {
      sortCellsAsc: document.querySelector('#sort-cells-asc'),
      sortCellsDesc: document.querySelector('#sort-cells-desc'),
      drawFilledPointyHex: document.querySelector('#draw-filled-pointy-hex'),
      drawOutlinePointyHex: document.querySelector('#draw-outline-pointy-hex'),
      drawFilledFlatHex: document.querySelector('#draw-filled-flat-hex'),
      drawOutlineFlatHex: document.querySelector('#draw-outline-flat-hex'),
      drawFilledCircle: document.querySelector('#draw-filled-circle'),
      drawOutlineCircle: document.querySelector('#draw-outline-circle'),
    };
    this.sortFunctions = ['sortCellsAsc', 'sortCellsDesc'];
    this.autopause = document.querySelector('#autopause');
    this.clearOnDraw = document.querySelector('#clear-on-draw');
    this.drawModelBackground = document.querySelector('#draw-model-background');
    this.interval = document.querySelector('#interval-slider');
    this.intervalIndicator = document.querySelector('#interval-indicator');
    this.drawStepInterval = document.querySelector('#draw-step-slider');
    this.drawStepIndicator = document.querySelector('#draw-step-indicator');
    this.fadeIndex = document.querySelector('#fade-index-slider');
    this.fadeIndicator = document.querySelector('#fade-indicator');
    this.zoom = document.querySelector('#zoom-slider');
    this.zoomIndicator = document.querySelector('#zoom-indicator');
    this.scaleFactor = document.querySelector('#scale-slider');
    this.scaleIndicator = document.querySelector('#scale-indicator');
    this.selectPlugin = document.querySelector('#select-plugin').select;
    this.addPlugin = document.querySelector('#add-plugin');
    this.pluginList = document.querySelector('#plugin-list');
    this.pluginEditor = document.querySelector('#plugin-editor');

    Object.entries(this.drawButtons).forEach(([fnName, button]) => button.onclick = () => this._setOnDraw(fnName));
    this.autopause.onclick = (ev) => this.config.setAutopause(!this.config.autopause);
    this.clearOnDraw.onclick = (ev) => this.config.setClearOnDraw(!this.config.clearOnDraw);
    this.drawModelBackground.onclick = (ev) => this.config.setDrawModelBackground(!this.config.drawModelBackground);
    this.interval.oninput = (ev) => this.config.setInterval(this.interval.value);
    this.drawStepInterval.oninput = (ev) => this.config.setDrawStepInterval(this.drawStepInterval.value);
    this.fadeIndex.oninput = (ev) => this.config.setFadeIndex(this.fadeIndex.value);
    this.zoom.oninput = (ev) => this.config.setZoom(this.zoom.value);
    this.scaleFactor.oninput = (ev) => this.config.setScaleFactor(this.scaleFactor.value);
    this.selectPlugin.onchange = (ev) => this.updatePlugins();
    this.addPlugin.onclick = (ev) => this._addPlugin(this.selectPlugin.value);

    this.addRestoreBox(() => {
      this.config.setAutopause(true);
      this.config.setClearOnDraw(true);
      this.config.setDrawModelBackground(true);
      this.config.resetOnDraw();
      this.config.setInterval(Config.defaults.interval);
      this.config.setDrawStepInterval(Config.defaults.drawStepInterval);
      this.config.setFadeIndex(Config.defaults.fadeIndex);
      this.config.setZoom(Config.defaults.zoom);
      this.config.setScaleFactor(Config.defaults.scaleFactor);
    });
  }

  reset() {
    this.updateAutopause();
    this.updateClearOnDraw();
    this.updateDrawModelBackground();
    this.updateInterval();
    this.updateDrawStepInterval();
    this.updateFadeIndex();
    this.updateZoom();
    this.updatePlugins();
  }

  update() {
    this.selectPlugin.replace(Object.keys(Board.plugins), this.selectPlugin.value, 1);
  }

  updateAutopause() {
    this.autopause.classList.toggle('active', this.config.autopause);
  }

  updateClearOnDraw() {
    this.clearOnDraw.classList.toggle('active', this.config.clearOnDraw);
  }

  updateDrawModelBackground() {
    this.drawModelBackground.classList.toggle('active', this.config.drawModelBackground);
  }

  updateInterval() {
    this.interval.value = this.config.interval;
    this.intervalIndicator.innerHTML = this.config.interval;
  }

  updateDrawStepInterval() {
    this.drawStepInterval.value = this.config.drawStepInterval;
    this.drawStepIndicator.innerHTML = this.config.drawStepInterval;
  }

  updateFadeIndex() {
    this.fadeIndex.value = this.config.fadeIndex;
    this.fadeIndicator.innerHTML = this.config.fadeIndex;
  }

  updateZoom() {
    this.zoom.value = this.config.zoom;
    this.zoomIndicator.innerHTML = this.config.zoom;
  }

  updateScaleFactor() {
    this.scaleFactor.value = this.config.scaleFactor;
    this.scaleIndicator.innerHTML = this.config.scaleFactor;
  }

  _setOnDraw(fnName) {
    let lastState = this.config.drawFunctions[fnName];
    this.config.setOnDraw(fnName, !lastState);
    // TODO: This is still hacky but somewhat less so than alternative
    if (this.sortFunctions.includes(fnName) && lastState)
      this.model.sortCells();
    this.board.draw();
  }



  _addPlugin(pluginName) {
    let plugin = new PluginControl(this.board, pluginName);
    plugin && this.board.setMessage(`Added ${pluginName} plugin!`);
  }

  updatePlugins() {
    this.addPlugin.disabled = !this.selectPlugin.value;
  }
}
