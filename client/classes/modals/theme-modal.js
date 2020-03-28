class ThemeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.selectTheme = document.querySelector('#select-theme').select;
    this.addTheme = document.querySelector('#add-theme');

    this.colors = Array.from(document.querySelectorAll('.group.color input')).slice(2);
    this.pageBackground = document.querySelector('#page-bg');
    this.modelBackground = document.querySelector('#model-bg');
    this.selectBlendMode = document.querySelector('#select-blend').select;
    this.cellGap = document.querySelector('#cell-gap');
    this.cellBorderWidth = document.querySelector('#cell-border-width');

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
    this.selectBlendMode.onchange = (ev) => this._setBlendMode(this.selectBlendMode.value);
    this.cellGap.onchange = (ev) => this._setCellGap(this.cellGap.value);
    this.cellBorderWidth.onchange = (ev) => this._setCellBorderWidth(this.cellBorderWidth.value);

    this.selectTheme.onchange = (ev) => this._handleSelectTheme();
    this.addTheme.onclick = (ev) => this._handleAddTheme();
  }

  reset() {
    this.selectTheme.value = this.config.theme;
    this._setBlendMode(this.config.blendMode);
    this._setCellGap(this.config.cellGap);
    this._setCellBorderWidth(this.config.cellBorderWidth);
  }

  update() {
    this.selectTheme.replace(Object.keys(this.config.themes).sort(), this.config.theme, 1);
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

  _setBlendMode(value) {
    this.config.setBlendMode(value != null ? value : this.config.blendMode);
  }

  _setCellGap(value) {
    this.config.setCellGap(parseFloat(value || 0));
    this.board.draw();
  }

  _setCellBorderWidth(value) {
    this.config.setCellBorderWidth(parseFloat(value || 0));
    this.board.draw();
  }
}
