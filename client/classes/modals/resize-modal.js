class ResizeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.radius = this.defaultRadius = Config.defaults.radius;
    this.resize = document.querySelector('#resize-slider');
    this.theme = document.querySelector('#select-theme').select;
    this.set = document.querySelector('#resize-set');
    this.theme.onchange = (ev) => this._selectTheme();
    this.resize.onchange = (ev) => this._updateInfo();
    this.set.onclick = (ev) => this._resize();
  }

  reset() {
    this.resize.value = this.config.radius;
    this.theme.value = this.config.theme;
    this._updateInfo();
  }

  update() {
    this.theme.replace(Object.keys(this.config.themes).sort(), this.config.theme);
  }

  _selectTheme() {
    this.config.setTheme(this.theme.value);
  }

  _updateInfo() {
    let radius = this.radius = parseInt(this.resize.value) || this.defaultRadius;
    this.set.innerHTML = `<i class="icon-arrow-top-right-bottom-left"></i> ${radius} (${radius * (radius - 1) * 3 + 1} cells)`;
  }

  _resize() {
    this.config.resize(this.radius);
    Board.instance.setMessage(`Set board size to ${Board.config.radius}`);
  }
}