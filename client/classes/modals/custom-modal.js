class CustomModal extends Modal {
  constructor(...args) {
    super(...args);
    this.selectSnippet = document.querySelector('#select-snippet').select;
    this.input = document.querySelector('#snippet-input');
    this.output = document.querySelector('#snippet-output');
    this.import = document.querySelector('#import');
    this.addButton = document.querySelector('#add-snippet');
    this.runButton = document.querySelector('#run-custom-code');
    this.snippetFields = {};
    this.editMode = true;

    this.selectSnippet.onchange = (ev) => {
      let text = this.config.snippets[this.selectSnippet.value];
      this.addButton.disabled = !!text;
      if (text) {
        this.editMode = false; // ugh
        Util.execInsert(this.input, text);
        this.setSnippetFields({name: this.selectSnippet.value, text});
        this.editMode = true;
      }
    };

    this.input.oninput = (ev) => {
      Util.handleTextFormat(this.input, ev);
      if (this.editMode) {
        this.selectSnippet.value = null;
        this.addButton.disabled = false;
      }
    };

    this.input.onchange = (ev) => {
      this.setSnippetFields({text: this.input.value});
    }

    this.output.onclick = (ev) => this.output.select();

    this.import.onclick = (ev) => this.board.import();

    this.addButton.onclick = (ev) => this.handleAddSnippet();

    this.runButton.onclick = (ev) => {
      if (this.input.value == '') {
        this.board.setMessage('Nothing to run!', 'warning');
        return;
      }
      try {
        let evalFn = new Function('Hexular', 'Board', 'Util', 'value', 'return eval(value)')
        let output = evalFn(Hexular, Board, Util, this.input.value);
        this.output.value = output;
        this.board.setMessage('Done!');
      }
      catch (err) {
        this.board.setMessage(`Error: ${err}.`, 'error');
      }
    }
  }

  update() {
    this.selectSnippet.replace(Object.keys(this.config.snippets).sort(), null, 1);
    this.reset();
  }

  reset() {
    this.snippetFields = Hexular.util.merge({}, this.config.snippetFields);
    this.addButton.disabled = !!this.snippetFields.name;
    this.selectSnippet.value = this.snippetFields.name;
    this.input.value = this.snippetFields.text;
  }

  setSnippetFields(fields) {
    if (!fields.name && fields.text && fields.text != this.snippetFields.text)
      fields.name = null;
    this.snippetFields = Object.assign(this.snippetFields, fields);
    this.config.setSnippetFields(this.snippetFields);
  }

  handleAddSnippet() {
    // TODO: Replace native prompt
    let snippetName = window.prompt('Please enter a snippet name:');
    if (snippetName) {
      this.config.addSnippet(snippetName, this.config.snippetFields.text);
      this.config.setSnippetFields({name: snippetName});
      this.reset();
    }
  }
}
