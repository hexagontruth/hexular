class SrbModal extends Modal {
  constructor(...args) {
    super(...args);
    this.ruleName = document.querySelector('#rule-name');
    this.selectAvailable = document.querySelector('#select-available').select;
    this.checkAll = document.querySelector('#rule-select-all');
    this.ruleMiss = document.querySelector('#rule-miss').select;
    this.ruleMatch = document.querySelector('#rule-match').select;
    this.stateGrid = document.querySelector('#state-grid');
    this.ruleString = document.querySelector('#rule-string');
    this.resetButton = document.querySelector('#reset-rule');
    this.addButton = document.querySelector('#add-rule');
    this.stateElements = [];
    this.settingState = null;
    this.updateRuleStringPending = false;

    while (this.stateGrid.firstChild)
      this.stateGrid.firstChild.remove();
    let template = document.querySelector('.statemask');
    this.config.rbStates.forEach((state, i) => {
      let item = template.cloneNode(true);
      this.stateElements.push(item);
      item.setAttribute('title', i);
      let nbrs = item.querySelectorAll('polygon');

      Array.from(nbrs).slice(1).forEach((nbr, j) => {
        let bit = (i >>> (5 - j)) % 2;
        if (!bit)
          nbr.classList.add('off');
      });
      this.stateGrid.appendChild(item);
      item.onmousedown = () => {
        this.settingState = !this.config.rbStates[i];
        this.setState(i);
      };
      item.onkeydown = (ev) => {
        if (ev.key == ' ' || ev.key == 'Enter') {
          this.setState(i, !this.config.rbStates[i]);
          this.updateRuleString();
          this.config.storeSessionConfigAsync();
        }
      }
      item.onmousemove = () => {
        this.settingState != null && this.setState(i);
      }
    });

    this.modal.onmouseup = this.modal.onmouseleave = () => {
      this.settingState = null;
      this.updateRuleString();
      this.config.storeSessionConfigAsync();
    };

    this.selectAvailable.onchange = () => {
      let rule = this.selectAvailable.value;
      this.config.setRbName(rule);
      let fn = this.config.availableRules[rule];
      if (fn) {
        let obj = JSON.parse(fn);
        delete obj[1].range;
        fn = JSON.stringify(obj);
        this.ruleString.value = fn.toString();
      }
      this.parseRuleString();
    };

    this.checkAll.onclick = () => this._handleCheckAll();

    this.ruleName.onchange = () => this.config.setRbName();

    this.ruleName.oninput = () => {
      if (this.ruleName.value.length > 0)
        this.addButton.disabled = false;
      else
        this.addButton.disabled = true;
    };

    this.ruleMiss.onchange = () => this.config.setRbMiss();
    this.ruleMatch.onchange = () => this.config.setRbMatch();

    this.ruleString.oninput = () => this.parseRuleString();
    this.ruleString.onfocus = () => this.ruleString.select();

    this.resetButton.onclick = () => this.clear();

    this.addButton.onclick = () => {
      let [rule, opts] = this.getRuleString();
      if (!rule) {
        rule = this._getMasks();
        opts = this._getOpts();
      }
      let fn = Hexular.util.ruleBuilder(rule, opts);
      this.config.addRule(this.ruleName.value, fn);
      this.board.setMessage(`Rule #${fn.n} added!`);
      console.log('Rule added:', [rule, opts]);
    };
  }

  clear() {
    this.config.setRbMiss([Config.defaults.rbMiss, Config.defaults.rbMissRel]);
    this.config.setRbMatch([Config.defaults.rbMatch, Config.defaults.rbMatchRel]);
    this.config.setRbName(Config.defaults.rbName);
    this.config.rbRel = Config.defaults.rbRel;
    this.setStates([], false);
    this.updateRuleString();
  }

  update() {
    let rbRules = Object.entries(this.config.availableRules).filter(([rule, fn]) => fn.n).map(([rule, fn]) => rule);
    this.selectAvailable.replace(rbRules, this.ruleName.value, 1);
  }

  setState(idx, value=this.settingState) {
    let states = this.config.rbStates;
    states[idx] = value
    let item = this.stateElements[idx];
    if (value) {
      item.classList.add('active');
      if (!states.some((e) => !e)) {
        this.checkAll.classList.add('active');
      }
    }
    else {
      item.classList.remove('active');
      this.checkAll.classList.remove('active');
    }
  }

  setStates(array, value=this.settingState) {
    let states = this.config.rbStates;
    states.fill(false);
    this.stateElements.forEach((e) => e.classList.remove('active'));
    array.forEach((idx) => {
      if (states[idx] == null)
        return;
      states[idx] = value;
      if (value)
        this.stateElements[idx].classList.add('active');
      else
        this.stateElements[idx].classList.remove('active');
    });
    if (states.filter((e) => e).length == 64)
      this.checkAll.classList.add('active');
    else
      this.checkAll.classList.remove('active');
  }

  getRuleString() {
    let rule, opts;
    try {
      [rule, opts] = JSON.parse(this.ruleString.value);
    }
    catch {};
    if (!Array.isArray(rule))
      rule = null;
    opts = opts || {};
    return [rule, opts];
  }

  updateRuleString() {
    if (!this.updateRuleStringPending) {
      this.updateRuleStringPending = true;
      requestAnimationFrame(() => {
        let [strRule, strOpts] = this.getRuleString();
        let configRule = this._getMasks();
        let [miss, missRel] = [this.config.rbMiss, this.config.rbMissRel];
        let [match, matchRel] = [this.config.rbMatch, this.config.rbMatchRel];
        let rel = this.config.rbRel;
        let rule = configRule ? configRule : strRule;
        let opts = Config.merge({}, strOpts, {miss, match, missRel, matchRel, rel});
        let ruleString  = JSON.stringify([rule, opts]);
        if (this.ruleString.value != ruleString) {
          this.ruleString.value = ruleString;
          this.selectAvailable.value = null;
        }
        this.updateRuleStringPending = false;
      });
    }

  }

  parseRuleString() {
    let [rules, opts] = this.getRuleString();
    if (rules) {
      this.setStates(rules, true);
      let {miss, match, missRel, matchRel, rel} = opts;
      this.config.rbRel = rel;
      this.config.setRbMiss([miss, missRel]);
      this.config.setRbMatch([match, matchRel]);
      this.config.storeSessionConfigAsync();
    }
  }

  _handleCheckAll() {
    this.settingState = this.checkAll.classList.toggle('active');
    for (let i = 0; i < 64; i++)
      this.setState(i);
    this.settingState = null;
    this.updateRuleString();
    this.config.storeSessionConfigAsync();
  }

  _getMasks() {
    return this.config.rbStates.map((e, i) => e && i).filter((e) => e !== false);
  }

  _getOpts() {
    return {
      miss: this.config.rbMiss,
      missRel: this.config.rbMissRel,
      match: this.config.match,
      matchRel: this.config.matchRel,
    };
  }
}
