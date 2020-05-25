class ConfirmModal extends Modal {
  constructor(...args) {
    super(...args);
    this.resolve = null;
    this.text = document.querySelector('#confirmation-text');
    this.buttonContainer = document.querySelector('#confirmation-buttons');
    this.buttons = new Map();
  }

  close() {
    super.close();
    this.resolve && this.resolve();
  }

  async ask(msg, buttons={No: false, Yes: true}, focus=0) {
    this.text.innerHTML = msg;
    let focused;
    Object.entries(buttons).forEach(([buttonText, buttonValue], idx) => {
      let button = document.createElement('button');
      button.innerHTML = buttonText;
      if (idx == focus)
        focused = button;
      button.onclick = 
      this.buttonContainer.appendChild(button);
      this.buttons.set(button, buttonValue);
    });
    focused && focused.focus();
    this.board.toggleModal(this.name);
    return await this._awaitButtons();
  }

  _resolve() {
    this.resolve = null;
    this.close();
    this.buttons.clear();
    this.text.innerHTML = '';
    while (this.buttonContainer.firstChild)
      this.buttonContainer.firstChild.remove();
  }

  _awaitButtons() {
    return new Promise((resolve, reject) => {
      this.buttons.forEach((value, button) => {
        button.onclick = () => {
          this.resolve(value);
        }
      });
      this.resolve = (value=null) => {
        resolve(value);
        this._resolve();
      };
    });
  }

}
