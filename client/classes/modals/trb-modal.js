class TrbModal extends Modal {
  constructor(...args) {
    super(...args);
    this.ruleName = document.querySelector('#trb-rule-name');
    this.selectAvailable = document.querySelector('#trb-select-available').select;
    this.templateList = document.querySelector('#template-list');
    this.templateString = document.querySelector('#template-string');
    this.templateMask = document.querySelector('#template-mask');
    this.templateButtons = Array(19).fill().map((_, i) => {
      let button = this.templateMask.querySelector(`#cell-${('0' + i).slice(-2)}`);
      button.idx = i;
      return button;
    });

    this.selectedName = null;
    this.selectedObject = null;
    this.selectedController = null;
    this.templateControllers = [];

    this.buttonMode = null;
    this.maskCells = this.config.trb.maskCells.slice();

    this.selectAvailable.onchange = () => {
      let rule = this.selectAvailable.value;
      this.loadRule(rule);
    };

    this.templateMask.onmousedown =
      this.templateMask.onmouseup =
      this.templateMask.onmouseover =
      this.templateMask.onmouseleave = (ev) => this.handleTemplateMouse(ev);
    this.templateMask.oncontextmenu = (ev) => ev.preventDefault();
  }

  update() {
    let rbRules = Object.entries(this.config.availableRules).filter(([rule, fn]) => fn.templates).map(([rule, fn]) => rule);
    this.selectAvailable.replace(rbRules, this.ruleName.value, 1);
    this.setTemplateCells();
  }

  reset() {
    this.setTemplateCells();
  }

  loadRule(rule) {
    let fn = this.config.availableRules[rule];
    if (fn) {
      this.selectedObject = fn.toObject();
      this.selectedName = rule;
      this.ruleName.value = rule;
      this.selectAvailable.value = rule;
      this.updateTemplates();
    }
    else {
      this.selectedObject = null;
      this.selectedName = null;
      this.ruleName.value = '';
    }
    this.saveConfig();
  }

  loadTemplate(controller) {
    this.templateControllers.forEach((e) => e.control.classList.remove('active'));
    this.selectedController = controller;
    if (controller) {
      controller.control.classList.add('active');
    }
  }

  updateTemplates() {
    this.templateList.querySelectorAll('.template-control').forEach((e) => e.remove());
    let templateDefs = this.selectedObject && this.selectedObject[0] ? this.selectedObject[0] : [];
    this.templateControllers = templateDefs.map((e) => new TemplateController(this, e));
  }

  saveConfig() {
    let keys = [
      'maskCells',
      'ruleName',
      'selectedName',
      'selectedObject',
    ];
    this.config.setTrb(Hexular.util.extract(this, keys));
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

  setTemplateCell(idx) {
    if (this.buttonMode == null)
      return;
    this.maskCells[idx] = this.buttonMode;
    this.setTemplateButton(idx);
  }

  setTemplateCells() {
    this.maskCells = this.config.trb.maskCells.slice();
    this.templateButtons.forEach((e) => this.setTemplateButton(e.idx));
  }

  setTemplateButton(idx) {
    let button = this.templateButtons[idx];
    let state = this.maskCells[idx];
    button.setAttribute('class', ''); /* smh */
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
    this.thumb.setAttribute('id', null);
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

  updateThumb() {
    this.thumb.querySelectorAll('polygon').forEach((polygon, elemIdx) => {
      let idx = 18 - elemIdx;
      polygon.setAttribute('id', null);
      polygon.setAttribute('class', null);
      let state = this.def.states[idx];
      if (state == 1)
        polygon.classList.add('active');
      else if (state == 0)
        polygon.classList.add('inactive');
    })
  }
}
