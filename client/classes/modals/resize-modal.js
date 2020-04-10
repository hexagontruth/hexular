class ResizeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.radius = this.defaultRadius = Config.defaults.radius;
    this.resize = document.querySelector('#resize-slider');
    this.resizeIndicator = document.querySelector('#resize-indicator');
    this.resizeButton = document.querySelector('#resize-set');

    this.resize.oninput = (ev) => this._updateResize(this.resize.value);
    this.resizeButton.onclick = (ev) => this._resize();
  }

  reset() {
    this._updateResize();
  }

  _updateResize(value) {
    if (value != null)
      this.radius = parseInt(value) || this.defaultRadius;
    else
      this.radius = this.config.radius;
    this.resizeIndicator.innerHTML = this.radius;
    let labelMatch = this.resizeButton.innerHTML.match(/^(.+?)([\d\,\.]+)(.+?)$/);
    if (labelMatch) {
      let cells = this.radius * (this.radius - 1) * 3 + 1;
      let newLabel = labelMatch[1] + cells.toLocaleString() + labelMatch[3];
      this.resizeButton.innerHTML = newLabel;
    }
  }

  _resize() {
    this.config.resize(this.radius);
    Board.instance.setMessage(`Set board size to ${Board.config.radius}`);
  }
}
