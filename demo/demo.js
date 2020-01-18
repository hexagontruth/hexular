// --- INIT ---

const CONFIG = {
  rows: 100,
  cols: 100,
  radius: 30,
  cellRadius: 10,
  numStates: 6
};

class Board {
  constructor(...args) {
    this.config = Object.assign({}, CONFIG, ...args);
    this.bg = document.createElement('canvas');
    this.fg = document.createElement('canvas');
    this.bgCtx = this.bg.getContext('2d');
    this.fgCtx = this.fg.getContext('2d');
    this.center();
  }

  center() {
    for (let ctx of [this.bgCtx, this.fgCtx]) {
      ctx.canvas.width = 4000;
      ctx.canvas.height = 4000;
      ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
  }
}

let hexular, board;

let controls, container, overlay, ruleConfig, ruleMenus,
  ctlToggle, ctlStep, ctlClear, ctlConfig, ctlStates, ctlRuleAll,
  key, shift, setting, selected, lastSet, setState, configUp;

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

  ctlToggle.addEventListener('click', handleToggle.bind(ctlToggle));
  ctlStep.addEventListener('click', handleStep.bind(ctlStep));
  ctlClear.addEventListener('click', handleClear.bind(ctlClear));
  ctlConfig.addEventListener('click', handleConfig.bind(ctlConfig));
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

  document.body.addEventListener('keydown', keydown);
  document.body.addEventListener('keyup', keyup);

  board.fg.addEventListener('mousemove', mousemove);
  document.body.addEventListener('mousedown', mousedown);
  board.fg.addEventListener('mouseup', mouseup);
  board.fg.addEventListener('mouseout', mouseout);


  init();
});

function init() {

  ctlStates.value = board.config.numStates;

  // Hex init
  hexular = Hexular(board.config, rules.standardOff, rules.standardOn).renderTo(board.bgCtx, 10);

  while (container.firstChild)
    container.firstChild.remove();

  container.appendChild(board.bg);
  container.appendChild(board.fg);

  hexular.draw();
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
    ruleContainer.style.borderColor = hexular.colors[i];

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

function mousemove(e) {
  let cell = hexular.cellAt([e.pageY - 2000, e.pageX - 2000]);

  selectCell(cell);

  if (setting)
    setCell(cell);
}

function mousedown(e) {
  if (e.which != 1)
    return;

  if (e.target == board.fg) {
    if (e.shiftKey)
      shift = true;
    setCell(selected);
    e.preventDefault();
  }
  else if (e.target == overlay) {
    handleConfig();
  }
}

function mouseup(e) {
  setCell();
  shift = false;
}

function mouseout(e) {
  selectCell();
}

function keydown(e) {
  if (!key) {
    // ESC to hide/show controls
    if (e.keyCode == 27) {
      if (configUp) {
        handleConfig();
      }
      else {
        controls.style.visibility =
          controls.style.visibility == 'hidden' ? 'visible' : 'hidden';
        key = true;
      }
    }

    // TAB to start/stop
    else if (e.keyCode == 9) {
      handleToggle();
      key = true;
    }

    // SPACE to step or stop
    else if (e.keyCode == 32) {
      if (hexular.running) {
        handleStop();
      }
      else {
        handleStep();
      }
      key = true;
    }
  }

  if (key) {
    e.preventDefault();
  }
}

function keyup(e) {
  if (key)
    e.preventDefault();
  key = false;
}

function selectCell(cell) {
  selected = cell;
  hexular.selectCell(cell);
}

function setCell(cell) {
  if (cell) {
    setting = true;
    if (cell != lastSet) {
      if (setState == null)
        setState = (selected.state + 1) % hexular.numStates;
      cell.state = shift ? 0 : setState;
      lastSet = cell;
      hexular.selectCell();
      hexular.drawCell(cell);
    }
  }
  // Null cell
  else {
    setting = false;
    setState = null;
    lastSet = null;
  }
}

// --- Button handlers ---

function handleToggle() {
  if (hexular.running)
    handleStop();
  else
    handleStart();
}

function handleStart() {
  hexular.start();
  ctlStep.disabled = true;
  ctlToggle.value = 'Stop';
}

function handleStop() {
  hexular.stop();
  ctlStep.disabled = false;
  ctlToggle.value = 'Start';
}

function handleStep() {
  hexular.step();
}

function handleClear() {
  handleStop();
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
