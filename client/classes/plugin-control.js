class PluginControl {
  constructor(board, plugin, activate=true) {
    this.board = board;
    let modal = this.modal = board.modals.draw;
    if (typeof plugin == 'string') {
      let PluginClass = Board.plugins[plugin];
      if (!PluginClass)
        return;
        plugin = new PluginClass(modal.board);
    }
    this.plugin = plugin;
    this.name = plugin.constructor.name;
    board.pluginControls.push(this);
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
    this.enabledButton.onclick = (ev) => this.toggleEnabled();
    this.editButton.onclick = (ev) => this.toggleEditor();
    this.deleteButton.onclick = (ev) => this.delete();
    this.resetButton.onclick = (ev) => this.reset();
    this.revertButton.onclick = (ev) => this.revert();
    this.saveButton.onclick = (ev) => this.save();

    activate && this.activate();
    this.revert();
  }

  toggleEnabled() {
    this.active ? this.deactivate() : this.activate();
  }

  toggleEditor() {
    this.editing ? this.closeEditor() : this.openEditor();
  }

  activate() {
    this.active = true;
    this.plugin.activate();
    this.enabledButton.classList.add('active');
    this.enabledButton.classList.add('icon-eye');
    this.enabledButton.classList.remove('icon-eye-off');
    this.board.draw();
  }

  deactivate() {
    this.active = false;
    this.plugin.deactivate();
    this.enabledButton.classList.remove('active');
    this.enabledButton.classList.add('icon-eye-off');
    this.enabledButton.classList.remove('icon-eye');
    this.board.draw();
  }

  openEditor() {
    this.board.pluginControls.forEach((e) => e.closeEditor());
    this.editing = true;
    this.modal.pluginEditor.appendChild(this.editor);
    this.editButton.classList.add('active');
  }

  closeEditor() {
    this.editing = false;
    this.editor.remove();
    this.editButton.classList.remove('active');
  }

  reset() {
    this.plugin.saveSettings(this.plugin.defaultSettings());
    this.revert();
  }

  revert() {
    this.editorField.value = this.plugin.getSettings();
  }

  save() {
    try {
      this.plugin.saveSettings(this.editorField.value);
      this.board.setMessage(`Settings saved for ${this.name} plugin!`);
    }
    catch (err) {
      this.board.setMessage(err, 'error');
      console.error(err);
    }
  }
  delete() {
    this.closeEditor();
    this.deactivate();
    this.board.plugins = this.board.plugins.filter((e) => e != this.plugin);
    this.board.pluginControls = this.board.pluginControls.filter((e) => e != this);
    this.controller.remove();
    this.editor.remove();
  }
}
