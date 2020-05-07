class TrbModal extends Modal {
  constructor(...args) {
    super(...args);
    this.ruleNameField = document.querySelector('#trb-rule-name');
    this.selectAvailable = document.querySelector('#trb-select-available').select;
    this.templateList = document.querySelector('#template-list');
    this.templateControls = [];
    this.templateStringField = document.querySelector('#template-string');
    this.templateMask = document.querySelector('#template-mask');
    this.templateButtons = Array(19).fill().map((_, i) => {
      let button = this.templateMask.querySelector(`#cell-${('0' + i).slice(-2)}`);
      button.idx = i;
      return button;
    });
    this.syms = [0, 1, 2, 3];
    this.symButtons = this.syms.map((e) => {
      let button = document.querySelector(`#trb-sym-${e}`)
      button.sym = e;
      return button;
    });
    this.deleteTemplateButton = document.querySelector('#trb-delete-template');
    this.clearTemplateButton = document.querySelector('#trb-clear-template');
    this.saveTemplateButton = document.querySelector('#trb-save-template');
    this.resetRuleButton = document.querySelector('#trb-reset-rule');
    this.saveRuleButton = document.querySelector('#trb-save-rule');

    this.ruleName = null;
    this.selectedName = null;
    this.selectedRuleDef = null;
    this.selectedControl = null;
    this.selectedControlIdx = null;
    this.templateDef = Hexular.util.merge({}, Config.defaults.trb.templateDef);
    this.buttonMode = null;

    this.ruleNameField.onchange = () => {
      this.setRuleName(this.ruleNameField.value);
      if (this.ruleNameField.value != this.selectAvailable.value)
        this.selectAvailable.value = null;
      this.saveConfig();
    }

    this.selectAvailable.onchange = () => {
      let rule = this.selectAvailable.value;
      this.loadRule(rule);
      this.saveConfig();
    };

    this.templateStringField.onchange = () => {
      this.parseTemplateString();
      this.saveConfig();
    }

    // Radio symmetry buttons
    let symButtonCb = (active, alts) => {
      for (let alt of alts)
        this.symButtons[alt].classList.remove('active');
      this.symButtons[active].classList.add('active');
      this.templateDef.sym = active;
      this.updateTemplateString();
      this.saveConfig();
    };
    this.symRadioGroup = new RadioGroup(this.syms, symButtonCb);
    this.symButtons.forEach((e) => e.onclick = () => this.symRadioGroup.set(e.sym));

    this.templateMask.onmousedown =
      this.templateMask.onmouseup =
      this.templateMask.onmouseover =
      this.templateMask.onmouseleave = (ev) => this.handleTemplateMouse(ev);
    this.templateMask.oncontextmenu = (ev) => ev.preventDefault();

    this.deleteTemplateButton.onclick = () => {
      this.selectedControl && this.selectedControl.delete();
    };
    this.clearTemplateButton.onclick = () => {
      this.clearTemplate();
      this.saveConfig();
    };
    this.saveTemplateButton.onclick = () => {
      this.saveTemplate();
      this.saveConfig();
    };
    this.resetRuleButton.onclick = () => {
      this.clear();
      this.saveConfig();
    };
    this.saveRuleButton.onclick = () => {
      this.saveRule();
    };
  }

  clear() {
    this.config.setTrb(Config.defaults.trb);
    this.loadConfig();
    this.updateTemplates();
  }

  update() {
    let rbRules = Object.entries(this.config.availableRules).filter(([rule, fn]) => fn.templates).map(([rule, fn]) => rule);
    this.selectAvailable.replace(rbRules, this.ruleName, 1);
    this.loadConfig();
  }

  reset() {
    this.loadConfig();
  }

  loadConfig() {
    let obj = this.config.trb;
    this.setRuleName(obj.ruleName);
    this.loadRule(obj.ruleName);
    this.updateTemplates(obj.templateDefs);
    this.loadTemplate(this.templateControls[obj.selectedControlIdx]);
    this.parseTemplateString(obj.templateDef);
  }

  saveConfig() {
    let keys = [
      'ruleName',
      'selectedControlIdx',
      'selectedName',
      'selectedRuleDef',
      'templateDefs',
      'templateDef',
    ];
    let obj = Hexular.util.extract(this, keys);
    obj.templateDefs = this.templateControls.map((e) => e.def);
    this.config.setTrb(obj);
  }

  setRuleName(name) {
    name = name || this.config.trb.ruleName;
    this.ruleName = name;
    this.ruleNameField.value = name;
  }

  loadRule(rule) {
    this.ruleNameField.value = rule;
    this.selectAvailable.value = rule;
    let fn = this.config.availableRules[rule];
    if (fn) {
      this.selectedRuleDef = fn.toObject()[0];
      this.selectedName = rule;
      this.setRuleName(rule);
      this.selectAvailable.value = rule;
      this.updateTemplates(this.selectedRuleDef);
    }
    else {
      this.selectedRuleDef = null;
      this.selectedName = null;
      this.setRuleName(null);
    }
  }

  saveRule() {
    let ruleName = this.ruleName;
    let ruleDef = this.templateControls.map((e) => e.def);
    let ruleFn = Hexular.util.templateRuleBuilder(ruleDef);
    this.config.addRule(ruleName, ruleFn);
    this.board.setMessage(`Rule "${ruleName}" saved!`)
  }

  checkRuleDirty() {
    if (!this.selectedRuleDef)
      return;
    let curString = JSON.stringify(this.templateControls.map((e) => e.def));
    let ruleString = JSON.stringify(this.selectedRuleDef);
    if (curString != ruleString) {
      this.loadRule();
    }
  }

  clearTemplate() {
    this.parseTemplateString(Config.defaults.trb.templateDef);
  }

  saveTemplate() {
    let templateDef = this.getTemplateDef();
    if (this.selectedControl) {
      this.selectedControl.update(templateDef);
    }
    else {
      let templateControl = new TemplateControl(this, templateDef)
      this.templateControls.push(templateControl);
      this.loadTemplate(templateControl);
    }
    this.checkRuleDirty();
  }

  loadTemplate(control) {
    this.templateControls.forEach((e) => e.controller.classList.remove('active'));
    this.deleteTemplateButton.disabled = true;
    this.selectedControl = control;
    this.selectedControlIdx = this.templateControls.indexOf(control);
    if (control) {
      control.controller.classList.add('active');
      this.parseTemplateString(control.def);
      this.deleteTemplateButton.disabled = false;
    }
  }

  getTemplateDef(newDef={}) {
    let def = {};
    try {
      def = JSON.parse(this.templateStringField.value);
    }
    catch {}
    let mergedDef = Hexular.util.merge({}, Config.defaults.trb.templateDef, def, newDef);
    if (!this.syms.includes(mergedDef.sym))
      mergedDef.sym = this.templateDef.sym
    return mergedDef;
  }

  updateTemplateString() {
    let def = this.getTemplateDef();
    def = Hexular.util.merge({}, def, this.templateDef);
    this.setTemplateDef(def);
  }

  parseTemplateString(newDef={}) {
    let def = this.getTemplateDef(newDef);
    this.setTemplateDef(def);
    this.setTemplateCells(def.states);
    this.symRadioGroup.set(def.sym);
  }

  setTemplateDef(def) {
    this.templateDef = def;
    this.templateString = this.templateStringField.value = Util.shallowPrettyJson(def, 1);
  }

  updateTemplates(defs=[]) {
    this.templateList.querySelectorAll('.template-controller').forEach((e) => e.remove());
    this.templateControls = defs.map((e) => new TemplateControl(this, e));
    this.checkRuleDirty();
  }

  setTemplateCell(idx) {
    if (this.buttonMode == null)
      return;
    this.templateDef.states[idx] = this.buttonMode;
    this.setTemplateButton(idx);
    this.updateTemplateString();
  }

  setTemplateCells(templateStates) {
    if (templateStates)
      this.templateDef.states = templateStates;
    this.templateButtons.forEach((e) => this.setTemplateButton(e.idx));
    this.updateTemplateString();
  }

  setTemplateButton(idx) {
    let button = this.templateButtons[idx];
    let state = this.templateDef.states[idx];
    button.setAttribute('class', null);
    if (state == 0)
      button.classList.add('inactive');
    else if (state == 1)
      button.classList.add('active');
  }

  handleTemplateMouse(ev) {
    if (ev.buttons & 4)
      return;
    // Remove buttonMode when cursor goes out of mask area
    if (ev.type == 'mouseleave' && this.buttonMode != null) {
      this._endButtonMode();
    }
    else if (ev.type == 'mouseup') {
      this._endButtonMode();
    }
    else if (this.templateButtons.includes(ev.target)) {
      let button = ev.target;
      if (ev.type == 'mousedown' && this.buttonMode == null) {
        let inc;
        if (ev.buttons & 1)
          inc = -1;
        else if (ev.buttons & 2)
          inc = 1;
        else
          return;
        this._startButtonModeFrom(button, inc);
      }
      this.setTemplateCell(button.idx);
      ev.preventDefault();
    }
  }

  _endButtonMode() {
    if (this.buttonMode == null)
      return;
    this.buttonMode = null;
    this.saveConfig();
  }

  _startButtonMode(mode) {
    this.buttonMode = mode;
  }

  _startButtonModeFrom(button, inc = -1) {
    let cur = this.config.trb.templateDef.states[button.idx];
    let mode = Hexular.math.mod(cur + 1 + inc, 3) - 1;
    this.buttonMode = mode;
  }
}

