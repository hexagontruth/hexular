// --- INIT ---

const DEFAULT_ROWS = 16;
const DEFAULT_COLS = 16;
const DEFAULT_SIZE = 8;
const DEFAULT_RADIUS = 10;
const DEFAULT_NUM_STATES = 12;

let hexular, canvas, controls, container, overlay, ruleConfig, ruleMenus,
  ctlToggle, ctlStep, ctlClear, ctlConfig, ctlStates, ctlRuleAll,
  key, shift, setting, selected, lastSet, setState, configUp;

window.addEventListener('DOMContentLoaded', function(e) {
  canvas = document.createElement('canvas');

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

  document.body.addEventListener('keydown', keydown);
  document.body.addEventListener('keyup', keyup);

  canvas.addEventListener('mousemove', mousemove);
  document.body.addEventListener('mousedown', mousedown);
  canvas.addEventListener('mouseup', mouseup);
  canvas.addEventListener('mouseout', mouseout);


  let argArray = location.search.substring(1).split('&');
  let opts = {};
  argArray.forEach(function(e, i) {
    if (e.length != 0) {
      let pair = e.split('=');
      let parsedInt = parseInt(pair[1]);
      opts[pair[0]] = Number.isNaN(parsedInt) ? pair[1] : parsedInt;
    }
  });

  init(opts);
});

function init(optArgs) {
  optArgs = optArgs || {};

  let opts = {
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    size: DEFAULT_SIZE,
    radius: DEFAULT_RADIUS,
    numStates: DEFAULT_NUM_STATES,
    defaultRule: rules.simpleIncrementor
  };

  for (let k in optArgs)
    if (optArgs.hasOwnProperty(k))
      opts[k] = optArgs[k];

  ctlStates.value = opts.numStates;

  // Hex init

  hexular = Hexular(opts, rules.standardOff, rules.standardOn).renderTo(canvas, 10);

  while (container.firstChild)
    container.firstChild.remove();

  container.appendChild(canvas);

  hexular.draw();

  window.scrollTo(
    (document.body.scrollWidth - window.innerWidth) / 2,
    (document.body.scrollHeight - window.innerHeight) / 2
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
  let cell = hexular.cellAt([
    e.pageY - canvas.offsetTop,
    e.pageX - canvas.offsetLeft
  ]);

  selectCell(cell);

  if (setting)
    setCell(cell);
}

function mousedown(e) {
  if (e.which != 1)
    return;

  if (e.target == canvas) {
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
