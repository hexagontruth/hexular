class ResizeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.defaultInterval = Config.defaults.interval;
    this.radius = this.defaultRadius = Config.defaults.radius;
    this.colors = Array.from(document.querySelectorAll('.group.color input')).slice(2);
    this.pageBackground = document.querySelector('#page-bg');
    this.modelBackground = document.querySelector('#model-bg');
    this.onDraw = {
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
    this.cellGap = document.querySelector('#cell-gap');
    this.cellBorderWidth = document.querySelector('#cell-border-width');
    this.selectTheme = document.querySelector('#select-theme').select;
    this.addTheme = document.querySelector('#add-theme');
    this.interval = document.querySelector('#interval-slider');
    this.intervalIndicator = document.querySelector('#interval-indicator');
    this.scale = document.querySelector('#scale-slider');
    this.scaleIndicator = document.querySelector('#scale-indicator');
    this.scaleMin = parseFloat(this.scale.min);
    this.scaleMax = parseFloat(this.scale.max);
    this.resize = document.querySelector('#resize-slider');
    this.resizeIndicator = document.querySelector('#resize-indicator');

    this.colors.forEach((el, idx) => {
      let pickerClosed = false;
      el.setAttribute('title', `Color ${idx}`);
      el.onchange = () => this.config.setColor(idx, el.value);
      el.onfocus = el.onclick = () => pickerClosed = false;
      el.onkeydown = (ev) => {
        if (ev.key == 'Escape' && !pickerClosed) {
          el.jscolor.hide();
          pickerClosed = true;
          ev.stopPropagation();
        }
      }
    });
    ['pageBackground', 'modelBackground'].forEach((key) => {
      let pickerClosed = false;
      let el = this[key];
      el.onchange = () => this.config.setBackground(key, el.value);
      el.onfocus = el.onclick = () => pickerClosed = false;
      el.onkeydown = (ev) => {
        if (ev.key == 'Escape' && !pickerClosed) {
          el.jscolor.hide();
          pickerClosed = true;
          ev.stopPropagation();
        }
      }
    });
    Object.entries(this.onDraw).forEach(([fnName, button]) => button.onclick = () => this._setOnDraw(fnName));
    Object.entries(this.onDrawCell).forEach(([fnName, button]) => button.onclick = () => this._setOnDrawCell(fnName));
    this.autopause.onclick = (ev) => this._setAutopause(!this.config.autopause);
    this.cellGap.onchange = (ev) => this._setCellGap(this.cellGap.value);
    this.cellBorderWidth.onchange = (ev) => this._setCellBorderWidth(this.cellBorderWidth.value);
    this.set = document.querySelector('#resize-set');
    this.selectTheme.onchange = (ev) => this._handleSelectTheme();
    this.addTheme.onclick = (ev) => this._handleAddTheme();
    this.interval.oninput = (ev) => this._updateInterval(this.interval.value);
    this.scale.oninput = (ev) => this._updateScale(this.scale.value);
    this.resize.oninput = (ev) => this._updateResize(this.resize.value);
    this.set.onclick = (ev) => this._resize();
  }

  reset() {
    this.selectTheme.value = this.config.theme;
    this._setAutopause();
    this._setCellGap();
    this._setCellBorderWidth();
    this._setOnDraw();
    this._setOnDrawCell();
    this.resize.value = this.config.radius;
    this.interval.value = this.config.interval;
    this._updateInterval();
    this._updateScale(this.config.defaultScale);
    this._updateResize();
  }

  update() {
    this.selectTheme.replace(Object.keys(this.config.themes).sort(), this.config.theme, 1);
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

  _handleSelectTheme() {
    this.config.setTheme(this.selectTheme.value);
  }

  _handleAddTheme() {
    // TODO: Replace native prompt
    let themeName = window.prompt('Please enter a theme name:');
    if (themeName) {
      this.config.addTheme(themeName, this.config);
      this.config.setTheme(themeName);
    }
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