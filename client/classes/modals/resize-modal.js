class ResizeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.defaultInterval = Config.defaults.interval;
    this.radius = this.defaultRadius = Config.defaults.radius;
    this.theme = document.querySelector('#select-theme').select;
    this.interval = document.querySelector('#interval-slider');
    this.intervalIndicator = document.querySelector('#interval-indicator');
    this.resize = document.querySelector('#resize-slider');
    this.resizeIndicator = document.querySelector('#resize-indicator');

    this.set = document.querySelector('#resize-set');
    this.theme.onchange = (ev) => this._selectTheme();
    this.interval.onchange = (ev) => this._updateInterval(this.interval.value);
    this.resize.onchange = (ev) => this._updateResize(this.resize.value);
    this.set.onclick = (ev) => this._resize();
  }

  reset() {
    this.theme.value = this.config.theme;
    this.resize.value = this.config.radius;
    this.interval.value = this.config.interval;
    this._updateInterval();
    this._updateResize();
  }

  update() {
    this.theme.replace(Object.keys(this.config.themes).sort(), this.config.theme);
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
    this.resizeIndicator.innerHTML = this.radius;
    this.set.innerHTML =
      `<i class="icon-arrow-top-right-bottom-left"></i> Resize (${this.radius * (this.radius - 1) * 3 + 1} cells)`;
  }

  _resize() {
    this.config.resize(this.radius);
    Board.instance.setMessage(`Set board size to ${Board.config.radius}`);
  }
}