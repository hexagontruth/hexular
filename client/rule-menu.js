class RuleMenu {
  constructor(modal, idx, selected, disabled) {
    this.modal = modal;
    this.board = modal.board;
    this.index = idx;
    let rules = this.board.availableRules;
    let prototype = document.querySelector('.assets .rule-menu');
    let container = this.container = prototype.cloneNode(true);
    let select = this.select = container.querySelector('select');
    let indicator = this.indicator = container.querySelector('.indicator');
    select.ruleMenu = this;
    container.title = `State ${idx}`;
    container.setAttribute('data-disabled', disabled);
    indicator.style.backgroundColor = this.board.bgAdapter.colors[idx];
    for (let [ruleName, fn] of Object.entries(rules)) {
      let option = document.createElement('option');
      option.text = ruleName;
      option.selected = selected == fn;
      select.appendChild(option);
    }
    indicator.addEventListener('mousedown', (ev) => {
      this.checked = !this.checked;
      this.modal.checkState = this.checked;
      ev.preventDefault();
    });
    indicator.addEventListener('mousemove', (ev) => {
      if (this.modal.checkState != null)
        this.checked = this.modal.checkState;
    });
  }

  set checked(val) {
    if (val) this.container.classList.add('checked');
    else this.container.classList.remove('checked');
  }

  get checked() {
    return this.container.classList.contains('checked');
  }

  set(ruleName) {
    let fn = this.board.availableRules[ruleName];
    if (!fn) {
      fn = this.board.availableRules[this.board.defaultRule];
      ruleName = this.board.defaultRule;
    }
    this.select.value = ruleName;
    this.board.model.rules[this.index] = fn;
  }
}