class ResizeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.defaultInterval = Config.defaults.interval;
    this.radius = this.defaultRadius = Config.defaults.radius;
    this.onDraw = {
      sortCellsAsc: document.querySelector('#sort-cells-asc'),
      sortCellsDesc: document.querySelector('#sort-cells-desc'),
    };
    this.onDrawCell = {
      drawFilledHex: document.querySelector('#draw-filled-hex'),
      drawOutlineHex: document.querySelector('#draw-outline-hex'),
      drawFilledCircle: document.querySelector('#draw-filled-circle'),
      drawOutlineCircle: document.querySelector('#draw-outline-circle'),
    };
    this.autopause = document.querySelector('#autopause');
    this.cellGap = document.querySelector('#cell-gap');
    this.cellBorderWidth = document.querySelector('#cell-border-width');
    this.theme = document.querySelector('#select-theme').select;
    this.interval = document.querySelector('#interval-slider');
    this.intervalIndicator = document.querySelector('#interval-indicator');
    this.resize = document.querySelector('#resize-slider');
    this.resizeIndicator = document.querySelector('#resize-indicator');

    Object.entries(this.onDraw).forEach(([fnName, button]) => button.onclick = () => this._setOnDraw(fnName));
    Object.entries(this.onDrawCell).forEach(([fnName, button]) => button.onclick = () => this._setOnDrawCell(fnName));
    this.autopause.onclick = (ev) => this._setAutopause(!this.config.autopause);
    this.cellGap.onchange = (ev) => this._setCellGap(this.cellGap.value);
    this.cellBorderWidth.onchange = (ev) => this._setCellBorderWidth(this.cellBorderWidth.value);
    this.set = document.querySelector('#resize-set');
    this.theme.onchange = (ev) => this._selectTheme();
    this.interval.oninput = (ev) => this._updateInterval(this.interval.value);
    this.resize.oninput = (ev) => this._updateResize(this.resize.value);
    this.set.onclick = (ev) => this._resize();
  }

  reset() {
    this.theme.value = this.config.theme;
    this._setAutopause();
    this._setCellGap();
    this._setCellBorderWidth();
    this._setOnDraw();
    this._setOnDrawCell();
    this.resize.value = this.config.radius;
    this.interval.value = this.config.interval;
    this._updateInterval();
    this._updateResize();
  }

  update() {
    this.theme.replace(Object.keys(this.config.themes).sort(), this.config.theme);
  }

  _setAutopause(value) {
    this.config.setAutopause(value != null ? value : this.config.autopause);
  }

  _setCellGap(value) {
    this.config.setCellGap(value);
    this.board.draw();
  }

  _setCellBorderWidth(value) {
    this.config.setCellBorderWidth(value);
    this.board.draw();
  }

  _setOnDraw(fnName) {
    if (this.config.onDraw == fnName)
      this.config.setOnDraw();
    else
      this.config.setOnDraw(fnName || this.config.onDraw);
    this.board.draw();
  }

  _setOnDrawCell(fnName) {
    this.config.setOnDrawCell(fnName);
    this.board.draw();
  }

  _selectTheme() {
    this.config.setTheme(this.theme.value);
  }

  _updateInterval(value) {
    if (value != null)
      this.config.interval = parseInt(value) || this.defaultInterval;
    this.intervalIndicator.innerHTML = this.config.interval;
  }

  _updateResize(value) {
    if (value != null)
      this.radius = parseInt(value) || this.defaultRadius;
    else
      this.radius = this.config.radius;

    this.resizeIndicator.innerHTML = this.radius;
    this.set.innerHTML =
      `<i class="icon-arrow-top-right-bottom-left"></i> Resize (${this.radius * (this.radius - 1) * 3 + 1} cells)`;
  }

  _resize() {
    this.config.resize(this.radius);
    Board.instance.setMessage(`Set board size to ${Board.config.radius}`);
  }
}