// --- INIT ---

const DEFAULTS = {
  rows: 100,
  cols: 100,
  radius: 60,
  numStates: 12,
  cellRadius: 10,
  groundState: 0,
  maxNumStates: 12,
  timerLength: 100,
  undoStackSize: 64,
  availableRules: Object.assign({}, Hexular.rules, RULES),
  defaultRule: 'identityRule',
  defaultFilename: 'hexular.bin',
  preset: 'default',
  presets: PRESETS,
  modFilter: 1,
  edgeFilter: 0,
};

let hexular, adapter, board;

class Board {
  constructor(...args) {
    let props = {
      shift: null,
      selected: null,
      lastSet: null,
      setState: null,
      timer: null,
      messageTimer: null,
      ruleMenus: [],
      undoStack: [],
      redoStack: [],
      header: document.querySelector('.header'),
      container: document.querySelector('.container'),
      overlay: document.querySelector('.overlay'),
      message: document.querySelector('.message'),
      info: document.querySelector('.info'),
      ruleConfig: document.querySelector('.rule-config'),
      buttons: {
        toggle: document.querySelector('#toggle'),
        step: document.querySelector('#step'),
        clear: document.querySelector('#clear'),
        undo: document.querySelector('#undo'),
        redo: document.querySelector('#redo'),
        config: document.querySelector('#config'),
        save: document.querySelector('#save'),
        load: document.querySelector('#load'),
        resize: document.querySelector('#resize'),
      },
      controls: {
        numStates: document.querySelector('#num-states'),
        selectPreset: document.querySelector('#select-preset'),
        customRule: document.querySelector('#custom-rule'),
        addRule: document.querySelector('#add-rule'),
        checkAll: document.querySelector('#check-all'),
        setAll: document.querySelector('#set-all'),
        selectNeighborhood: document.querySelector('#select-neighborhood'),
      }
    };
    Object.assign(this, DEFAULTS, props, ...args);
    this.rules = Object.assign(
      Array(this.maxNumStates).fill(this.availableRules[this.defaultRule]),
      this.presets[this.preset].map((e) => this.availableRules[e])
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
    this.controls.numStates.value = this.numStates;
    this.customRuleTemplate = this.controls.customRule.value;
    this.center();

    window.onkeydown = (ev) => this.handleKeydown(ev);
    window.onmousedown = (ev) => this.handleMousedown(ev);
    window.onmouseup = (ev) => this.handleMouseup(ev);
    window.onmouseout = (ev) => this.handleMouseup(ev);
    window.oncontextmenu = (ev) => this.handleContextmenu(ev);
    window.onmousemove = (ev) => this.handleMousemove(ev);

    this.buttons.toggle.onclick = (ev) => this.toggle();
    this.buttons.step.onclick = (ev) => this.step();
    this.buttons.clear.onclick = (ev) => this.clear();
    this.buttons.undo.onclick = (ev) => this.undo();
    this.buttons.redo.onclick = (ev) => this.redo();
    this.buttons.config.onclick = (ev) => this.toggleConfig();
    this.buttons.save.onclick = (ev) => this.save();
    this.buttons.load.onclick = (ev) => this.load();
    this.buttons.resize.onclick = (ev) => this.promptResize();

    this.controls.addRule.onclick = (ev) => this.handleAddRule();
    this.controls.checkAll.onclick = (ev) => this.handleCheckAll();
    this.controls.numStates.onchange = (ev) => this.setNumStates(ev.target.value);
    this.controls.selectPreset.onchange = (ev) => this.selectPreset(ev.target.value);
    this.controls.setAll.onchange = (ev) => this.handleSetAll(ev);
    this.controls.selectNeighborhood.onchange = (ev) => this.setNeighborhood(ev.target.value);
  }

  center() {
    for (let ctx of [this.bgCtx, this.fgCtx]) {
      ctx.canvas.width = this.radius * this.cellRadius * Hexular.math.apothem * 4;
      ctx.canvas.height = this.radius * this.cellRadius * 3;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
  }

  get running() { return !!this.timer; }

  // Button handlers (can also be called directly)

  toggle() {
    if (!this.running) {
      this.timer = setInterval(this.step.bind(this), this.timerLength);
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
    this.newHistoryState();
    try {
      hexular.step();
      adapter.draw();
      this.storeState();
    }
    catch (e) {
      console.log(e);
      this.setMessage(e, 'error');
    }
  }

  clear() {
    this.newHistoryState();
    if (this.running) this.toggle();
    hexular.clear();
    adapter.draw();
    this.storeState();
  }

  toggleConfig() {
    this.overlay.classList.toggle('hidden');
  }

  promptResize() {
    let newSize = prompt('Plz enter new board size > 1 or 0 for default. Rules will be reset and cells outside of new radius will be lost.', hexular.radius);
    if (newSize == null)
      return;
    let n = Number(newSize) || DEFAULTS.radius;
    console.log(newSize);
    if (isNaN(n) || n < 0 || n == 1) {
      this.setMessage('Board size must be natural number > 1', 'error');
    }
    else if (n != hexular.radius) {
      let [base, params] = window.location.href.split('?');
      let paramMap = {};
      params = (params || '').split('&').filter((e) => e != '').map((e) => {
        let [key, value] = e.split('=');
        paramMap[key] = value;
      });
      paramMap.radius = n;
      if (n == DEFAULTS.radius)
        delete paramMap.radius;
      let url = base;
      if (Object.keys(paramMap).length > 0)
        url += '?' + Object.entries(paramMap).map((e) => e.join('=')).join('&');
      location.href = url;
    }
  }

  // Add rule or preset - also use these if adding from console

  addRule(ruleName, fn) {
    this.availableRules[ruleName] = fn;
    this.refreshRules();
  }

  addPreset(presetName, fnArray) {
    this.presets[presetName] = fnArray;
    this.refreshRules();
  }

  // Save/load

  save() {
    let bytes = hexular.export();
    let blob = new Blob([bytes], {type: 'application/octet-stream'});
    let a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = this.defaultFilename;
    a.click();
  }

  load() {
    this.newHistoryState();
    let fileReader = new FileReader();
    let input = document.createElement('input');
    input.type = 'file';
    fileReader.onload = (ev) => {
      let buffer = ev.target.result;
      let bytes = new Int8Array(buffer);
      hexular.import(bytes);
      adapter.draw();
      this.storeState();
    };
    input.onchange = () => {
      fileReader.readAsArrayBuffer(input.files[0]);
    };
    input.click();
  }

  storeState(bytes) {
    bytes = bytes || hexular.export();
    let str = bytes.join('');
    sessionStorage.setItem('modelState', str);
  }

  restoreState() {
    let modelState = sessionStorage.getItem('modelState');
    if (modelState) {
      this.newHistoryState();
      let bytes = new Int8Array(modelState.split(''));
      hexular.import(bytes);
      adapter.draw();
    }
  }

 // Undo/redo stuff

  newHistoryState() {
    this.undoStack.push(hexular.export());
    if (this.undoStack.length > this.undoStackSize)
      this.undoStack.shift();
    this.redoStack = [];
    this.refreshHistoryButtons();
  }

  undo() {
    let nextState = this.undoStack.pop();
    if (nextState) {
      let curState = hexular.export()
      hexular.import(nextState);
      this.storeState(nextState);
      this.redoStack.push(curState);
      adapter.draw();
      this.refreshHistoryButtons();
    }
  }

  redo() {
    let nextState = this.redoStack.pop();
    if (nextState) {
      let curState = hexular.export()
      hexular.import(nextState);
      this.storeState(nextState);
      this.undoStack.push(curState);
      adapter.draw();
      this.refreshHistoryButtons();
    }
  }

  refreshHistoryButtons() {
    this.buttons.undo.disabled = +!this.undoStack.length;
    this.buttons.redo.disabled = +!this.redoStack.length;
  }

  // Page/canvas listeners

  handleKeydown(ev) {
    let key = ev.key.toLowerCase();
    if (!ev.repeat) {
      // ESC to hide/show controls
      if (ev.key == 'Escape') {
        if (!this.overlay.classList.contains('hidden')) {
          this.toggleConfig();
        }
        else {
          this.header.classList.toggle('hidden');
          this.info.classList.toggle('hidden');
        }
      }

      // TAB to start/stop
      else if (ev.key == 'Tab') {
        this.toggle();
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
      else if (ev.ctrlKey) {
        if (key == 'z') {
          if (ev.shiftKey) {
            this.redo();
          }
          else {
            this.undo();
          }
        }
        else if (key == 's') {
          this.save();
        }

        else if (key == 'o') {
          this.load();
        }
        // We'll use ctrl+c (as SIGINT analog) instead of ctrl+n to clear screen or "new grid" if you will
        // b/c Webkit devs just want to see the world burn: https://bugs.chromium.org/p/chromium/issues/detail?id=33056
        else if (key == 'c') {
          this.clear();
        }
        else {
          return; // Do not prevent default for other ctrl key combos
        }

      }
      else {
        return;
      }
      ev.preventDefault();
    }
  }

  handleContextmenu(ev) {
    if (ev.target == this.fg) ev.preventDefault();
  }

  handleMousedown(ev) {
    if (ev.target == this.fg && this.selected) {
      this.newHistoryState();
      if (ev.buttons & 1) {
        this.shift = ev.shiftKey;
        this.setState = Hexular.math.mod(this.selected.state + 1, hexular.numStates);
        this.setCell(this.selected);
      }
      else if (ev.buttons & 2) {
        this.setState = Hexular.math.mod(this.selected.state - 1, hexular.numStates);
        this.setCell(this.selected);
      }
    }
    else if (ev.target == this.overlay) {
      this.toggleConfig();
    }
    else if (ev.target == this.message) {
      this.clearMessage();
    }
  }

  handleMousemove(ev) {
    let cell;
    if (ev.target == this.fg) {
      let {x, y} = this.fg.getBoundingClientRect();
      x = Math.max(0, x);
      y = Math.max(0, y);
      cell = adapter.cellAt([
        ev.pageX - this.fg.width / 2 - x,
        ev.pageY - this.fg.height / 2 - y
      ]);
      this.selectCell(cell);
      if (this.setState != null)
        this.setCell(cell);
    }
    if (ev.target != this.info)
      this.info.innerHTML = cell && cell.coord.map((c) => (c > 0 ? '+' : '-') + ('0' + Math.abs(c)).slice(-2)) || '';
  }

  handleMouseup(ev) {
    this.shift = false;
    this.lastSet = null;
    this.setState = null;
    this.storeState();
  }

  // Cell selection and setting

  selectCell(cell) {
    this.selected = cell;
    adapter.selectCell(cell);
  }

  setCell(cell) {
    if (cell) {
      if (cell != this.lastSet) {
        cell.state = this.shift ? 0 : this.setState;
        this.lastSet = cell;
        adapter.selectCell();
        adapter.drawCell(cell);
      }
    }
  }

  // Alert messages

  setMessage(message, className) {
    className = className || 'alert';
    this.message.classList = 'message active ' + className;
    this.message.innerHTML = message;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.clearMessage();
    }, 5000);
  }

  clearMessage() {
    this.message.className = 'message';
    requestAnimationFrame(() => this.message.innerHTML = '');
    clearTimeout(this.messageTimer);
  }

  handleAddRule() {
    try {
      let obj = new Function(`return (${this.controls.customRule.value})`)();
      if (Object.keys(obj).length < 1) {
        this.setMessage('No rules added. Too bad.');
        return;
      }
      Object.assign(this.availableRules, obj);
      this.refreshRules();
      let ruleNames = Object.keys(obj);
      this.controls.customRule.addClass
      this.setMessage(`Added rule${ruleNames.length > 1 ? 's' : ''} ${ruleNames.join(', ')}.`);
    }
    catch (err) {
      this.setMessage(`An error occurred: ${err}.`, 'error');
    }
  }

  handleCheckAll() {
    let check = !this.ruleMenus.every((ruleMenu) => ruleMenu.checked);
    if (check)
      this.controls.checkAll.classList.add('checked');
    else
      this.controls.checkAll.classList.remove('checked');
    this.ruleMenus.forEach((ruleMenu) => {
      ruleMenu.checked = check;
    });
  }

  handleSetAll(ev) {
    let ruleName = this.controls.setAll.value;
    const rule = this.availableRules[ruleName] || this.rules.identityRule;
    this.ruleMenus.forEach((ruleMenu) => {
      if (ruleMenu.checked) {
        ruleMenu.select.value = ruleName;
        hexular.rules[ruleMenu.index] = rule;
      }
    });
    this.controls.setAll.selectedIndex = 0;
    this.checkPreset();
  }

  handleSetRule(ev) {
    const ctl = ev.target;
    hexular.rules[ctl.ruleMenu.index] = this.availableRules[ctl.value] || this.availableRules.identityRule;
    this.checkPreset();
  }

  // Set default neighborhood for rules using top-level cell helper functions

  setNeighborhood(neighborhood) {
    hexular.setNeighborhood(neighborhood);
  }

  // Preset setting and checking

  selectPreset(presetName) {
    const presetList = this.presets[presetName];
    if (!presetList)
      return;
    this.setNumStates(presetList.length);
    this.ruleMenus.forEach((ruleMenu) => {
      let ruleName = presetList[ruleMenu.index] || 'identityRule';
      let fn = this.availableRules[ruleName];
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
        return a || this.availableRules[idx] != ruleFn;
      }, false);
    })();
    if (dirty) {
      this.controls.selectPreset.selectedIndex = 0;
      this.preset = null;
    }
  }

