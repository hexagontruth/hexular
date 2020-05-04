class TrbModal extends Modal {
  constructor(...args) {
    super(...args);
    this.templateMask = document.querySelector('#template-mask');
    this.templateButtons = Array(19).fill().map((_, i) => {
      let button = this.templateMask.querySelector(`#cell-${('0' + i).slice(-2)}`);
      button.idx = i;
      return button;
    });

    this.buttonMode = null;
    this.maskCells = this.config.trb.maskCells.slice();

    this.templateMask.onmousedown =
      this.templateMask.onmouseup =
      this.templateMask.onmouseover =
      this.templateMask.onmouseleave = (ev) => this.handleTemplateMouse(ev);
    this.templateMask.oncontextmenu = (ev) => ev.preventDefault();
  }

  _endButtonMode() {
    if (this.buttonMode == null)
      return;
    this.buttonMode = null;
    this.config.setTrbMaskCells(this.maskCells);
  }

  _startButtonMode(mode) {
    this.buttonMode = mode;
  }

  _startButtonModeFrom(button, inc = 1) {
    let cur = this.config.trb.templateButtonStates[button.idx];
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
    this.templateButtons.forEach((e) => this.setTemplatebutton(e.idx));
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
        console.log(ev.buttons);
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
