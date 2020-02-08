class ResizeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.radius = this.defaultRadius = DEFAULTS.radius;
    this.slider = document.querySelector('#resize-slider');
    this.default = document.querySelector('#resize-default');
    this.set = document.querySelector('#resize-set');
    this.slider.onchange = (ev) => this._updateInfo();
    this.set.onclick = (ev) => this._resize();
  }

  reset() {
    this.slider.value = this.config.radius;
    this._updateInfo();
  }

  _updateInfo() {
    let radius = this.radius = parseInt(this.slider.value) || this.defaultRadius;
    this.set.innerHTML = `${radius} (${radius * (radius - 1) * 3 + 1} cells)`;
  }

  _resize() {
    this.config.setRadius(this.radius);
    Board.instance.setMessage(`Set board size to ${Board.config.radius}`);
  }
}