// --- INIT ---

const CONFIG = {
  rows: 100,
  cols: 100,
  radius: 60,
  cellRadius: 10,
  numStates: 6,
  timerLength: 100,
  rules: rules,
  defaultRules: [
    rules.standardOff,
    rules.simpleIncrementor,
    rules.simpleIncrementor,
    rules.simpleIncrementor,
    rules.simpleIncrementor,
    rules.standardOn
  ]
};

let keyWhitelist = [
  'Escape',
  'Shift',
  'Tab',
  ' '
];

class Board {
  constructor(...args) {
    this.config = Object.assign({}, CONFIG, ...args);
    this.bg = document.createElement('canvas');
    this.fg = document.createElement('canvas');
    this.bg.classList.add('canvas', 'canvas-bg');
    this.fg.classList.add('canvas', 'canvas-fg');
    this.bgCtx = this.bg.getContext('2d');
    this.fgCtx = this.fg.getContext('2d');
    this.timer = null;
    this.center();
  }

  center() {
    for (let ctx of [this.bgCtx, this.fgCtx]) {
      ctx.canvas.width = 4000;
      ctx.canvas.height = 4000;
      ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
  }

  toggle(ev) {
    if (!this.running) {
      this.timer = setInterval(hexular.step.bind(hexular), this.config.timerLength);
      ctlStep.disabled = true;
      ctlToggle.value = 'Stop';
    }
    else {
      clearInterval(this.timer);
      this.timer = null;
      ctlStep.disabled = false;
      ctlToggle.value = 'Start';
    }
  }

  get running() {
    return !!this.timer;
  }
}

let hexular, adapter, board;

let controls, container, overlay, ruleConfig, ruleMenus,
  ctlToggle, ctlStep, ctlClear, ctlConfig, ctlStates, ctlRuleAll,
  shift, selected, lastSet, setState, configUp;

window.addEventListener('DOMContentLoaded', function(e) {

  controls = document.querySelector('.controls');
  container = document.querySelector('.container');
  overlay = document.querySelector('.overlay');
  ruleConfig = document.querySelector('.rule-config');

  ctlToggle = document.querySelector('#ctl_toggle');
  ctlStep = document.querySelector('#ctl_step');
  ctlClear = document.querySelector('#ctl_clear');
  ctlConfig = document.querySelector('#ctl_config');
  ctlStates = document.querySelector('#ctl_states');
  ctlRuleAll = document.querySelector('#ctl_rule_all');

  ctlToggle.addEventListener('click', (ev) => board.toggle(ev));
  ctlStep.addEventListener('click', handleStep.bind(ctlStep));
  ctlClear.addEventListener('click', handleClear.bind(ctlClear));
  ctlConfig.addEventListener('click', handleConfig);
  ctlStates.addEventListener('change', handleStates.bind(ctlStates));
  ctlRuleAll.addEventListener('change', handleRuleAll.bind(ctlRuleAll));

  let argArray = location.search.substring(1).split('&');
  let opts = {};
  argArray.forEach(function(e, i) {
    if (e.length != 0) {
      let pair = e.split('=');
      let parsedInt = parseInt(pair[1]);
      opts[pair[0]] = Number.isNaN(parsedInt) ? pair[1] : parsedInt;
    }
  });

  board = new Board(opts);

  window.addEventListener('keydown', keydown);
  window.addEventListener('mousedown', mousedown);
  board.fg.addEventListener('contextmenu', contextmenu);
  board.fg.addEventListener('mousemove', mousemove);
  board.fg.addEventListener('mouseup', mouseup);
  board.fg.addEventListener('mouseout', mouseout);


  init();
});

function init() {

  ctlStates.value = board.config.numStates;

  // Hex init
  hexular = Hexular(board.config, {rules: board.config.defaultRules});
  adapter = hexular.addAdapter(
    Hexular.classes.CanvasAdapter,
    {renderer: board.bgCtx, selector: board.fgCtx, cellRadius: board.config.cellRadius}
  );

  while (container.firstChild)
    container.firstChild.remove();

  container.appendChild(board.bg);
  container.appendChild(board.fg);

  adapter.draw();
  window.requestAnimationFrame(() => 
    window.scrollTo(
      (document.body.scrollWidth - window.innerWidth) / 2,
      (document.body.scrollHeight - window.innerHeight) / 2
    )
  );

  initRuleMenus();
}

function initRuleMenus() {
  ctlRuleAll.options.length = 1;
  for (let k in rules) {
    if (!rules.hasOwnProperty(k))
      continue;

    let option = document.createElement('option');
    option.text = k;

    ctlRuleAll.appendChild(option);
  }

  while (ruleMenus && ruleMenus.length > 0)
    ruleMenus.pop().parentNode.remove();

  ruleMenus = Array(12);

  for (let i = 0; i < 12; i++) {
    let ruleMenu = document.createElement('select');
    let ruleContainer = document.createElement('div');

    ruleMenu.title = 'State ' + i;
    ruleMenu.addEventListener('change', handleRule.bind(ruleMenu));

    ruleContainer.classList.add('rule-container');
    ruleContainer.style.borderColor = adapter.colors[i];

    for (let k in rules) {
      if (!rules.hasOwnProperty(k))
        continue;

      let option = document.createElement('option');
      option.text = k;

      if (hexular.rules[i] == rules[k])
        option.selected = true;

      ruleMenu.appendChild(option);
    }

    if (i >= hexular.numStates)
      ruleMenu.disabled = true;

    ruleMenus[i] = ruleMenu;

    ruleContainer.appendChild(ruleMenu);
    ruleConfig.appendChild(ruleContainer);
  }
}

// --- LISTENERS ---

function contextmenu(ev) {
  ev.preventDefault();
}

function mousemove(ev) {
  let cell = adapter.cellAt([ev.pageY - 2000, ev.pageX - 2000]);

  selectCell(cell);

  if (setState != null)
    setCell(cell);
}

function mousedown(ev) {
  if (ev.target == board.fg) {
    if (ev.buttons & 1) {
      shift = ev.shiftKey;
      setState = Hexular.math.mod(selected.state + 1, board.config.numStates);
      setCell(selected);
    }
    else if (ev.buttons & 2) {
      setState = Hexular.math.mod(selected.state - 1, board.config.numStates);
      setCell(selected);
    }
  }
  else if (ev.target == overlay) {
    handleConfig();
  }
}

function mouseup() {
  setCell();
  shift = false;
}

function mouseout() {
  selectCell();
}

function keydown(ev) {
  if (!ev.repeat) {
    // ESC to hide/show controls
    if (ev.key == 'Escape') {
      if (configUp) {
        handleConfig();
      }
      else {
        controls.style.visibility =
          controls.style.visibility == 'hidden' ? 'visible' : 'hidden';
      }
    }

    // TAB to start/stop
    else if (ev.key == 'Tab') {
      board.toggle();
      ev.preventDefault();
    }

    // SPACE to step or stop
    else if (ev.key == ' ') {
      if (board.running) {
        board.toggle();
      }
      else {
        handleStep();
      }
    }
  }
  if (keyWhitelist.indexOf(ev.key) != -1) {
    ev.preventDefault();
  }
}

function selectCell(cell) {
  selected = cell;
  adapter.selectCell(cell);
}

function setCell(cell) {
  if (cell) {
    if (cell != lastSet) {
      cell.state = shift ? 0 : setState;
      lastSet = cell;
      adapter.selectCell();
      adapter.drawCell(cell);
    }
  }
  // Null cell
  else {
    setState = null;
    lastSet = null;
  }
}

// --- Button handlers ---

function handleStep() {
  hexular.step();
}

function handleClear() {
  if (board.running) board.toggle();
  hexular.clear();
}

function handleConfig() {
  configUp = !configUp;
  if (configUp) {
    overlay.style.visibility = 'visible';
  }
  else {
    overlay.style.visibility = 'hidden';
  }
}

function handleStates() {
  const numStates = parseInt(this.value);
  hexular.numStates = parseInt(numStates);
  for (let i = 0; i < ruleMenus.length; i++) {
    if (i < numStates)
      ruleMenus[i].disabled = false;
    else
      ruleMenus[i].disabled = true;
  }
}

function handleRule() {
  const index = ruleMenus.indexOf(this);
  hexular.rules[index] = rules[this.value] || rules.nullRule;
}

function handleRuleAll() {
  const rule = rules[this.value] || rules.nullRule;

  for (let i = 0; i < ruleMenus.length; i++) {
    ruleMenus[i].value = this.value;
    hexular.rules[i] = rule;
  }

  this.selectedIndex = 0;
}
