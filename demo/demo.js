// --- INIT ---

const DEFAULTS = {
  config: {
    rows: 100,
    cols: 100,
    radius: 60,
    numStates: 6,
    rules: [
      RULES.standardOff,
      RULES.simpleIncrementor,
      RULES.simpleIncrementor,
      RULES.simpleIncrementor,
      RULES.simpleIncrementor,
      RULES.standardOn
    ],
    cellRadius: 10
  },
  maxNumStates: 12,
  timerLength: 100,
  rules: RULES
};

let keyWhitelist = [
  'Escape',
  'Shift',
  'Tab',
  ' '
];

class Board {
  constructor(...args) {
    let props = {
      shift: null,
      selected: null,
      lastSet: null,
      setState: null,
      timer: null,
      ruleMenus: [],
      header: document.querySelector('.header'),
      container: document.querySelector('.container'),
      overlay: document.querySelector('.overlay'),
      ruleConfig: document.querySelector('.rule-config'),
      controls: {
        toggle: document.querySelector('#toggle'),
        step: document.querySelector('#step'),
        clear: document.querySelector('#clear'),
        config: document.querySelector('#config'),
        states: document.querySelector('#states'),
        ruleAll: document.querySelector('#rule-all')
      }
    };
    Object.assign(this, DEFAULTS, props);
    Object.assign(this.config, ...args);
    this.bg = document.createElement('canvas');
    this.fg = document.createElement('canvas');
    this.bg.classList.add('canvas', 'canvas-bg');
    this.fg.classList.add('canvas', 'canvas-fg');
    this.bgCtx = this.bg.getContext('2d');
    this.fgCtx = this.fg.getContext('2d');

    while (this.container.firstChild) this.container.firstChild.remove();
    this.container.appendChild(this.bg);
    this.container.appendChild(this.fg);
    this.controls.states.value = this.config.numStates;
    this.center();

    window.onkeydown = (ev) => this.keydown(ev);
    window.onmousedown = (ev) => this.mousedown(ev);
    window.onmouseup = (ev) => this.mouseup(ev);
    this.fg.oncontextmenu = (ev) => this.contextmenu(ev);
    this.fg.onmousemove = (ev) => this.mousemove(ev);
    this.controls.toggle.onclick = (ev) => this.toggle(ev);
    this.controls.step.onclick = (ev) => this.handleStep(ev);
    this.controls.clear.onclick = (ev) => this.handleClear(ev);
    this.controls.config.onclick = (ev) => this.handleConfig(ev);
    this.controls.states.onchange = (ev) => this.handleStates(ev);
    this.controls.ruleAll.onchange = (ev) => this.handleRuleAll(ev);
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

  toggle(ev) {
    if (!this.running) {
      this.timer = setInterval(hexular.step.bind(hexular), this.config.timerLength);
      this.controls.step.disabled = true;
      this.controls.toggle.innerHTML = 'pause';
    }
    else {
      clearInterval(this.timer);
      this.timer = null;
      this.controls.step.disabled = false;
      this.controls.toggle.innerHTML = 'play_arrow';
    }
  }

  get running() { return !!this.timer; }

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
      this.handleConfig();
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
  }

  keydown(ev) {
    if (!ev.repeat) {
      // ESC to hide/show controls
      if (ev.key == 'Escape') {
        if (!this.overlay.classList.contains('hidden')) {
          this.handleConfig();
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
          this.handleStep();
        }
      }
    }
    if (keyWhitelist.indexOf(ev.key) != -1) {
      ev.preventDefault();
    }
  }

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

  handleStep() {
    hexular.step();
  }

  handleClear() {
    if (this.running) this.toggle();
    hexular.clear();
  }

  handleConfig() {
    this.overlay.classList.toggle('hidden');
  }

  handleStates() {
    const numStates = parseInt(this.controls.states.value);
    hexular.numStates = parseInt(numStates);
    this.ruleMenus.forEach((ruleMenu) => {
      ruleMenu.disabled = ruleMenu.index >= numStates;
    });
  }

  handleRule(ev) {
    const ctl = ev.target;
    hexular.rules[ctl.index] = this.rules[ctl.value] || this.rules.nullRule;
  }

  handleRuleAll(ev) {
    const ctl = ev.target;
    const rule = this.rules[ctl.value] || this.rules.nullRule;

    this.ruleMenus.forEach((ruleMenu) => {
      ruleMenu.value = ctl.value;
      hexular.rules[ruleMenu.index] = rule;
    });
    ctl.selectedIndex = 0;
  }

  refreshRules() {
    this.controls.ruleAll.options.length = 1;
    for (let rule of Object.keys(this.rules)) {
      let option = document.createElement('option');
      option.text = rule;
      this.controls.ruleAll.appendChild(option);
    }

    this.ruleMenus.forEach((ruleMenu) => ruleMenu.parentNode.remove());
    this.ruleMenus = [];

    for (let i = 0; i < this.maxNumStates; i++) {
      let ruleMenu = document.createElement('select');
      let ruleContainer = document.createElement('div');

      ruleMenu.index = i;
      ruleMenu.title = 'State ' + i;
      ruleMenu.addEventListener('change', (ev) => this.handleRule(ev));

      ruleContainer.classList.add('rule-container');
      ruleContainer.style.borderColor = adapter.colors[i];

      for (let [rule, fn] of Object.entries(this.rules)) {
        let option = document.createElement('option');
        option.text = rule;

        if (hexular.rules[i] == fn)
          option.selected = true;

        ruleMenu.appendChild(option);
      }

      ruleMenu.disabled = i >= hexular.numStates;

      this.ruleMenus.push(ruleMenu);
      ruleContainer.appendChild(ruleMenu);
      this.ruleConfig.appendChild(ruleContainer);
    }
  }

  addRule(ruleName, fn) {
    this.rules[ruleName] = fn;
    this.refreshRules();
  }
}

let hexular, adapter, board;

window.addEventListener('DOMContentLoaded', function(e) {
  let opts = {};
  location.search.substring(1).split('&').filter((e) => e.length > 0).forEach((e) => {
    let pair = e.split('=');
    let parsedInt = parseInt(pair[1]);
    opts[pair[0]] = Number.isNaN(parsedInt) ? pair[1] : parsedInt;
  });
  board = new Board(opts);
  hexular = Hexular(board.config);
  adapter = hexular.addAdapter(
    Hexular.classes.CanvasAdapter,
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