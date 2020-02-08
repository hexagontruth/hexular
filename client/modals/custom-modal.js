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
        this.board.setMessage('Done!');
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