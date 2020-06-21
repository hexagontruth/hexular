class ThemeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.selectTheme = document.querySelector('#select-theme').select;
    this.addTheme = document.querySelector('#add-theme');

    this.colors = Array.from(document.querySelectorAll('#color-controllers input'));
    this.backgroundColor = document.querySelector('#page-bg');
    this.modelBackgroundColor = document.querySelector('#model-bg');
    this.defaultColor = document.querySelector('#default-color');
    this.selectBlendMode = document.querySelector('#select-blend').select;
    this.alpha = document.querySelector('#alpha');
    this.cellGap = document.querySelector('#cell-gap');
    this.cellBorderWidth = document.querySelector('#cell-border-width');

    this.colors.forEach((el, idx) => {
      el.onchange = () => this.config.setColor(idx, el.value);
    });
    ['backgroundColor', 'modelBackgroundColor', 'defaultColor'].forEach((key) => {
      let el = this[key];
      el.onchange = () => this.config.setColorProperty(key, el.value);
    });
    this.selectBlendMode.onchange = (ev) => this._setBlendMode(this.selectBlendMode.value);
    this.alpha.onchange = (ev) => this._setAlpha(this.alpha.value);
    this.cellGap.onchange = (ev) => this._setCellGap(this.cellGap.value);
    this.cellBorderWidth.onchange = (ev) => this._setCellBorderWidth(this.cellBorderWidth.value);

    this.selectTheme.onchange = (ev) => this._handleSelectTheme();
    this.addTheme.onclick = (ev) => this._handleAddTheme();
  }

  reset() {
    this.selectTheme.value = this.config.theme;
    this._setAlpha(this.config.alpha);
    this._setBlendMode(this.config.blendMode);
    this._setCellGap(this.config.cellGap);
    this._setCellBorderWidth(this.config.cellBorderWidth);
  }

  update() {
    let themeNames = Object.keys(this.config.themes).sort();
    let defaultIdx = themeNames.indexOf('default');
    if (defaultIdx > 0) {
      themeNames.splice(defaultIdx, 1);
      themeNames.unshift('default');
    }
    this.selectTheme.replace(themeNames, this.config.theme, 1);
    for (let i = 0; i < this.colors.length; i++) {
      let color = this.colors[i];
      if (i < this.config.maxNumStates)
        color.classList.remove('hidden');
      else
        color.classList.add('hidden');
    }
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

  _setAlpha(value) {
    this.config.setAlpha(value != null ? value : this.config.alpha);
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
