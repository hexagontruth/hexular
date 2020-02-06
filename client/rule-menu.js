class RuleMenu {
  constructor(board, idx, selected, disabled) {
    this.board = board;
    this.index = idx;
    let rules = board.availableRules;
    let prototype = document.querySelector('.assets .rule-menu');
    let container = this.container = prototype.cloneNode(true);
    let select = this.select = container.querySelector('select');
    let indicator = this.indicator = container.querySelector('.indicator');
    select.ruleMenu = this;
    container.title = `State ${idx}`;
    container.setAttribute('data-disabled', disabled);
    indicator.style.backgroundColor = board.bgAdapter.colors[idx];
    for (let [ruleName, fn] of Object.entries(rules)) {
      let option = document.createElement('option');
      option.text = ruleName;
      option.selected = selected == fn;
      select.appendChild(option);
    }
    indicator.addEventListener('mouseup', (ev) => {
      this.checked = !this.checked;
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