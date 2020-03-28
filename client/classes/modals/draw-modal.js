class DrawModal extends Modal {
  constructor(...args) {
    super(...args);
    this.defaultInterval = Config.defaults.interval;
    this.radius = this.defaultRadius = Config.defaults.radius;
    this.onDraw = {
      drawModelBackground: document.querySelector('#draw-model-background'),
      sortCellsAsc: document.querySelector('#sort-cells-asc'),
      sortCellsDesc: document.querySelector('#sort-cells-desc'),
    };
    this.onDrawCell = {
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

    Object.entries(this.onDraw).forEach(([fnName, button]) => button.onclick = () => this._setOnDraw(fnName));
    Object.entries(this.onDrawCell).forEach(([fnName, button]) => button.onclick = () => this._setOnDrawCell(fnName));
    this.drawSteps.oninput = (ev) => this._setDrawSteps(this.drawSteps.value);
    this.autopause.onclick = (ev) => this._setAutopause(!this.config.autopause);
    this.interval.oninput = (ev) => this._updateInterval(this.interval.value);
    this.scale.oninput = (ev) => this._updateScale(this.scale.value);
  }

  reset() {
    this._setDrawSteps(this.config.drawStepInterval);
    this._setAutopause();
    this._setOnDraw();
    this._setOnDrawCell();
    this.interval.value = this.config.interval;
    this._updateInterval();
    this._updateScale(this.config.defaultScale);
  }

  update() {
  }

  _setDrawSteps(value) {
    this.config.setDrawStepInterval(parseFloat(value || this.config.drawStepInterval));
    this.drawStepIndicator.innerHTML = this.config.drawStepInterval;
  }

  _setAutopause(value) {
    this.config.setAutopause(value != null ? value : this.config.autopause);
  }

  _setOnDraw(fnName) {
    this.config.setOnDraw(fnName, !this.config.onDraw[fnName]);
    this.board.draw();
  }

  _setOnDrawCell(fnName) {
    this.config.setOnDrawCell(fnName || this.config.onDrawCell);
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

}
