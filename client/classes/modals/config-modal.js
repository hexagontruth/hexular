
class ConfigModal extends Modal {
  constructor(...args) {
    super(...args);
    this.ruleMenus = [];
    this.filters = {
      clipBottomFilter: document.querySelector('#filter-clip-bottom'),
      clipTopFilter: document.querySelector('#filter-clip-top'),
      binaryFilter: document.querySelector('#filter-binary'),
      deltaFilter: document.querySelector('#filter-delta'),
      modFilter: document.querySelector('#filter-mod'),
      edgeFilter: document.querySelector('#filter-edge'),
    };
    this.checkState = null;
    this.ruleGroup = document.querySelector('#rule-group');
    this.defaultRuleGroup = document.querySelector('#default-rule-group');
    this.numStates = document.querySelector('#num-states');
    this.addPreset = document.querySelector('#add-preset');
    this.savePreset = document.querySelector('#save-preset');
    this.loadPreset = document.querySelector('#load-preset');
    this.selectPreset = document.querySelector('#select-preset');
    this.checkAll = document.querySelector('#check-all');
    this.setAll = document.querySelector('#set-all');
    this.selectNh = document.querySelector('#select-neighborhood');
    this.modal.onmouseup = (ev) => this._handleCheckState(ev);
    this.modal.onmousemove = (ev) => this._handleCheckState(ev);
    this.modal.onmouseleave = (ev) => this._handleCheckState(ev);
    this.numStates.onchange = (ev) => this._handleNumStates();
    this.addPreset.onclick = (ev) => this._handleAddPreset();
    this.savePreset.onclick = (ev) => this._handleSavePreset();
    this.loadPreset.onclick = (ev) => this._handleLoadPreset();
    this.selectPreset.onchange = (ev) => this._handlePreset();
    this.checkAll.onclick = (ev) => this._handleCheckAll();
    this.setAll.onchange = (ev) => this._handleSetAll(ev);
    this.selectNh.onchange = (ev) => this.handleNh(ev);
    Object.entries(this.filters).forEach(([filter, button]) => {
      button.onclick = (ev) => this._handleFilter(filter);
    });
  }

  update() {
    this._updateMenus();
  }

  _handleNumStates() {
    this.config.setNumStates(this.numStates.value);
    this.board.setMessage(`Set model to ${this.config.numStates} states`);
  }

  _handlePreset() {
    this.config.setPreset(this.selectPreset.value);
    this.board.setMessage(`Selected preset "${this.config.preset}"`);
  }

  _handleAddPreset() {
    // TODO: Replace native prompt
    let presetName = window.prompt('Please enter a preset name:');
    if (presetName) {
      let preset = new Preset(this.config.exportPreset());
      this.config.addPreset(presetName, preset);
      this.config.setPreset(presetName);
    }
  }

  _handleSavePreset() {
    let obj = {};
    let presetName = this.config.preset;
    obj[presetName] = this.config.exportPreset();
    let dataUri = `data:application/json,${encodeURIComponent(JSON.stringify(obj))}`;
    this.board.promptDownload(`${presetName.replace(/ /g, '_')}.json`, dataUri);
  }

  _handleLoadPreset() {
    let fileLoader = new FileLoader('.json');
    fileLoader.onload =  (result) => {
      try {
        let obj = JSON.parse(result);
        let presets = Object.entries(obj).map(([presetName, presetObj]) => {
          this.config.addPreset(presetName, new Preset(presetObj));
          return presetName;
        });

        if (presets.length > 1) {
          this.board.setMessage('Presets imported!');
        }
        else if (presets.length == 1) {
          this.board.setMessage('Preset imported!');
          this.config.setPreset(presets[0]);
        }
      }
      catch (e) {
        this.board.setMessage(e.toString(), 'error');
      }

    };
    fileLoader.filter = (files) => {
      let result = files.map((file) => file.type.indexOf('json') >= 0);
      result.some((e) => !e) && this.setMessage('Not all selected files are JSON files', 'error');
      return result;
    };
    fileLoader.prompt();
  }

