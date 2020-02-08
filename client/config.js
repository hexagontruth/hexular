class Config {
  static merge(...objs) {
    let base = objs.shift();
    let next;
    while (next = objs.shift()) {
      for (let [key, value] of Object.entries(next)) {
        if (value === undefined) continue;
        if (typeof base[key] =='object' && typeof value == 'object' && !Array.isArray(base[key])) {
          base[key] = Config.merge({}, base[key], value);
        }
        else {
          base[key] = value;
        }
      }
    }
    return base;
  }

  constructor(board, ...args) {
    let defaults = {
      availableRules: {},
      colors: [],
      filters: {},
      paintColors: [],
      board,
    };
    Object.assign(this, defaults, ...args);
    Object.entries(this).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        this[key] = value.slice();
      }
      let indexOfFilter = key.indexOf('Filter');
      if (indexOfFilter > 0 && indexOfFilter == key.length - 6) {
        this.filters[key] = value;
        delete this[key];
      }
    });
    this.colors = this.colors.slice();
    this.rules = this.rules || Array(this.maxNumStates).fill(this.availableRules[this.defaultRule]);

    this.localStorageObj = window.localStorage;
    this.sessionStorageObj = window.sessionStorage;

    // Set logical size and scale small boards
    let width = this.radius * this.cellRadius * Hexular.math.apothem * 4;
    let height = this.radius * this.cellRadius * 3;
    let scaleThreshold = 10 / 12;
    let scaleRatio = 1;
    if (width < window.innerWidth * scaleThreshold) {
      scaleRatio = window.innerWidth * scaleThreshold / width;
    }
    if (height < window.innerHeight * scaleThreshold) {
      scaleRatio = window.innerWidth * scaleThreshold / width;
    }
    this.cellRadius *= scaleRatio;
    width *= scaleRatio;
    height *= scaleRatio;
    this.logicalWidth = width;
    this.logicalHeight = height;
  }

  initialize() {
    this.restoreState();
    this.model = this.board.model;
    this.configModal = this.board.modals.config;
    this.configModal.update();

    // Board
    this.setColor(0, this.paintColors[0]);
    this.setColor(1, this.mobile ? -1 : this.paintColors[1]);
    this.setColorMode(this.colorMode);
    this.setBackground();
    this.setTool(this.tool);
    this.setToolSize(this.toolSize);
    this.setSteps(this.steps);

    // Modal
    this.setPreset(this.preset);
    if (!this.preset) {
      this.setNh(this.nh);
      this.setNumStates(this.numStates);
      this.setRules();
      this.setFilters();
    }
  }

  // --- ADDERS, IMPORT/EXPORT ---

  addRule(ruleName, fn) {
    this.availableRules[ruleName] = fn;
    this.configModal.update();
    this.storeLocalConfig();
  }

  addPreset(presetName, preset) {
    this.presets[presetName] = preset
    this.configModal.update();
    this.storeLocalConfig();
  }

  exportPreset() {
    return {
      preset: this.preset,
      numStates: this.numStates,
      rules: this.rules.slice(),
      nh: this.nh,
      filters: Object.assign({}, this.filters),
    };
  }

  // --- SETTERS ---
  
  setBackground(color) {
    this.background = color || this.background;
    document.body.style.backgroundColor = this.background;
  }

  setColor(idx, color) {
    this.paintColors[idx] = color;
    let className = `active-${idx}`;
    this.board.colorButtons.forEach((e) => e.classList.remove(className));
    this.board.colorButtons[color] && this.board.colorButtons[color].classList.add(className);
    this.storeSessionConfig();
  }

  setColorMode(mode) {
    this.colorMode = mode != null ? mode : +!this.colorMode;
    if (this.colorMode) {
      this.board.toolMisc.color.classList.add('active');
      this.board.colorToolbar.classList.remove('hidden');
    }
    else {
      this.board.colorToolbar.classList.add('hidden');
      this.board.toolMisc.color.classList.remove('active');
    }
    this.storeSessionConfig();
  }

  setFilter(filter, value) {
    let oldValue = this.filters[filter];
    this.filters[filter] = value;
    if (oldValue == value)
      return;
    this.model.clearFilters();
    Object.entries(this.filters).forEach(([filter, value]) => {
      if (value) {
        this.model.addFilter(Hexular.filters[filter]);
        this.configModal.filters[filter].classList.add('active');
      }
      else {
        this.configModal.filters[filter].classList.remove('active');
      }
    });
    this.checkPreset();
    this.storeSessionConfig();
  }

  setFilters() {
    this.model.clearFilters();
    Object.values(this.configModal.filters).forEach((e) => e.classList.remove('active'));
    Object.entries(this.filters).forEach(([filter, value]) => {
      if (value) {
        this.model.addFilter(Hexular.filters[filter]);
        this.configModal.filters[filter].classList.add('active');
      }
    });
    this.storeSessionConfig();
  }

  setNh(nh) {
    this.nh = nh;
    this.model.setNeighborhood(nh);
    this.configModal.selectNh.value = nh;
    this.checkPreset();
    this.storeSessionConfig();
  }

  setNumStates(num) {
    if (num)
      this.configModal.numStates.value = num;
    const numStates = parseInt(this.configModal.numStates.value);
    this.numStates = this.model.numStates = numStates;
    this.configModal.ruleMenus.forEach((ruleMenu) => {
      let disabled = ruleMenu.index >= numStates;
      ruleMenu.container.setAttribute('data-disabled', disabled);
    });
    this.checkPreset();
    this.storeSessionConfig();
  }

  setPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) {
      this.configModal.selectPreset.selectedIndex = 0;
      this.configModal.addPreset.disabled = false;
      this.configModal.savePreset.disabled = true;
      this.preset = null;
      this.storeSessionConfig();
      return;
    }
    this.setNumStates(preset.numStates);
    this.setNh(preset.nh);
    this.rules = Config.merge(this.rules, preset.rules);
    this.filters = Config.merge({}, preset.filters);
    this.defaultRule = preset.defaultRule;
    this.setRules();
    this.setFilters();
    this.configModal.selectPreset.value = presetName;
    this.configModal.addPreset.disabled = true;
    this.configModal.savePreset.disabled = false;
    this.preset = presetName;
    this.storeSessionConfig();
  }

  setRadius(radius) {
    this.radius = radius;
    this.storeSessionConfig();
    Board.resize(radius);
  }

  setRule(idx, rule) {
    let fn = this.availableRules[rule];
    if (!fn) {
      fn = this.availableRules[this.defaultRule];
      rule = this.defaultRule;
    }
    if (idx != null) {
      this.configModal.ruleMenus[idx].select.value = rule;
      this.rules[idx] = rule;
      this.model.rules[idx] = fn;
    }
    else {
      this.configModal.defaultRuleMenu.select.value = rule;
      this.defaultRule = rule;
      this.model.defaultRule = fn;
    }
    this.checkPreset();
    this.storeSessionConfig();
  }

  setRules() {
    this.rules.forEach((rule, idx) => {
      let fn = this.availableRules[rule];
      if (!fn) {
        fn = this.availableRules[this.defaultRule];
        rule = this.defaultRule;
      }
      this.configModal.ruleMenus[idx].select.value = rule;
      this.model.rules[idx] = fn;
    });
    this.configModal.defaultRuleMenu.select.value = this.defaultRule;
    this.model.defaultRule = this.availableRules[this.defaultRule];
    this.storeSessionConfig();
  }

  setSteps(steps) {
    steps = steps != null ? steps : this.steps;
    this.steps = steps;
    this.board.setInfoBox('steps', steps);
    this.storeSessionConfig();
  }

  setTool(tool, fallbackTool) {
    if (tool) {
      this.tool = tool;
      this.fallbackTool = fallbackTool || tool;
      this.storeSessionConfig();
    }
    else if (this.shift) {
      this.tool = this.shiftTool;
    }
    else if (this.tool != this.fallbackTool) {
      this.tool = this.fallbackTool;
    }
    Object.values(this.board.tools).forEach((e) => e.classList.remove('active'));
    if (this.board.tools[this.tool])
      this.board.tools[this.tool].classList.add('active');
    this.board.fg.setAttribute('data-tool', this.tool);
    this.board.drawSelectedCell();
  }

  setToolSize(size) {
    this.toolSize = size || 1;
    this.board.toolSizes.forEach((e) => e.classList.remove('active'));
    let selected = this.board.toolSizes[size - 1];
    selected && selected.classList.add('active');
    this.board.drawSelectedCell();
    this.storeSessionConfig();
  }

  getPaintColor(idx) {
    let offset = idx ? -1 : 1;
    if (this.colorMode)
      return this.paintColors[idx];
    else
      return Hexular.math.mod(this.board.selected.state + offset, this.numStates);
  }

  // --- VALIDATION ---

  checkPreset() {
    const preset = this.presets[this.preset];
    if (!preset)
      return;
    let dirty = (() => {
      return this.model.numStates != preset.numStates ||
        this.nh != preset.nh ||
        this.defaultRule != preset.defaultRule ||
        this.rules.slice(0, this.model.numStates).reduce((a, rule, idx) => {
          return  a || preset.rules[idx] != rule;
        }, false) ||
        Object.entries(this.filters).reduce((a, [filter, value]) => {
          return a || preset.filters[filter] != value
        });
    })();
    if (dirty) {
      this.setPreset();

    }
  }

  // --- STORAGE ---

  getKeyValues(keys) {
    let obj = {};
    for (let key of keys)
      obj[key] = this[key];
    return obj;
  }

  getSessionConfig() {
    return this.getKeyValues([
      'cellRadius',
      'colorMode',
      'colors',
      'defaultRule',
      'filters',
      'interval',
      'fallbackTool',
      'groundState',
      'maxNumStates',
      'nh',
      'numStates',
      'autopause',
      'paintColors',
      'preset',
      'radius',
      'rules',
      'shiftTool',
      'steps',
      'theme',
      'tool',
      'toolSize'
    ]);
  };

  getLocalConfig() {
    return this.getKeyValues([
      'presets',
      'themes',
    ]);
  }

  restoreState() {
    let modelState = this.loadModel('modelState');
    if (modelState) {
      this.board.newHistoryState();
      let bytes = this.loadModel('modelState');
      this.board.model.import(bytes);
      this.board.draw();
    }
    let sessionConfig = JSON.parse(this.sessionStorageObj.getItem('sessionConfig') || '{}');
    let localConfig = JSON.parse(this.localStorageObj.getItem('localConfig') || '{}');
    let presets = localConfig.presets;
    if (presets) {
      localConfig.presets = {};
      Object.entries(presets).forEach(([presetName, preset]) => {
        localConfig.presets[presetName] = new Preset(preset);
      });
    }
    Object.assign(this, localConfig, sessionConfig);
  }

  storeSessionState(opts={}) {
    Object.entries(opts).forEach(([key, value]) => {
      this.sessionStorageObj.setItem(key, value);
    });
  }

  storeLocalState(opts={}) {
    Object.entries(opts).forEach(([key, value]) => {
      this.localStorageObj.setItem(key, value);
    });
  }

  storeSessionConfig() {
    let config = this.getSessionConfig();
    this.sessionStorageObj.setItem('sessionConfig', JSON.stringify(config));
  }

  storeLocalConfig() {
    let config = this.getLocalConfig();
    this.localStorageObj.setItem('localConfig', JSON.stringify(config));
  }

  storeModel(key, bytes, obj={}) {
    obj[key] = Array.from(bytes).map((e) => e.toString(36)).join('');
    this.storeSessionState(obj);
  }

  loadModel(key) {
    let str = this.sessionStorageObj.getItem(key);
    if (str) {
      let array = str.split('').map((e) => parseInt(e, 36));
      return new Int8Array(array);
    }
  }

  clearStorage() {
    let modelState = this.loadModel('modelState');
    this.sessionStorageObj.clear();
    this.localStorageObj.clear();
    this.storeModel('modelState', modelState);
  }
}