  setNumStates(val) {
    if (val)
      this.controls.numStates.value = val;
    const numStates = parseInt(this.controls.numStates.value);
    hexular.numStates = parseInt(numStates);
    this.ruleMenus.forEach((ruleMenu) => {
      let disabled = ruleMenu.index >= numStates;
      ruleMenu.container.setAttribute('data-disabled', disabled);
      hexular.rules[ruleMenu.index] = this.rules[ruleMenu.index];
    });
    this.checkPreset();
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
    for (let ruleName of Object.keys(this.availableRules)) {
      let option = document.createElement('option');
      option.text = ruleName;
      this.controls.setAll.appendChild(option);
    }

    while (this.ruleConfig.firstChild) this.ruleConfig.firstChild.remove();
    this.ruleMenus = [];

    for (let i = 0; i < this.maxNumStates; i++) {
      let ruleMenu = new RuleMenu(i, this.availableRules, hexular.rules[i], i >= hexular.numStates);
      ruleMenu.select.addEventListener('change', (ev) => this.handleSetRule(ev));
      this.ruleMenus.push(ruleMenu);
      this.ruleConfig.appendChild(ruleMenu.container);
    }
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
    container.title = `State ${idx}`;
    container.setAttribute('data-disabled', disabled);
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

window.addEventListener('DOMContentLoaded', function(e) {
  let opts = {};
  location.search.substring(1).split('&').filter((e) => e.length > 0).forEach((e) => {
    let pair = e.split('=');
    let parsedInt = parseInt(pair[1]);
    opts[pair[0]] = Number.isNaN(parsedInt) ? pair[1] : parsedInt;
  });
  board = new Board(opts);
  let {rules, rows, cols, radius, numStates, groundState, cellRadius} = board;
  hexular = Hexular({rules, rows, cols, radius, numStates, groundState});
  if (board.modFilter)
    hexular.addFilter(Hexular.filters.modFilter);
  if (board.edgeFilter)
    hexular.addFilter(Hexular.filters.edgeFilter);
  adapter = hexular.CanvasAdapter({renderer: board.bgCtx, selector: board.fgCtx, cellRadius});
  board.restoreState();

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