  _handleCheckState(ev) {
    if (ev.buttons ^ 1)
      this.checkState = null;
  }

  _handleCheckAll() {
    // Not sure if should include default rule
    let check = !this.ruleMenus.every((ruleMenu) => ruleMenu.checked);
    if (check)
      this.checkAll.classList.add('checked');
    else
      this.checkAll.classList.remove('checked');
    this.ruleMenus.forEach((ruleMenu) => {
      ruleMenu.checked = check;
    });
  }

  _handleSetAll(ev) {
    let rule = this.setAll.value;
    this.allRuleMenus.forEach((ruleMenu) => {
      ruleMenu.checked && this.config.setRule(ruleMenu.index, rule);
    });
    this.setAll.selectedIndex = 0;
  }

  _handleSetRule(ev) {
    const ctl = ev.target;
    const idx = ctl.ruleMenu.index;
    const rule = ctl.value;
    this.config.setRule(idx, rule);
  }

  handleNh(ev) {
    this.config.setNh(parseInt(this.selectNh.value));
    this.board.setMessage(`Set neighborhood to ${this.config.nh}`)
  }

  _handleFilter(filter) {
    let state = !this.config.filters[filter];
    this.config.setFilter(filter, state);
  }

  _updateMenus() {
    // Refresh presets
    this.selectPreset.options.length = 1;
    for (let presetName of Object.keys(this.config.presets)) {
      let option = document.createElement('option');
      option.text = presetName;
      option.selected = presetName == this.config.preset;
      this.selectPreset.appendChild(option);
    }

    // Refresh rules
    this.setAll.options.length = 1;
    for (let ruleName of Object.keys(this.config.availableRules)) {
      let option = document.createElement('option');
      option.text = ruleName;
      this.setAll.appendChild(option);
    }

    while (this.ruleGroup.firstChild)
      this.ruleGroup.firstChild.remove();
    this.ruleMenus = [];
    for (let i = 0; i < this.config.maxNumStates; i++) {
      let ruleMenu = new RuleMenu(this, i, this.config.rules[i], i >= this.config.numStates);
      this.ruleMenus.push(ruleMenu);
      this.ruleGroup.appendChild(ruleMenu.container);
    }

    while(this.defaultRuleGroup.firstChild)
      this.defaultRuleGroup.firstChild.remove();
    this.allRuleMenus = this.ruleMenus.slice();
    this.defaultRuleMenu = new RuleMenu(this, null, this.config.defaultRule, false);
    this.allRuleMenus.push(this.defaultRuleMenu);
    this.defaultRuleGroup.appendChild(this.defaultRuleMenu.container);
  }

}

class RuleMenu {
  constructor(modal, idx, selected, disabled) {
    this.modal = modal;
    this.board = modal.board;
    this.config = modal.config;
    this.index = idx;
    let rules = this.config.availableRules;
    let prototype = document.querySelector('.assets .rule-menu');
    let container = this.container = prototype.cloneNode(true);
    let select = this.select = container.querySelector('select');
    let button = this.button = container.querySelector('button.checkable');
    select.ruleMenu = this;
    select.addEventListener('change', (ev) => this.modal._handleSetRule(ev));
    if (idx != null) {
      container.title = `State ${idx}`;
      button.style.backgroundColor = this.board.bgAdapter.colors[idx];
    }
    else {
      container.title = 'Default rule';
      button.classList.add('icon-infinity');
    }
    container.setAttribute('data-disabled', disabled);

    for (let [ruleName, fn] of Object.entries(rules)) {
      let option = document.createElement('option');
      option.text = ruleName;
      option.selected = selected == fn;
      select.appendChild(option);
    }
    button.addEventListener('mousedown', (ev) => {
      this.checked = !this.checked;
      this.modal.checkState = this.checked;
      ev.preventDefault();
    });
    button.addEventListener('mousemove', (ev) => {
      if (this.modal.checkState != null)
        this.checked = this.modal.checkState;
    });
  }

  set checked(val) {
    if (val) this.container.classList.add('checked');
    else this.container.classList.remove('checked');
  }

  get checked() {
    return this.container.classList.contains('checked');
  }
}