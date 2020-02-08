class ConfirmModal extends Modal {
  constructor(...args) {
    super(...args);
    this.resolve = null;
    this.text = document.querySelector('#confirmation-text');
    this.buttonYes = document.querySelector('#confirmation-yes');
    this.buttonNo = document.querySelector('#confirmation-no');
    this.buttonNo.onclick = () => {
      this.close();
    }
  }

  close() {
    super.close();
    this.resolve && this.resolve();
  }
  async ask(msg) {
    this.text.innerHTML = msg;
    this.board.toggleModal(this.name);
    return await this._awaitButton();
  }

  _awaitButton() {
    return new Promise((resolve, reject) => {
      this.buttonYes.onclick = () => {
        this.resolve = null;
        resolve(true);
        this.close();
      };
      this.resolve = (value) => {
        this.resolve = null;
        resolve(false);
      };
    });
  }
}