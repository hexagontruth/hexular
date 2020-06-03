
class ConfigModal extends Modal {
  constructor(...args) {
    super(...args);
    this.ruleMenus = [];
    this.defaultRuleMenu = null;
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
    this.numStates = document.querySelector('#num-states');
    this.numStatesIndicator = document.querySelector('#num-states-indicator');
    this.addPreset = document.querySelector('#add-preset');
    this.savePreset = document.querySelector('#save-preset');
    this.loadPreset = document.querySelector('#load-preset');
    this.selectPreset = document.querySelector('#select-preset').select;
    this.checkAll = document.querySelector('#check-all');
    this.setAll = document.querySelector('#set-all').select;
    this.selectNh = document.querySelector('#select-neighborhood').select

    this.modal.onmouseup = (ev) => this._handleCheckState(ev);
    this.modal.onmousemove = (ev) => this._handleCheckState(ev);
    this.modal.onmouseleave = (ev) => this._handleCheckState(ev);
    this.numStates.oninput = (ev) => this._handleNumStates();
    this.addPreset.onclick = (ev) => this._handleAddPreset();
    this.savePreset.onclick = (ev) => this._handleSavePreset();
    this.loadPreset.onclick = (ev) => this._handleLoadPreset();
    this.selectPreset.onchange = (ev) => this._handlePreset();
    this.checkAll.onclick = (ev) => this._handleCheckAll();
    this.setAll.oninput = (ev) => this._handleSetAll(ev);
    this.selectNh.onchange = (ev) => this.handleNh(ev);
    Object.entries(this.filters).forEach(([filter, button]) => {
      button.onclick = (ev) => this._handleFilter(filter);
    });
  }

  update() {
    this._updateMenus();
    this.numStates.max = this.config.maxNumStates;
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
    let ruleMenus = this.ruleMenus.concat(this.defaultRuleMenu);
    let check = !ruleMenus.every((ruleMenu) => ruleMenu.checked);
    if (check)
      this.checkAll.classList.add('checked');
    else
      this.checkAll.classList.remove('checked');
    ruleMenus.forEach((ruleMenu) => {
      ruleMenu.checked = check;
    });
  }

  _handleSetAll(ev) {
    let rule = this.setAll.value;
    if (this.config.availableRules[rule]) {
      this.ruleMenus.concat(this.defaultRuleMenu)
      .filter((e) =>  e.checked)
      .forEach((ruleMenu) => {
        this.config.setRule(ruleMenu.idx, rule);
      });
    }
    this.setAll.value = null;
  }

  handleNh(ev) {
    this.config.setNh(parseInt(this.selectNh.value));
    this.board.setMessage(`Set neighborhood to N${this.config.nh}`)
  }

  _handleFilter(filter) {
    let state = !this.config.filters[filter];
    this.config.setFilter(filter, state);
  }

  _updateMenus() {
    this.availableRuleNames = Object.keys(this.config.availableRules);
    this.presetNames = Object.keys(this.config.presets);

    this.selectPreset.replace(this.presetNames, this.config.preset, 1);
    this.setAll.replace(this.availableRuleNames, null, 1);

    this.defaultRuleMenu = new RuleMenu(this, document.querySelector('#default-rule-menu'));
    while (this.ruleGroup.firstChild)
      this.ruleGroup.firstChild.remove();
    this.ruleMenus = [];
    for (let i = 0; i < this.config.maxNumStates; i++) {
      let ruleMenu = new RuleMenu(this, i);
      this.ruleMenus.push(ruleMenu);
      this.ruleGroup.appendChild(ruleMenu.container);
    }
  }

}

class RuleMenu {
  constructor(modal, arg) {
    this.modal = modal;
    this.board = modal.board;
    this.config = modal.config;
    if (typeof arg == 'number') {
      let prototype = document.querySelector('.assets .rule-menu');
      this.container = this.container = prototype.cloneNode(true);
      this.idx = arg;
    }
    else {
      this.container = arg;
      this.idx = null;
    }
    let container = this.container;
    let idx = this.idx;
    let select = this.select = new Select(container.querySelector('select'));
    let button = this.button = container.querySelector('button.checkable');
    select.ruleMenu = this;
    select.onchange = (ev) => this.config.setRule(idx, select.value);
    if (idx != null) {
      container.title = idx;
      button.style.backgroundColor = this.config.colors[idx] && this.config.colors[idx].toString();
      select.replace(this.modal.availableRuleNames, this.config.rules[idx]);
    }
    else {
      container.title = 'Default rule';
      button.classList.add('icon-infinity');
      select.replace(this.modal.availableRuleNames, this.config.defaultRule);
    }
    container.setAttribute('data-disabled',  idx >= this.config.numStates);

    button.onmousedown = (ev) => {
      this.checked = !this.checked;
      this.modal.checkState = this.checked;
      ev.preventDefault();
    };
    button.onmousemove = (ev) => {
      if (this.modal.checkState != null)
        this.checked = this.modal.checkState;
    };
  }

  set checked(val) {
    if (val)
      this.container.classList.add('checked');
    else
      this.container.classList.remove('checked');
  }

  get checked() {
    return this.container.classList.contains('checked');
  }
}
