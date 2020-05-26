class CustomModal extends Modal {
  constructor(...args) {
    super(...args);
    this.selectExample = document.querySelector('#select-example').select;
    this.input = document.querySelector('#custom-input');
    this.output = document.querySelector('#custom-output');
    this.import = document.querySelector('#import'),
    this.button = document.querySelector('#add-custom-code');

    this.selectExample.onchange = (ev) => {
      let str = Examples.customCodeDemos[this.selectExample.value];
      if (str) {
        if (document.execCommand) {
          this.input.focus();
          this.input.select();
          document.execCommand("delete", false, str);
          document.execCommand("insertText", false, str);
        }
        else {
          this.input.value = str;
        }
      }
    };

    this.input.oninput = (ev) => {
      this.selectExample.value = null;
      Util.handleTextFormat(this.input, ev);
    };

    this.input.onchange = (ev) => this.config.setCustomInput(this.input.value);

    this.output.onclick = (ev) => this.output.select();

    this.import.onclick = (ev) => this.board.import();

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