class TemplateControl {

  constructor(modal, def) {
    this.modal = modal;
    this.def = def;
    this.controller = document.createElement('div');
    this.controller.classList.add('template-controller');
    this.controller.draggable = true;
    this.controller.control = this;
    this.thumb = modal.templateMask.cloneNode(true);
    this.thumb.setAttribute('id', '');
    this.updateThumb();
    this.controller.appendChild(this.thumb);
    this.controller.onclick = () => {
      this.modal.loadTemplate(this.modal.selectedControl != this && this);
      this.modal.saveConfig();
    };
    modal.templateList.appendChild(this.controller);
    this.controller.ondragstart = (ev) => this.handleDrag(ev);
    this.controller.ondragover = (ev) => this.handleDragOver(ev);
    this.controller.ondrop = (ev) => this.handleDrop(ev);
  }

  delete() {
    this.modal.selectedControl == this && this.modal.loadTemplate();
    this.controller.remove();
    this.modal.templateControls = this.modal.templateControls.filter((e) => e != this);
    this.modal.saveConfig();
  }

  update(def={}) {
    this.def = Hexular.util.merge({}, this.def, def);
    this.updateThumb();
  }

  updateThumb() {
    this.thumb.querySelectorAll('polygon').forEach((polygon, elemIdx) => {
      let idx = 18 - elemIdx;
      polygon.setAttribute('id', '');
      polygon.setAttribute('class', '');
      let state = this.def.states[idx];
      if (state == 1)
        polygon.classList.add('active');
      else if (state == 0)
        polygon.classList.add('inactive');
    })
  }

  handleDrag(ev) {
    ev.dataTransfer.setData('text/plain', this.modal.templateControls.indexOf(this));
    ev.dataTransfer.dropEffect = 'move';
  }

  handleDragOver(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  }

  handleDrop(ev) {
    let sourceIdx = parseInt(ev.dataTransfer.getData('text/plain'));
    let targetIdx = this.modal.templateControls.indexOf(this);
    if (!isNaN(sourceIdx)) {
      let {y, height} = this.controller.getBoundingClientRect();
      y = ev.pageY - y;
      let newIdx = y < height / 2 ? targetIdx : targetIdx + 1;
      if (newIdx == sourceIdx || newIdx == sourceIdx + 1)
        return;
      if (newIdx > sourceIdx)
        newIdx --;
      let [droppedControl] = this.modal.templateControls.splice(sourceIdx, 1);
      this.modal.templateControls.splice(newIdx, 0, droppedControl);
      while (this.modal.templateList.firstChild)
        this.modal.templateList.firstChild.remove();
      this.modal.templateControls.forEach((control) => {
        this.modal.templateList.appendChild(control.controller);
      });
      this.modal.checkRuleDirty();
      this.modal.saveConfig();
    }
  }
}
