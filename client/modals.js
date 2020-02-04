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

class CustomModal extends Modal {
  constructor(...args) {
    super(...args);
    this.customCode = document.querySelector('#custom-code');
    this.button = document.querySelector('#add-custom-code');
    this.button.onclick = (ev) => {
      if (this.customCode.value == '') {
        this.board.setMessage('Nothing to run!', 'error');
        return;
      }
      try {
        let evalFn = new Function('Hexular', 'Board', this.customCode.value)
        evalFn(Hexular, Board);
        this.board.setMessage('Done');
      }
      catch (err) {
        this.board.setMessage(`An error occurred: ${err}.`, 'error');
      }
    }
  }

  reset() {
    if (this.customCode.value == '')
      this.customCode.value = this.customCode.placeholder;
  }
}

class ConfigModal extends Modal {
  constructor(...args) {
    super(...args);
    this.ruleMenus = [];
    this.ruleConfig = document.querySelector('.rule-config');
    this.numStates = document.querySelector('#num-states');
    this.addPreset = document.querySelector('#add-preset');
    this.selectPreset = document.querySelector('#select-preset');
    this.checkAll = document.querySelector('#check-all');
    this.setAll = document.querySelector('#set-all');
    this.selectNh = document.querySelector('#select-neighborhood');
    this.checkAll.onclick = (ev) => this._handleCheckAll();
    this.numStates.onchange = (ev) => this._setNumStates(ev.target.value);
    this.addPreset.onclick = (ev) => this._handleAddPreset();
    this.selectPreset.onchange = (ev) => this._selectPreset(ev.target.value);
    this.setAll.onchange = (ev) => this._handleSetAll(ev);
    this.selectNh.onchange = (ev) => this._setNh(ev.target.value);

    this._updateRules();
    this._restoreConfigState();
  }

  update() {
    this._updateRules();
  }

  reset() {
    if (this.board.preset)
      this.selectPreset.value = this.board.preset;
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
    this._storeConfigState();
  }

  _handleAddPreset() {
    // TODO: Remove native prompt
    let presetName = window.prompt('Please enter a preset name:');
    if (presetName) {
      let rules = this.ruleMenus.slice(0, this.board.numStates).map((e) => e.select.value);
      let preset = new Preset(rules, {nh: this.board.nh});
      this.board.addPreset(presetName, preset);
      this._selectPreset(presetName);
    }
  }

  _selectPreset(presetName) {
    const preset = this.board.presets[presetName];
    if (!preset) {
      this.board.preset = null;
      return;
    }
    this._setNumStates(preset.numStates);
    preset.rules.forEach((ruleName, idx) => {
      this.ruleMenus[idx].set(ruleName);
    });
    this._setNh(preset.nh);
    this.board.preset = presetName;
    this.selectPreset.value = presetName;
    this.addPreset.disabled = true;
    this._storeConfigState();
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
      ruleMenu.checked && ruleMenu.set(ruleName);
    });
    this.setAll.selectedIndex = 0;
    this._checkPreset();
    this._storeConfigState();
  }

  _handleSetRule(ev) {
    const ctl = ev.target;
    const idx = ctl.ruleMenu.index;
    const ruleName = ctl.value;
    this.ruleMenus[idx].set(ruleName);
    this._checkPreset();
    this._storeConfigState();
  }

  // Set default neighborhood for rules using top-level cell helper functions

  _setNh(nh) {
    if (!nh)
      return;
    this.selectNh.value = nh;
    this.board.setNh(parseInt(nh));
    this._checkPreset();
    this._storeConfigState();
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

  _checkPreset() {
    const preset = this.board.presets[this.board.preset];
    if (!preset)
      return;
    let dirty = (() => {
      if (this.board.model.numStates != preset.rules.length) {
        return true;
      }
      if (preset.nh && this.board.nh != preset.nh) {
        return true;
      }
      return this.board.model.rules.slice(0, this.board.model.numStates).reduce((a, ruleFn, idx) => {
        return  a || this.board.availableRules[preset.rules[idx]] != ruleFn;
      }, false);
    })();
    if (dirty) {
      this.selectPreset.selectedIndex = 0;
      this.addPreset.disabled = false;
      this.board.preset = null;
    }
  }

  _storeConfigState() {
    let obj = {
      numStates: this.board.numStates,
      preset: this.selectPreset.value,
      rules: this.ruleMenus.map((e) => e.select.value),
      nh: this.board.nh
    };
    this.board.storeState({config: JSON.stringify(obj)});
  }

  _restoreConfigState() {
    let obj;
    try {
      obj = JSON.parse(this.board.storage.getItem('config'));
    }
    catch {}
    obj = obj || {};

    if (obj.preset) {
       this._selectPreset(obj.preset);
    }
    else {
      let {numStates, nh} = this.board;
      this._selectPreset(this.board.preset);
      this._setNumStates(obj.numStates || numStates);
      this._setNh(obj.nh || nh);
      this.board.preset || obj.rules && this.ruleMenus.forEach((ruleMenu, idx) => {
        ruleMenu.set(obj.rules[idx] || this.board.defaultRule);
      });
    }
  }
}