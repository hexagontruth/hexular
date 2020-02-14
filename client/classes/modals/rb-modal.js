class RbModal extends Modal {
  constructor(...args) {
    super(...args);
    let masks = this.config.ruleBuilderMasks;
    this.ruleName = document.querySelector('#rule-name');
    this.selectAll = document.querySelector('#rule-select-all');
    this.ruleMiss = document.querySelector('#rule-miss').select;
    this.ruleMatch = document.querySelector('#rule-match').select;
    this.maskGrid = document.querySelector('#mask-grid');
    this.add = document.querySelector('#add-rule');
    this.maskElements = [];
    this.setState = null;

    while (this.maskGrid.firstChild)
      this.maskGrid.firstChild.remove();
    let template = document.querySelector('.rulemask');
    masks.forEach((state, i) => {
      let item = template.cloneNode(true);
      this.maskElements.push(item);
      let nbrs = item.querySelectorAll('polygon');

      Array.from(nbrs).slice(1).forEach((nbr, j) => {
        let bit = (i >>> (5 - j)) % 2;
        if (!bit)
          nbr.classList.add('off');
      });
      this.maskGrid.appendChild(item);
      item.onmousedown = () => {
        this.setState = !masks[i];
        this._setItem(i);
      };
      item.onkeydown = (ev) => {
        if (ev.key == ' ' || ev.key == 'Enter') {
          this.setState = !masks[i];
          this._setItem(i);
          this.setState = null;
          this.config.storeSessionConfigAsync();
        }
      }
      item.onmousemove = () => {
        this.setState != null && this._setItem(i);
      }
    });
    this.modal.onmouseup = this.modal.onmouseleave = () => {
      this.setState = null;
      this.config.storeSessionConfigAsync();
    }
    this.selectAll.onclick = () => {
      this.setState = this.selectAll.classList.toggle('active');
      for (let i = 0; i < 64; i++)
        this._setItem(i);
      this.setState = null;
    };
    this.ruleName.onchange = () => {
      let ruleName = this.ruleName.value;
      ruleName = ruleName.length != 0 ? ruleName : null;
      this.config.ruleBuilderName = ruleName;
      this.config.storeSessionConfigAsync();
    }
    this.ruleName.oninput = () => {
      if (this.ruleName.value.length > 0)
        this.add.disabled = false;
      else
        this.add.disabled = true;
    }
    this.ruleMiss.onchange = () => {
      this.config.ruleBuilderMiss = this.ruleMiss.value;
      this.config.storeSessionConfigAsync();
    }
    this.ruleMatch.onchange = () => {
      this.config.ruleBuilderMatch = this.ruleMatch.value;
      this.config.storeSessionConfigAsync();
    }
    this.add.onclick = () => {
      let rule = masks.map((e, i) => e && i).filter((e) => e != false);
      let [miss, missDelta] = this.config.ruleBuilderMiss.split(':').map((e) => parseInt(e));
      let [match, matchDelta] =this.config.ruleBuilderMatch.split(':').map((e) => parseInt(e));
      let opts = {miss, missDelta, match, matchDelta};
      let fn = Hexular.util.ruleBuilder(rule, opts);
      this.config.addRule(this.ruleName.value, fn);
      this.board.setMessage(`Rule #${fn.n} added!`);
    };
  }

  _setItem(idx) {
    let masks = this.config.ruleBuilderMasks;
    masks[idx] = this.setState;
    let item = this.maskElements[idx];
    if (this.setState) {
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
}