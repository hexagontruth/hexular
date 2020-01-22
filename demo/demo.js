// --- INIT ---

const DEFAULTS = {
  config: {
    rows: 100,
    cols: 100,
    radius: 60,
    numStates: 6,
    cellRadius: 10,
    groundState: 0
  },
  maxNumStates: 12,
  timerLength: 100,
  rules: RULES,
  defaultRule: 'identityRule',
  defaultFilename: 'hexular.bin',
  preset: 'default',
  presets: PRESETS,
};

let keyWhitelist = [
  'Escape',
  'Shift',
  'Tab',
  ' '
];

let hexular, adapter, board;

class Board {
  constructor(...args) {
    let props = {
      shift: null,
      selected: null,
      lastSet: null,
      setState: null,
      timer: null,
      ruleMenus: [],
      backwardStack: [],
      forwardStack: [],
      stateChange: new StateChange(),
      header: document.querySelector('.header'),
      container: document.querySelector('.container'),
      overlay: document.querySelector('.overlay'),
      ruleConfig: document.querySelector('.rule-config'),
      buttons: {
        toggle: document.querySelector('#toggle'),
        step: document.querySelector('#step'),
        clear: document.querySelector('#clear'),
        undo: document.querySelector('#undo'),
        redo: document.querySelector('#redo'),
        save: document.querySelector('#save'),
        load: document.querySelector('#load'),
        config: document.querySelector('#config'),
      },
      controls: {
        selectPreset: document.querySelector('#select-preset'),
        customRule: document.querySelector('#custom-rule'),
        addRule: document.querySelector('#add-rule'),
        checkAll: document.querySelector('#check-all'),
        setAll: document.querySelector('#set-all'),
        numStates: document.querySelector('#num-states'),
      }
    };
    Object.assign(this, DEFAULTS, props);
    Object.assign(this.config, ...args);
    this.config.rules = Object.assign(
      Array(this.maxNumStates).fill(this.rules[this.defaultRule]),
      this.presets[this.preset].map((e) => this.rules[e])
    );
    this.bg = document.createElement('canvas');
    this.fg = document.createElement('canvas');
    this.bg.classList.add('canvas', 'canvas-bg');
    this.fg.classList.add('canvas', 'canvas-fg');
    this.bgCtx = this.bg.getContext('2d');
    this.fgCtx = this.fg.getContext('2d');

    while (this.container.firstChild) this.container.firstChild.remove();
    this.container.appendChild(this.bg);
    this.container.appendChild(this.fg);
    this.controls.numStates.value = this.config.numStates;
    this.customRuleTemplate = this.controls.customRule.value;
    this.center();

    window.onkeydown = (ev) => this.keydown(ev);
    window.onmousedown = (ev) => this.mousedown(ev);
    window.onmouseup = (ev) => this.mouseup(ev);
    window.onmouseout = (ev) => this.mouseup(ev);
    this.fg.oncontextmenu = (ev) => this.contextmenu(ev);
    this.fg.onmousemove = (ev) => this.mousemove(ev);

    this.buttons.toggle.onclick = (ev) => this.toggle();
    this.buttons.step.onclick = (ev) => this.step();
    this.buttons.clear.onclick = (ev) => this.clear();
    this.buttons.undo.onclick = (ev) => this.undo();
    this.buttons.redo.onclick = (ev) => this.redo();
    this.buttons.save.onclick = (ev) => this.save();
    this.buttons.load.onclick = (ev) => this.load();
    this.buttons.config.onclick = (ev) => this.toggleConfig();

    this.controls.addRule.onclick = (ev) => this.handleAddRule();
    this.controls.checkAll.onclick = (ev) => this.checkAll();
    this.controls.numStates.onchange = (ev) => this.setNumStates(ev.target.value);
    this.controls.selectPreset.onchange = (ev) => this.selectPreset(ev.target.value);
    this.controls.setAll.onchange = (ev) => this.setAll(ev.target.value);
  }

