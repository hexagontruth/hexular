class PluginControl {
  static restoreFromPluginState(board, pluginState) {
    let [pluginName, settings, name, enabled] = JSON.parse(pluginState);
    let plugin = new Board.plugins[pluginName](board, settings, name);
    new PluginControl(board, plugin, enabled);
  }
  constructor(board, plugin, enable=null) {
    this.board = board;
    this.config = board.config;
    let modal = this.modal = board.modals.plugin;
    if (typeof plugin == 'string') {
      let PluginClass = Board.plugins[plugin];
      if (!PluginClass)
        return;
        plugin = new PluginClass(modal.board);
    }
    this.plugin = plugin;
    this.policy = plugin.getPolicy();
    this.name = plugin.name;
    this.copyIdx = 0;
    board.pluginControls.push(this);
    this.config.plugins.push(plugin);

    let controllerPrototype = document.querySelector('.assets .plugin-control');
    this.controller = controllerPrototype.cloneNode(true);
    this.controller.control = this;

    this.enabledButton = this.controller.querySelector('.plugin-enabled');
    this.nameField = this.controller.querySelector('.plugin-name');
    this.editButton = this.controller.querySelector('.plugin-edit');
    this.cloneButton = this.controller.querySelector('.plugin-clone');
    this.deleteButton = this.controller.querySelector('.plugin-delete');

    this.editorField = document.querySelector('#plugin-editor');
    this.resetButton = document.querySelector('#plugin-reset');
    this.revertButton = document.querySelector('#plugin-revert');
    this.saveButton = document.querySelector('#plugin-save');
    this.editorControls = [this.editorField, this.resetButton, this.revertButton, this.saveButton];
    this.settingsBuffer = '';

    this.nameField.value = this.name;
    modal.pluginList.appendChild(this.controller);
    this.controller.ondragstart = (ev) => this.handleDrag(ev);
    this.controller.ondragover = (ev) => this.handleDragOver(ev);
    this.controller.ondrop = (ev) => this.handleDrop(ev);
    this.enabledButton.onclick = (ev) => this.toggleEnabled();
    this.editButton.onclick = (ev) => this.toggleEditor();
    this.cloneButton.onclick = (ev) => this.clone();
    this.deleteButton.onclick = (ev) => {
      this.delete();
      this.config.storeSessionConfigAsync();
    }
    this.nameField.onchange = (ev) => this.setName(this.nameField.value);

    enable = enable != null ? enable : this.policy.autostart;
    this.activate();
    enable && this.enable();
    this.revert();
  }

  get enabled() {
    return this.plugin && this.plugin.enabled;
  }

  get activated() {
    return this.plugin && this.plugin.activated;
  }

  handleDrag(ev) {
    ev.dataTransfer.setData('text/plain', this.board.pluginControls.indexOf(this));
    ev.dataTransfer.dropEffect = 'move';
  }

  handleDragOver(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  }

  handleDrop(ev) {
    let sourceIdx = parseInt(ev.dataTransfer.getData('text/plain'));
    let targetIdx = this.board.pluginControls.indexOf(this);
    if (!isNaN(sourceIdx)) {
      let {y, height} = this.controller.getBoundingClientRect();
      y = ev.pageY - y;
      let newIdx = y < height / 2 ? targetIdx : targetIdx + 1;
      if (newIdx == sourceIdx || newIdx == sourceIdx + 1)
        return;
      if (newIdx > sourceIdx)
        newIdx --;
      let [droppedControl] = this.board.pluginControls.splice(sourceIdx, 1);
      this.board.pluginControls.splice(newIdx, 0, droppedControl);
      while (this.modal.pluginList.firstChild)
        this.modal.pluginList.firstChild.remove();
      this.board.pluginControls.forEach((pluginControl) => {
        this.modal.pluginList.appendChild(pluginControl.controller);
        pluginControl.deactivate() && pluginControl.enable();
      });
      this.config.setPlugins(this.board.pluginControls.map((e) => e.plugin));
    }
  }

  setName(name) {
    name = name || this.name;
    this.nameField.value = name;
    this.name = name;
    this.plugin.name = name;
  }

  toggleEnabled() {
    this.enabled ? this.disable() : this.enable();
    this.config.storeSessionConfigAsync();
  }

  toggleEditor() {
    this.editing ? this.closeEditor() : this.openEditor();
  }

  enable() {
    this.plugin.enable();
    this.enabledButton.classList.add('active');
    this.enabledButton.classList.add('icon-eye');
    this.enabledButton.classList.remove('icon-eye-off');
    this.board.draw();
  }

  disable() {
    if (!this.enabled)
      return false;
    this.plugin.disable();
    this.enabledButton.classList.remove('active');
    this.enabledButton.classList.add('icon-eye-off');
    this.enabledButton.classList.remove('icon-eye');
    this.board.draw();
    return true;
  }

  activate() {
    this.plugin.activate();
  }

  deactivate() {
    let enabled = this.disable();
    this.plugin.deactivate();
    return enabled;
  }

  openEditor() {
    if (this.modal.editing)
      this.modal.editing.closeEditor();
    this.editing = true;
    this.modal.editing = this;
    this.editorField.onchange = (ev) => this.saveBuffer();
    this.resetButton.onclick = (ev) => this.reset();
    this.revertButton.onclick = (ev) => this.revert();
    this.saveButton.onclick = (ev) => this.save();
    this.editorField.value = this.settingsBuffer;
    this.editorControls.forEach((e) => e.disabled = false);
    this.editButton.classList.add('active');
  }

  closeEditor() {
    if (this.modal.editing != this)
      return
    this.saveBuffer();
    this.modal.editing = null;
    this.editing = false;
    this.editorField.value = '';
    this.editorControls.forEach((e) => e.disabled = true);
    this.editButton.classList.remove('active');
  }

  reset() {
    this.plugin.saveSettings(this.plugin.defaultSettings());
    this.revert();
  }

  revert() {
    this.settingsBuffer = this.plugin.getSettings();
    if (this.modal.editing == this)
      Util.execInsert(this.editorField, this.settingsBuffer);
  }

  saveBuffer() {
    this.settingsBuffer = this.editorField.value;
  }

  save() {
    try {
      this.saveBuffer();
      this.plugin.saveSettings(this.settingsBuffer);
      this.board.setMessage(`Settings saved for ${this.name} plugin!`);
      this.board.draw();
    }
    catch (err) {
      this.board.setMessage(err, 'error');
      console.error(err);
    }
  }

  delete() {
    this.closeEditor();
    this.disable();
    this.plugin.deactivate();
    this.config.plugins = this.config.plugins.filter((e) => e != this.plugin);
    this.board.pluginControls = this.board.pluginControls.filter((e) => e != this);
    this.controller.remove();
  }

  to(board) {
    let enabled = this.enabled;
    this.delete();
    return new PluginControl(board, this.plugin.to(board), enabled);
  }

  clone() {
    let newPlugin = new this.plugin.constructor(
      this.board,
      this.plugin.getSettings(),
      `${this.plugin.name}-${('00' + this.copyIdx++).slice(-3)}`
    );
    return new PluginControl(this.board, newPlugin, this.policy.autostart || null);
  }
}
