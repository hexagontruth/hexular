class RbModal extends Modal {
  constructor(...args) {
    super(...args);
    let template = document.querySelector('.rulemask');
    this.ruleName = document.querySelector('#rule-name');
    this.selectAll = document.querySelector('#rule-select-all');
    this.ruleMiss = document.querySelector('#rule-miss').select;
    this.ruleMatch = document.querySelector('#rule-match').select;
    this.ruleGrid = document.querySelector('#rule-grid');
    this.add = document.querySelector('#add-rule');
    this.masks = Array(64).fill(false);
    this.maskElements = [];
    this.setState = null;

    this.masks.forEach((_, i) => {
      let item = template.cloneNode(true);
      this.maskElements.push(item);
      let nbrs = item.querySelectorAll('polygon');

      Array.from(nbrs).slice(1).forEach((nbr, j) => {
        let bit = (i >>> j) % 2;
        if (!bit)
          nbr.classList.add('off');
      });
      this.ruleGrid.appendChild(item);
      item.onmousedown = () => {
        this.setState = !this.masks[i];
        this._setItem(i);
      };
      item.onmousemove = () => {
        this.setState != null && this._setItem(i);
      }
    });
    this.modal.onmouseup = this.modal.onmouseleave = () => {
      this.setState = null;
    }
    this.selectAll.onclick = () => {
      this.setState = this.selectAll.classList.toggle('active');
      for (let i = 0; i < 64; i++)
        this._setItem(i);
      this.setState = null;
    };
    this.add.onclick = () => {
      let rule = this.masks.map((e, i) => e && i).filter((e) => e);
      let [miss, missDelta] = this.ruleMiss.value.split(':').map((e) => parseInt(e));
      let [match, matchDelta] = this.ruleMatch.value.split(':').map((e) => parseInt(e));
      let opts = {miss, missDelta, match, matchDelta};
      this.config.addRule(this.ruleName.value, Hexular.util.ruleBuilder(rule, opts));
      this.board.setMessage('Rule added!)');
    };
  }

  _setItem(idx) {
    this.masks[idx] = this.setState;
    let item = this.maskElements[idx];
    if (this.setState) {
      item.classList.add('active');
      if (!this.masks.some((e) => !e)) {
        this.selectAll.classList.add('active');
      }
    }
    else {
      item.classList.remove('active');
      this.selectAll.classList.remove('active');
    }

  }
}