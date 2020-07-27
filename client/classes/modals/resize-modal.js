class ResizeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.order = this.defaultRadius = Config.defaults.order;
    this.resize = document.querySelector('#resize-slider');
    this.resizeIndicator = document.querySelector('#resize-indicator');
    this.resizeButton = document.querySelector('#resize-set');

    this.resize.oninput = (ev) => this._updateResize(this.resize.value);
    this.resizeButton.onclick = (ev) => this._resize();

    this.addRestoreBox(() => {
      this._updateResize(this.defaultRadius);
    });
  }

  reset() {
    this._updateResize();
  }

  _updateResize(value) {
    if (value != null)
      this.order = value != null ? parseInt(value) : this.defaultRadius;
    else
      this.order = this.config.order;
    this.resize.value = this.order;
    this.resizeIndicator.innerHTML = this.order;
    let labelMatch = this.resizeButton.innerHTML.match(/^(.+?)([\d\,\.]+)(.+?)$/);
    if (labelMatch) {
      let cells = this.order * (this.order + 1) * 3 + 1;
      let newLabel = labelMatch[1] + cells.toLocaleString() + labelMatch[3];
      this.resizeButton.innerHTML = newLabel;
    }
  }

  _resize() {
    this.config.resize(this.order);
    Board.instance.setMessage(`Set board size to ${Board.config.order}`);
  }
}