  center() {
    let radius = this.config.radius;
    let cellRadius = this.config.cellRadius;
    for (let ctx of [this.bgCtx, this.fgCtx]) {
      ctx.canvas.width = radius * cellRadius * Hexular.math.apothem * 4;
      ctx.canvas.height = radius * cellRadius * 3;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
  }

  get running() { return !!this.timer; }

  // Button handlers (can also be called directly)

  toggle() {
    if (!this.running) {
      this.timer = setInterval(this.step, this.config.timerLength);
      this.buttons.step.disabled = true;
      this.buttons.toggle.innerHTML = 'pause';
    }
    else {
      clearInterval(this.timer);
      this.timer = null;
      this.buttons.step.disabled = false;
      this.buttons.toggle.innerHTML = 'play_arrow';
    }
  }

  step() {
    hexular.step();
    adapter.draw();
  }

  toggleConfig() {
    this.overlay.classList.toggle('hidden');
  }

  clear() {
    if (this.running) this.toggle();
    hexular.getCells().forEach((cell) => {
      this.stateChange.add(cell, cell.state, hexular.groundState);
    });
    this.newStateChange();
    hexular.clear();
    adapter.draw();
  }

  save() {
    let bytes = hexular.export();
    let blob = new Blob([bytes], {type: 'application/octet-stream'});
    let a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = this.defaultFilename;
    a.click();
  }

  load() {
    let fileReader = new FileReader();
    let input = document.createElement('input');
    input.type = 'file';
    fileReader.onload = (ev) => {
      let buffer = ev.target.result;
      let bytes = new Int8Array(buffer);
      let cells = hexular.getCells()
      let curStates = cells.map((e) => e.state);
      hexular.import(bytes);
      adapter.draw();
      cells.forEach((cell, idx) => {
        this.stateChange.add(cell, curStates[idx], cell.state);
      });
      this.newStateChange();
    };
    input.onchange = () => {
      fileReader.readAsArrayBuffer(input.files[0]);
    };
    input.click();
  }

  // Page/canvas listeners

  keydown(ev) {
    let key = ev.key.toLowerCase();
    if (!ev.repeat) {
      // ESC to hide/show controls
      if (ev.key == 'Escape') {
        if (!this.overlay.classList.contains('hidden')) {
          this.toggleConfig();
        }
        else {
          this.header.classList.toggle('hidden');
        }
      }

      // TAB to start/stop
      else if (ev.key == 'Tab') {
        this.toggle();
        ev.preventDefault();
      }

      // SPACE to step or stop
      else if (ev.key == ' ') {
        if (this.running) {
          this.toggle();
        }
        else {
          this.step();
        }
      }

      else if (key == 's') {
        this.save();
      }

      else if (key == 'l') {
        this.load();
      }
    }
    if (keyWhitelist.indexOf(ev.key) != -1) {
      ev.preventDefault();
    }
  }

  contextmenu(ev) { ev.preventDefault(); }

  mousedown(ev) {
    if (ev.target == this.fg && this.selected) {
      if (ev.buttons & 1) {
        this.shift = ev.shiftKey;
        this.setState = Hexular.math.mod(this.selected.state + 1, this.config.numStates);
        this.setCell(this.selected);
      }
      else if (ev.buttons & 2) {
        this.setState = Hexular.math.mod(this.selected.state - 1, this.config.numStates);
        this.setCell(this.selected);
      }
    }
    else if (ev.target == this.overlay) {
      this.toggleConfig();
    }
  }

  mousemove(ev) {
    let {x, y} = this.fg.getBoundingClientRect();
    x = Math.max(0, x);
    y = Math.max(0, y);
    let cell = adapter.cellAt([
      ev.pageX - this.fg.width / 2 - x,
      ev.pageY - this.fg.height / 2 - y
    ]);
    this.selectCell(cell);
    if (this.setState != null)
      this.setCell(cell);
  }

  mouseup() {
    this.shift = false;
    this.lastSet = null;
    this.setState = null;
    this.newStateChange();
  }

  selectCell(cell) {
    this.selected = cell;
    adapter.selectCell(cell);
  }

  setCell(cell) {
    if (cell) {
      if (cell != this.lastSet) {
        let setState = this.shift ? 0 : this.setState;
        this.stateChange.add(cell, cell.state, setState);
        cell.state = setState;
        this.lastSet = cell;
        adapter.selectCell();
        adapter.drawCell(cell);
      }
    }
  }

  newStateChange() {
    if (!this.stateChange.empty) {
      this.backwardStack.push(this.stateChange);
      this.forwardStack = [];
      this.stateChange = new StateChange();
      this.buttons.undo.disabled = false;
    }
  }

  undo() {
    let stateChange = this.backwardStack.pop();
    if (!stateChange)
      return;
    stateChange.backward();
    this.forwardStack.push(stateChange);
    this.buttons.undo.disabled = +!this.backwardStack.length;
    this.buttons.redo.disabled = +!this.forwardStack.length;
    adapter.draw();
  }

  redo() {
    let stateChange = this.forwardStack.pop();
    if (!stateChange)
      return;
    stateChange.forward();
    this.backwardStack.push(stateChange);
    this.buttons.redo.disabled = +!this.forwardStack.length;
    adapter.draw();
  }

  handleAddRule() {
    try {
      let obj = new Function(`return (${this.controls.customRule.value})`)();
      Object.assign(this.rules, obj);
      this.refreshRules();
      let ruleNames = Object.keys(obj);
      this.controls.customRule.disabled = true;
      this.controls.customRule.value =
        `Successfully add rule${ruleNames.length > 1 ? 's' : ''} ${ruleNames.join(', ')}.`;
      setTimeout(() => {
        this.controls.customRule.disabled = false;
        this.controls.customRule.value = this.customRuleTemplate;
      }, 2000);
    }
    catch (err) {
      console.error(`An error occurred while trying to add custom rules: ${err}. Too bad.`);
    }
  }

  checkAll() {
    let check = !this.ruleMenus.every((ruleMenu) => ruleMenu.checked);
    if (check)
      this.controls.checkAll.classList.add('checked');
    else
      this.controls.checkAll.classList.remove('checked');
    this.ruleMenus.forEach((ruleMenu) => {
      ruleMenu.checked = check;
    });
  }

  setNumStates(val) {
    if (val)
      this.controls.numStates.value = val;
    const numStates = parseInt(this.controls.numStates.value);
    hexular.numStates = parseInt(numStates);
    this.ruleMenus.forEach((ruleMenu) => {
      let disabled = ruleMenu.index >= numStates;
      ruleMenu.select.setAttribute('data-disabled', disabled);
      hexular.rules[ruleMenu.index] = this.config.rules[ruleMenu.index];
    });
    this.checkPreset();
  }

  setAll(ruleName) {
    const rule = this.rules[ruleName] || this.rules.identityRule;
    this.ruleMenus.forEach((ruleMenu) => {
      ruleMenu.select.value = ruleName;
      hexular.rules[ruleMenu.index] = rule;
    });
    this.controls.setAll.selectedIndex = 0;
    this.checkPreset();
  }

  setRule(ev) {
    const ctl = ev.target;
    hexular.rules[ctl.ruleMenu.index] = this.rules[ctl.value] || this.rules.identityRule;
    this.checkPreset();
  }

  selectPreset(presetName) {
    const presetList = this.presets[presetName];
    if (!presetList)
      return;
    this.setNumStates(presetList.length);
    this.ruleMenus.forEach((ruleMenu) => {
      let ruleName = presetList[ruleMenu.index] || 'identityRule';
      let fn = this.rules[ruleName];
      ruleMenu.select.value = ruleName;
      hexular.rules[ruleMenu.index] = fn;
    });
    this.preset = presetName;
    this.controls.selectPreset.value = presetName;
  }

  checkPreset() {
    const presetList = this.presets[this.preset];
    if (!presetList)
      return;
    let dirty = (() => {
      if (hexular.numStates != presetList.length)
        return true;
      return hexular.rules.slice(0, hexular.numStates).reduce((a, ruleFn, idx) => {
        return a || this.rules[idx] != ruleFn;
      }, false);
    })();
    if (dirty) {
      this.controls.selectPreset.selectedIndex = 0;
      this.preset = null;
    }
  }

  refreshRules() {
    // Refresh presets
    this.controls.selectPreset.options.length = 1;
    for (let presetName of Object.keys(this.presets)) {
      let option = document.createElement('option');
      option.text = presetName;
      option.selected = presetName == this.preset;
      this.controls.selectPreset.appendChild(option);
    }

    // Refresh rules
    this.controls.setAll.options.length = 1;
    for (let ruleName of Object.keys(this.rules)) {
      let option = document.createElement('option');
      option.text = ruleName;
      this.controls.setAll.appendChild(option);
    }

    while (this.ruleConfig.firstChild) this.ruleConfig.firstChild.remove();
    this.ruleMenus = [];

    for (let i = 0; i < this.maxNumStates; i++) {
      let ruleMenu = new RuleMenu(i, this.rules, hexular.rules[i], i >= hexular.numStates);
      ruleMenu.select.addEventListener('change', (ev) => this.setRule(ev));
      this.ruleMenus.push(ruleMenu);
      this.ruleConfig.appendChild(ruleMenu.container);
    }
  }

  addRule(ruleName, fn) {
    this.rules[ruleName] = fn;
    this.refreshRules();
  }

  addPreset(presetName, fnArray) {
    this.presets[presetName] = fnArray;
    this.refreshRules();
  }
}

class RuleMenu {
  constructor(idx, rules, selected, disabled) {
    this.index = idx;
    let prototype = document.querySelector('.assets .rule-menu');
    let container = this.container = prototype.cloneNode(true);
    let select = this.select = container.querySelector('select');
    let indicator = this.indicator = container.querySelector('.indicator');
    select.ruleMenu = this;
    select.title = `State ${idx}`;
    select.setAttribute('data-disabled', disabled);
    indicator.style.backgroundColor = adapter.colors[idx];
    for (let [ruleName, fn] of Object.entries(rules)) {
      let option = document.createElement('option');
      option.text = ruleName;
      option.selected = selected == fn;
      select.appendChild(option);
    }
    indicator.addEventListener('click', (ev) => {
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
}

class StateChange {
  constructor() {
    this.backwardMap = new Map();
    this.forwardMap = new Map();
  }

  add(cell, oldState, newState) {
    if (this.backwardMap.has(cell))
      return;
    this.backwardMap.set(cell, oldState);
    this.forwardMap.set(cell, newState);
  }

  get empty() {
    return this.backwardMap.size == 0;
  }

  backward() {
    this.backwardMap.forEach((state, cell) => {
      cell.state = state;
    });
  }

  forward() {
    this.forwardMap.forEach((state, cell) => {
      cell.state = state;
    });
  }
}

window.addEventListener('DOMContentLoaded', function(e) {
  let opts = {};
  location.search.substring(1).split('&').filter((e) => e.length > 0).forEach((e) => {
    let pair = e.split('=');
    let parsedInt = parseInt(pair[1]);
    opts[pair[0]] = Number.isNaN(parsedInt) ? pair[1] : parsedInt;
  });
  board = new Board(opts);
  hexular = Hexular(board.config);
  hexular.addFilter(Hexular.filters.modFilter);
  adapter = hexular.CanvasAdapter(
    {renderer: board.bgCtx, selector: board.fgCtx},
    board.config
  );

  window.requestAnimationFrame(() => {
    adapter.draw();
    board.refreshRules();
    document.body.style.opacity = 1;
    window.scrollTo(
      (board.fg.width - window.innerWidth) / 2,
      (board.fg.height- window.innerHeight) / 2
    );
  });

});