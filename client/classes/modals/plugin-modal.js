class PluginModal extends Modal {
  constructor(...args) {
    super(...args);
    this.selectPlugin = document.querySelector('#select-plugin').select;
    this.addPlugin = document.querySelector('#add-plugin');
    this.pluginList = document.querySelector('#plugin-list');
    this.pluginEditor = document.querySelector('#plugin-editor');
    this.pluginReset = document.querySelector('#plugin-reset');
    this.pluginRevert = document.querySelector('#plugin-revert');
    this.pluginSave = document.querySelector('#plugin-save');

    this.editing = null;

    this.selectPlugin.onchange = (ev) => this.updatePlugins();
    this.addPlugin.onclick = (ev) => this._addPlugin(this.selectPlugin.value);
    this.pluginEditor.oninput = (ev) => Util.handleTextFormat(this.pluginEditor, ev);
  }

  reset() {
    this.updatePlugins();
  }

  update() {
    this.selectPlugin.replace(Object.keys(Board.plugins), this.selectPlugin.value, 1);
  }

  _addPlugin(pluginName) {
    let plugin = new PluginControl(this.board, pluginName);
    plugin && this.board.setMessage(`Added ${pluginName} plugin!`);
  }

  updatePlugins() {
    this.addPlugin.disabled = !this.selectPlugin.value;
  }
}
