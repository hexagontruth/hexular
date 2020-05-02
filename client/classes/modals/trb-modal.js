class TrbModal extends Modal {
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
  }
}
