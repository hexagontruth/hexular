class DrawModal extends Modal {
  constructor(...args) {
    super(...args);
    this.defaultInterval = Config.defaults.interval;
    this.radius = this.defaultRadius = Config.defaults.radius;
    this.drawButtons = {
      drawModelBackground: document.querySelector('#draw-model-background'),
      sortCellsAsc: document.querySelector('#sort-cells-asc'),
      sortCellsDesc: document.querySelector('#sort-cells-desc'),
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
    this.selectPlugin = document.querySelector('#select-plugin').select;
    this.addPlugin = document.querySelector('#add-plugin');
    this.pluginList = document.querySelector('#plugin-list');
    this.pluginEditor = document.querySelector('#plugin-editor');
    this.pluginControllers = [];

    Object.entries(this.drawButtons).forEach(([fnName, button]) => button.onclick = () => this._setDraw(fnName));
    this.drawSteps.oninput = (ev) => this._setDrawSteps(this.drawSteps.value);
    this.autopause.onclick = (ev) => this._setAutopause(!this.config.autopause);
    this.interval.oninput = (ev) => this._updateInterval(this.interval.value);
    this.scale.oninput = (ev) => this._updateScale(this.scale.value);
    this.selectPlugin.onchange = (ev) => this._updatePlugins();
    this.addPlugin.onclick = (ev) => this._addPlugin(this.selectPlugin.value);
  }

  reset() {
    this._setDrawSteps(this.config.drawStepInterval);
    this._setAutopause();
    this._setDraw();
    this.interval.value = this.config.interval;
    this._updateInterval();
    this._updateScale(this.config.defaultScale);
    this._updatePlugins();
  }

  update() {
    this.selectPlugin.replace(Object.keys(Board.plugins), this.selectPlugin.value, 1);
  }

  _setDrawSteps(value) {
    this.config.setDrawStepInterval(parseFloat(value || this.config.drawStepInterval));
    this.drawStepIndicator.innerHTML = this.config.drawStepInterval;
  }

  _setAutopause(value) {
    this.config.setAutopause(value != null ? value : this.config.autopause);
  }

  _setDraw(fnName) {
    this.config.setDraw(fnName, !this.config.drawFunctions[fnName]);
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

  _addPlugin(pluginName) {
    new PluginControl(this, pluginName);
  }

  _updatePlugins() {
    this.addPlugin.disabled = !this.selectPlugin.value;
  }
}

class PluginControl {
  constructor(modal, pluginName, activate=true) {
    this.modal = modal;
    this.board = modal.board;
    this.name = pluginName;
    let PluginClass = Board.plugins[pluginName];
    if (!PluginClass)
      return;

    let plugin = this.plugin = new PluginClass(modal.board);
    modal.pluginControllers.push(this);
    this.board.plugins.push(plugin);

    let controllerPrototype = document.querySelector('.assets .plugin-control');
    let editorPrototype = document.querySelector('.assets .plugin-editor');
    this.controller = controllerPrototype.cloneNode(true);
    this.editor = editorPrototype.cloneNode(true);

    this.enabledButton = this.controller.querySelector('.plugin-enabled');
    this.deleteButton = this.controller.querySelector('.plugin-delete');
    this.editButton = this.controller.querySelector('.plugin-edit');
    this.label = this.controller.querySelector('.plugin-label');

    this.editorField = this.editor.querySelector('.plugin-editor-field');
    this.resetButton = this.editor.querySelector('.plugin-reset');
    this.revertButton = this.editor.querySelector('.plugin-revert');
    this.saveButton = this.editor.querySelector('.plugin-save');

    this.label.value = this.name;
    modal.pluginList.appendChild(this.controller);
    this.enabledButton.onclick = (ev) => this._toggleEnabled();
    this.editButton.onclick = (ev) => this._toggleEditor();
    this.deleteButton.onclick = (ev) => this._delete();
    this.resetButton.onclick = (ev) => this._reset();
    this.revertButton.onclick = (ev) => this._revert();
    this.saveButton.onclick = (ev) => this._save();

    activate && this._activate();
    this._revert();
  }

  _toggleEnabled() {
    this.active ? this._deactivate() : this._activate();
  }

  _toggleEditor() {
    this.editing ? this._closeEditor() : this._openEditor();
  }

  _activate() {
    this.active = true;
    this.plugin.activate();
    this.enabledButton.classList.add('active');
    this.enabledButton.classList.add('icon-eye');
    this.enabledButton.classList.remove('icon-eye-off');
    this.board.draw();
  }

  _deactivate() {
    this.active = false;
    this.plugin.deactivate();
    this.enabledButton.classList.remove('active');
    this.enabledButton.classList.add('icon-eye-off');
    this.enabledButton.classList.remove('icon-eye');
    this.board.draw();
  }

  _openEditor() {
    this.modal.pluginControllers.forEach((e) => e._closeEditor());
    this.editing = true;
    this.modal.pluginEditor.appendChild(this.editor);
    this.editButton.classList.add('active');
  }

  _closeEditor() {
    this.editing = false;
    this.editor.remove();
    this.editButton.classList.remove('active');
  }

  _reset() {
    this.plugin.saveSettings(this.plugin.defaultSettings());
    this._revert();
  }

  _revert() {
    this.editorField.value = this.plugin.getSettings();
  }

  _save() {
    try {
      this.plugin.saveSettings(this.editorField.value);
      this.board.setMessage(`Settings saved for ${this.name} plugin!`);
    }
    catch (err) {
      this.board.setMessage(err, 'error');
      console.error(err);
    }
  }
  _delete() {
    this.plugin.deactivate();
    this.board.plugins = this.board.plugins.filter((e) => e != this.plugin);
    this.modal.pluginControllers = this.modal.pluginControllers.filter((e) => e != this);
    this.controller.remove();
  }
}
