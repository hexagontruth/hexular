class TrbModal extends Modal {
  constructor(...args) {
    super(...args);
    this.defaultRule = Hexular.util.templateRuleBuilder();
    this.defaultTemplate = this.defaultRule.defs[0];
    this.ruleNameField = document.querySelector('#trb-rule-name');
    this.selectAvailable = document.querySelector('#trb-select-available').select;
    this.templateList = document.querySelector('#template-list');
    this.templateStringField = document.querySelector('#template-string');
    this.templateMask = document.querySelector('#template-mask');
    this.templateButtons = Array(19).fill().map((_, i) => {
      let button = this.templateMask.querySelector(`#cell-${('0' + i).slice(-2)}`);
      button.idx = i;
      return button;
    });
    this.clearTemplateButton = document.querySelector('#trb-clear-template');
    this.saveTemplateButton = document.querySelector('#trb-save-template');
    this.resetRuleButton = document.querySelector('#trb-reset-rule');
    this.saveRuleButton = document.querySelector('#trb-save-rule');

    this.ruleName = null;
    this.selectedName = null;
    this.selectedDef = null;
    this.selectedController = null;
    this.selectedControllerIdx = null;
    this.templateControllers = [];
    this.templateString = '';
    this.symButton = 0;
    this.maskCells = this.config.trb.maskCells.slice();
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

    this.templateMask.onmousedown =
      this.templateMask.onmouseup =
      this.templateMask.onmouseover =
      this.templateMask.onmouseleave = (ev) => this.handleTemplateMouse(ev);
    this.templateMask.oncontextmenu = (ev) => ev.preventDefault();

    this.clearTemplateButton.onclick = () => {
      this.clearTemplate();
      this.saveConfig();
    }
    this.saveTemplateButton.onclick = () => {
      this.saveTemplate();
    }
    this.resetRuleButton.onclick = () => {
      this.clear();
      this.saveConfig();
    }
    this.saveRuleButton.onclick = () => {
      this.saveRule();
    }
  }

  clear() {
    this.config.setTrb(Config.defaults.trb);
    this.loadConfig();
    this.updateTemplates();
  }

  update() {
    let rbRules = Object.entries(this.config.availableRules).filter(([rule, fn]) => fn.templates).map(([rule, fn]) => rule);
    this.selectAvailable.replace(rbRules, this.ruleNameField.value, 1);
    this.loadConfig();
  }

  reset() {
    this.loadConfig();
  }

  loadConfig() {
    this.ruleName = this.config.trb.ruleName;
    this.ruleNameField.value = this.ruleName;
    this.selectAvailable.value = this.config.trb.selectedName;
    this.loadRule(this.config.trb.selectedName);
    this.maskCells = this.config.trb.maskCells.slice();
    this.templateStringField.value = this.config.trb.templateString;
    if (this.config.trb.selectedControllerIdx != this.selectedControllerIdx)
      this.loadTemplate(this.templateControllers[this.config.trb.selectedControllerIdx]);
    this.setTemplateCells();
  }

  saveConfig() {
    let keys = [
      'ruleName',
      'selectedControllerIdx',
      'selectedName',
      'selectedDef',
      'templateString',
      'symButton',
      'maskCells',
    ];
    this.config.setTrb(Hexular.util.extract(this, keys));
  }

  setRuleName(name) {
    name = name || this.config.trb.ruleName;
    this.ruleName = name;
    this.ruleNameField.value = name;
  }

  loadRule(rule) {
    let fn = this.config.availableRules[rule];
    if (fn) {
      this.selectedDef = fn.toObject()[0];
      this.selectedName = rule;
      this.setRuleName(rule);
      this.selectAvailable.value = rule;
      this.updateTemplates();
    }
    else {
      this.selectedDef = null;
      this.selectedName = null;
      this.setRuleName(null);
    }
  }

  saveRule() {
    let ruleDef = this.templateControllers.map((e) => e.def);
    let ruleFn = Hexular.util.templateRuleBuilder(ruleDef);
    this.config.addRule(this.ruleName, ruleFn);
    this.board.setMessage(`Rule "${this.ruleName}" saved!`)
  }

  clearTemplate() {
    this.setTemplateCells(Config.defaults.trb.maskCells);
  }

  saveTemplate() {
    let templateDef = this.getTemplateDef();
    if (this.selectedController)
      this.selectedController.update(templateDef);
    else
      this.templateControllers.push(new TemplateController(this, templateDef))
  }

  loadTemplate(controller) {
    this.templateControllers.forEach((e) => e.control.classList.remove('active'));
    this.selectedController = controller;
    this.selectedControllerIdx = this.templateControllers.indexOf(controller);
    if (controller) {
      controller.control.classList.add('active');
      this.setTemplateFields(controller.def);
    }
  }

  getTemplateDef() {
    let def = {};
    try {
      def = JSON.parse(this.templateStringField.value);
    }
    catch {}
    return Hexular.util.merge({}, this.defaultTemplate, def);
  }

  updateTemplateString() {
    let def = this.getTemplateDef();
    def.states = this.maskCells.slice();
    this.templateString = this.templateStringField.value = JSON.stringify(def);
  }

  parseTemplateString() {
    let def = this.getTemplateDef();
    this.setTemplateFields(def);
  }

  setTemplateFields(def) {
    this.setTemplateCells(def.states);
    this.updateTemplateString();
  }

  updateTemplates() {
    this.templateList.querySelectorAll('.template-control').forEach((e) => e.remove());
    let templateDefs = this.selectedDef || [];
    this.templateControllers = templateDefs.map((e) => new TemplateController(this, e));
  }

  setTemplateCell(idx) {
    if (this.buttonMode == null)
      return;
    this.maskCells[idx] = this.buttonMode;
    this.setTemplateButton(idx);
    this.updateTemplateString();
  }

  setTemplateCells(maskCells) {
    if (maskCells)
      this.maskCells = maskCells;
    this.templateButtons.forEach((e) => this.setTemplateButton(e.idx));
    this.updateTemplateString();
  }

  setTemplateButton(idx) {
    let button = this.templateButtons[idx];
    let state = this.maskCells[idx];
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
    else if (this.templateButtons.includes(ev.target)) {
      let button = ev.target;
      if (ev.type == 'mousedown' && this.buttonMode == null) {
        let inc;
        if (ev.buttons & 1)
          inc = 1;
        else if (ev.buttons & 2)
          inc = -1;
        else
          return;
        this._startButtonModeFrom(button, inc);
      }
      else if (ev.type == 'mouseup') {
        this._endButtonMode();
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

  _startButtonModeFrom(button, inc = 1) {
    let cur = this.config.trb.maskCells[button.idx];
    let mode = Hexular.math.mod(cur + 1 + inc, 3) - 1;
    this.buttonMode = mode;
  }
}

class TemplateController {

  constructor(modal, def) {
    this.modal = modal;
    this.def = def;
    this.control = document.createElement('div');
    this.control.classList.add('template-control');
    this.control.draggable = true;
    this.control.controller = this;
    this.thumb = modal.templateMask.cloneNode(true);
    this.thumb.setAttribute('id', '');
    this.updateThumb();
    this.control.appendChild(this.thumb);
    this.control.onclick = () => {
      this.modal.loadTemplate(this.modal.selectedController != this && this);
    };
    this.control.ondblclick = () => this.delete();
    modal.templateList.appendChild(this.control);
  }

  delete() {
    this.modal.selectedController == this && this.modal.loadTemplate();
    this.control.remove();
    this.modal.templateControllers = this.modal.templateControllers.filter((e) => e != this);
    this.modal.saveConfig();
  }

  update(def) {
    this.def = Hexular.util.merge({}, def);
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
}
