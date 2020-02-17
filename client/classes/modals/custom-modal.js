class CustomModal extends Modal {
  constructor(...args) {
    super(...args);
    this.selectExample = document.querySelector('#select-example').select;
    this.input = document.querySelector('#custom-input');
    this.button = document.querySelector('#add-custom-code');
    this.output = document.querySelector('#custom-output');

    this.selectExample.onchange = (ev) => {
      if (this.selectExample.value)
        this.input.value = Examples.customCodeDemos[this.selectExample.value];
    };

    this.input.oninput = (ev) => this.selectExample.value = null;
    this.output.onclick = (ev) => this.output.select();

    this.button.onclick = (ev) => {
      if (this.input.value == '') {
        this.board.setMessage('Nothing to run!', 'error');
        return;
      }
      try {
        let evalFn = new Function('Hexular', 'Board', 'value', 'return eval(value)')
        let output = evalFn(Hexular, Board, this.input.value);
        this.output.value = output;
        this.board.setMessage('Done!');
      }
      catch (err) {
        this.board.setMessage(`An error occurred: ${err}.`, 'error');
      }
    }
  }

  reset() {
    this.selectExample.replace(Object.keys(Examples.customCodeDemos), null, 1);
    if (this.input.value == '')
      this.input.value = this.input.placeholder;
  }
}