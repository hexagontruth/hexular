class Modal {
  constructor(board, name) {
    this.board = board;
    this.name = name;
    this.modal = document.querySelector(`.modal.${name}`);
  }

  open() {
    this.board.modal = this;
    this.reset();
    this.modal.classList.remove('hidden');
    this.board.overlay.classList.remove('hidden');
  }

  close() {
    this.modal.classList.add('hidden');
  }

  reset() {}

  upate() {}
}

class ResizeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.slider = document.querySelector('#resize-slider');
    this.default = document.querySelector('#resize-default');
    this.set = document.querySelector('#resize-set');
    this.slider.onchange = (ev) => this._updateInfo();
    this.set.onclick = (ev) => this._resize();
  }

  reset() {
    this.slider.value = this.board.radius;
    this._updateInfo();
  }

  _updateInfo() {
    let radius = this.radius = parseInt(this.slider.value) || DEFAULTS.radius;
    this.set.innerHTML = `${radius} (${radius * (radius - 1) * 3 + 1} cells)`;
  }

  _resize() {
    Board.resize(this.radius);
  }
}

class ConfigModal extends Modal {
  constructor(...args) {
    super(...args);
    this.ruleMenus = [];
    this.ruleConfig = document.querySelector('.rule-config');
    this.numStates = document.querySelector('#num-states');
    this.selectPreset = document.querySelector('#select-preset');
    this.customRule = document.querySelector('#custom-rule');
    this.addRule = document.querySelector('#add-rule');
    this.checkAll = document.querySelector('#check-all');
    this.setAll = document.querySelector('#set-all');
    this.selectNeighborhood = document.querySelector('#select-neighborhood');
    this.addRule.onmouseup = (ev) => this._handleAddRule();
    this.checkAll.onmouseup = (ev) => this._handleCheckAll();
    this.numStates.onchange = (ev) => this._setNumStates(ev.target.value);
    this.selectPreset.onchange = (ev) => this._selectPreset(ev.target.value);
    this.setAll.onchange = (ev) => this._handleSetAll(ev);
    this.selectNeighborhood.onchange = (ev) => this._setNeighborhood(ev.target.value);
    this.customRule.value = '{newRule: (cell) => cell.state}';
  }

  update() {
    this._updateRules();
  }

  _setNumStates(val) {
    if (val)
      this.numStates.value = val;
    const numStates = parseInt(this.numStates.value);
    this.board.numStates = this.board.model.numStates = numStates;
    this.ruleMenus.forEach((ruleMenu) => {
      let disabled = ruleMenu.index >= numStates;
      ruleMenu.container.setAttribute('data-disabled', disabled);
      this.board.model.rules[ruleMenu.index] = this.board.rules[ruleMenu.index];
    });
    this._checkPreset();
  }

  // Preset setting and checking

  _selectPreset(presetName) {
    const presetList = this.board.presets[presetName];
    if (!presetList)
      return;
    this._setNumStates(presetList.length);
    this.ruleMenus.forEach((ruleMenu) => {
      let ruleName = presetList[ruleMenu.index] || 'identityRule';
      let fn = this.board.availableRules[ruleName];
      ruleMenu.select.value = ruleName;
      this.board.model.rules[ruleMenu.index] = fn;
    });
    this.board.preset = presetName;
    this.selectPreset.value = presetName;
  }

  _checkPreset() {
    const presetList = this.board.presets[this.preset];
    if (!presetList)
      return;
    let dirty = (() => {
      if (this.board.model.numStates != presetList.length)
        return true;
      return this.board.model.rules.slice(0, this.board.model.numStates).reduce((a, ruleFn, idx) => {
        return a || this.board.availableRules[idx] != ruleFn;
      }, false);
    })();
    if (dirty) {
      this.selectPreset.selectedIndex = 0;
      this.board.preset = null;
    }
  }

  _handleAddRule() {
    if (this.customRule.value == '') {
      this.board.setMessage('Please enter a valid rule object', 'error');
      return;
    }
    try {
      let obj = new Function(`return (${this.customRule.value})`)();
      if (Object.keys(obj).length < 1) {
        this.board.setMessage('No rules added. Too bad.');
        return;
      }
      Object.assign(this.board.availableRules, obj);
      this._updateRules();
      let ruleNames = Object.keys(obj);
      this.board.setMessage(`Added rule${ruleNames.length > 1 ? 's' : ''} ${ruleNames.join(', ')}.`);
    }
    catch (err) {
      this.board.setMessage(`An error occurred: ${err}.`, 'error');
    }
  }

  _handleCheckAll() {
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
    let ruleName = this.setAll.value;
    const rule = this.board.availableRules[ruleName] || this.board.rules.identityRule;
    this.ruleMenus.forEach((ruleMenu) => {
      if (ruleMenu.checked) {
        ruleMenu.select.value = ruleName;
        this.board.model.rules[ruleMenu.index] = rule;
      }
    });
    this.setAll.selectedIndex = 0;
    this._checkPreset();
  }

  _handleSetRule(ev) {
    const ctl = ev.target;
    this.board.model.rules[ctl.ruleMenu.index] =
      this.board.availableRules[ctl.value] || this.board.availableRules.identityRule;
    this._checkPreset();
  }

  _updateRules() {
    // Refresh presets
    this.selectPreset.options.length = 1;
    for (let presetName of Object.keys(this.board.presets)) {
      let option = document.createElement('option');
      option.text = presetName;
      option.selected = presetName == this.preset;
      this.selectPreset.appendChild(option);
    }

    // Refresh rules
    this.setAll.options.length = 1;
    for (let ruleName of Object.keys(this.board.availableRules)) {
      let option = document.createElement('option');
      option.text = ruleName;
      this.setAll.appendChild(option);
    }

    while (this.ruleConfig.firstChild) this.ruleConfig.firstChild.remove();
    this.ruleMenus = [];

    for (let i = 0; i < this.board.maxNumStates; i++) {
      let ruleMenu = new RuleMenu(this.board, i, this.board.model.rules[i], i >= this.board.model.numStates);
      ruleMenu.select.addEventListener('change', (ev) => this._handleSetRule(ev));
      this.ruleMenus.push(ruleMenu);
      this.ruleConfig.appendChild(ruleMenu.container);
    }
  }

  // Set default neighborhood for rules using top-level cell helper functions

  _setNeighborhood(neighborhood) {
    this.board.model.setNeighborhood(neighborhood);
  }
}