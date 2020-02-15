class RbModal extends Modal {
  constructor(...args) {
    super(...args);
    let masks = this.config.rbMasks;
    this.ruleName = document.querySelector('#rule-name');
    this.selectAvailable = document.querySelector('#select-available').select;
    this.selectAll = document.querySelector('#rule-select-all');
    this.ruleMiss = document.querySelector('#rule-miss').select;
    this.ruleMatch = document.querySelector('#rule-match').select;
    this.maskGrid = document.querySelector('#mask-grid');
    this.ruleString = document.querySelector('#rule-string');
    this.add = document.querySelector('#add-rule');
    this.maskElements = [];
    this.setState = null;

    while (this.maskGrid.firstChild)
      this.maskGrid.firstChild.remove();
    let template = document.querySelector('.rulemask');
    masks.forEach((state, i) => {
      let item = template.cloneNode(true);
      this.maskElements.push(item);
      item.setAttribute('title', i);
      let nbrs = item.querySelectorAll('polygon');

      Array.from(nbrs).slice(1).forEach((nbr, j) => {
        let bit = (i >>> (5 - j)) % 2;
        if (!bit)
          nbr.classList.add('off');
      });
      this.maskGrid.appendChild(item);
      item.onmousedown = () => {
        this.setState = !masks[i];
        this.setMask(i);
      };
      item.onkeydown = (ev) => {
        if (ev.key == ' ' || ev.key == 'Enter') {
          this.setMask(i, !masks[i]);
          this.updateRuleString();
          this.config.storeSessionConfigAsync();
        }
      }
      item.onmousemove = () => {
        this.setState != null && this.setMask(i);
      }
    });

    this.modal.onmouseup = this.modal.onmouseleave = () => {
      this.setState = null;
      this.updateRuleString();
      this.config.storeSessionConfigAsync();
    };

    this.selectAvailable.onchange = () => {
      let rule = this.selectAvailable.value;
      this.config.setRuleName(rule + 'Copy');
      let fn = this.config.availableRules[rule];
      if (fn)
        this.ruleString.value = fn.toString();
      this.parseRuleString();
    };

    this.selectAll.onclick = () => {
      this.setState = this.selectAll.classList.toggle('active');
      for (let i = 0; i < 64; i++)
        this.setMask(i);
      this.setState = null;
      this.updateRuleString();
      this.config.storeSessionConfigAsync();
    };

    this.ruleName.onchange = () => this.config.setRuleName();

    this.ruleName.oninput = () => {
      if (this.ruleName.value.length > 0)
        this.add.disabled = false;
      else
        this.add.disabled = true;
    };

    this.ruleMiss.onchange = () => this.config.setRuleMiss();
    this.ruleMatch.onchange = () => this.config.setRuleMatch();

    this.ruleString.onchange = () => this.parseRuleString();
    this.ruleString.onfocus = () => this.ruleString.select();

    this.add.onclick = () => {
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

  update() {
    let rbRules = Object.entries(this.config.availableRules).filter(([rule, fn]) => fn.n).map(([rule, fn]) => rule);
    this.selectAvailable.replace(rbRules, this.ruleName.value, 1);
  }

  setMask(idx, value=this.setState) {
    let masks = this.config.rbMasks;
    masks[idx] = value
    let item = this.maskElements[idx];
    if (value) {
      item.classList.add('active');
      if (!masks.some((e) => !e)) {
        this.selectAll.classList.add('active');
      }
    }
    else {
      item.classList.remove('active');
      this.selectAll.classList.remove('active');
    }
  }

  setMasks(array, value=this.setState) {
    let masks = this.config.rbMasks;
    masks.fill(false);
    this.maskElements.forEach((e) => e.classList.remove('active'));
    array.forEach((idx) => {
      if (masks[idx] == null)
        return;
      masks[idx] = value;
      if (value)
        this.maskElements[idx].classList.add('active');
      else
        this.maskElements[idx].classList.remove('active');
    });
    if (masks.filter((e) => e).length == 64)
      this.selectAll.classList.add('active');
    else
      this.selectAll.classList.remove('active');
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
    let [strRule, strOpts] = this.getRuleString();
    let configRule = this._getMasks();
    let [miss, missDelta] = [this.config.rbMiss, this.config.rbMissDelta];
    let [match, matchDelta] = [this.config.rbMatch, this.config.rbMatchDelta];
    let rule = configRule ? configRule : strRule;
    let opts = Config.merge({}, strOpts, {miss, missDelta, match, matchDelta});
    let ruleString  = JSON.stringify([rule, opts]);
    if (this.ruleString.value != ruleString) {
      this.ruleString.value = ruleString;
      this.selectAvailable.value = null;
    }
  }

  parseRuleString() {
    let [rules, opts] = this.getRuleString();
    if (rules) {
      this.setMasks(rules, true);
      let {miss, missDelta, match, matchDelta} = opts;
      this.config.setRuleMiss([miss, missDelta]);
      this.config.setRuleMatch([match, matchDelta]);
      this.config.storeSessionConfigAsync();
    }
  }

  _getMasks() {
    return this.config.rbMasks.map((e, i) => e && i).filter((e) => e !== false);
  }

  _getOpts() {
    return {
      miss: this.config.rbMiss,
      missDelta: this.config.rbMissDelta,
      match: this.config.match,
      matchDelta: this.config.matchDelta,
    };
  }
}