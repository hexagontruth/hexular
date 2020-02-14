class Config {
  static get defaults() {
    return {
      preset: 'default',
      theme: 'light',
      radius: 60,
      cellRadius: 10,
      numStates: 12,
      maxNumStates: 12,
      groundState: 0,
      defaultRule: 'identityRule',
      nh: 6,
      filters: {
        binaryFilter: false,
        deltaFilter: false,
        clipBottomFilter: false,
        clipTopFilter: false,
        modFilter: false,
        edgeFilter: false,
      },
      undoStackSize: 64,
      mobileRadius: 30,
      mobileCellRadius: 15,
      mobileUndoStackSize: 16,
      interval: 100,
      autopause: true,
      background: '#f8f8f8',
      showModelBackground: true,
      borderWidth: 1,
      colors: Hexular.DEFAULTS.colors,
      availableRules: Config.merge({}, Rules),
      rules: Array(this.maxNumStates).fill(this.defaultRule),
      themes: Config.merge(Themes),
      presets: Config.merge({}, Presets),
      arrayType: 'Int8Array',
      defaultImageFilename: 'hexular.png',
      defaultFilename: 'hexular.bin',
      defaultVideoFilename: 'hexular.webm',
      codec: 'vp9',
      scaleFactor: 1,
      tool: 'brush',
      shiftTool: 'move',
      toolSize: 1,
      colorMode: 0,
      paintColors: [1, 0],
      steps: 0,
      ruleBuilderName: 'newElementaryRule',
      ruleBuilderMiss: '0:0',
      ruleBuilderMatch: '1:0',
      ruleBuilderMasks: Array(64).fill(false),
      localStorageObj: window.localStorage,
      sessionStorageObj: window.sessionStorage,
    };
  }
  static merge(...objs) {
    let base = objs.shift();
    let next;
    let mergeWhitelist = [Object, Array];
    while (next = objs.shift()) {
      for (let [key, val] of Object.entries(next)) {
        if (val == null) continue;
        let defaultBaseVal = Array.isArray(val) ? [] : typeof val == 'object' ? {} : null;
        let baseVal = base[key] || defaultBaseVal;
        if (typeof val == 'object' && !mergeWhitelist.includes(val.constructor)) {
          base[key] = val;
        }
        else if (Array.isArray(val) && Array.isArray(baseVal)) {
          base[key] = Config.merge([], baseVal, val);
        }
        else if (typeof baseVal =='object' && typeof val == 'object') {
          base[key] = Config.merge({}, baseVal, val);
        }
        else {
          base[key] = val;
        }
      }
    }
    return base;
  }

  constructor(board, ...args) {
    this.board = board;
    Config.merge(this, Config.defaults);
    Object.entries(this).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        this[key] = value.slice();
      }
      if (this.filters[key]) {
        this.filters[key] = value;
        delete this[key];
      }
    });

    // Restore state from local/session storage
    this.restoreState();

    // Finally, merge in URL parameter and constructor args
    Config.merge(this, new OptParser(this), ...args);

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

    this.mobile && document.body.classList.add('mobile');
  }

  initialize() {
    this.model = this.board.model;
    this.configModal = this.board.modals.config;
    this.configModal.update();
    this.rbModal = this.board.modals.rb;

    // Board
    this.setBackground();
    this.setColors();
    this.setPaintColor(0, this.paintColors[0]);
    this.setPaintColor(1, this.mobile ? -1 : this.paintColors[1]);
    this.setPaintColorMode(this.colorMode);
    this.setTool(this.tool);
    this.setToolSize(this.toolSize);
    this.setSteps(this.steps);

    // Config modal
    this.setPreset(this.preset);
    if (!this.preset) {
      this.setNh(this.nh);
      this.setNumStates(this.numStates);
      this.setRules();
      this.setFilters();
    }

    // Rule builder modal
    this.rbModal.ruleName.value = this.ruleBuilderName || Config.defaults.ruleBuilderName;
    this.rbModal.ruleMiss.value = this.ruleBuilderMiss;
    this.rbModal.ruleMatch.value = this.ruleBuilderMatch;
    this.rbModal.maskElements.forEach((e, i) => {
      this.ruleBuilderMasks[i] && e.classList.add('active');
    });
  }

  // --- ADDERS, IMPORT/EXPORT ---

  addRule(ruleName, fn) {
    this.availableRules[ruleName] = fn;
    this.configModal.update();
    this.setRules();
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
    this.colors[idx] = color;
    this.board.bgAdapter.colors[idx] = color;
    this.board.fgAdapter.colors[idx] = color;
    this.board.colorButtons[idx].style.backgroundColor = color;
    this.storeSessionConfigAsync();
  }

  setColors(colors=[]) {
    this.colors = Config.merge(this.colors, colors);
    this.board.bgAdapter.colors = this.colors;
    this.board.fgAdapter.colors = this.colors;
    for (let i = 0; i < 12; i++) {
      this.board.colorButtons[i].style.backgroundColor = this.colors[i];
    }
    this.storeSessionConfigAsync();
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
      let disabled = ruleMenu.idx >= numStates;
      ruleMenu.container.setAttribute('data-disabled', disabled);
    });
    this.checkPreset();
    this.storeSessionConfig();
  }

  setPaintColor(idx, color) {
    this.paintColors[idx] = color;
    let className = `active-${idx}`;
    this.board.colorButtons.forEach((e) => e.classList.remove(className));
    this.board.colorButtons[color] && this.board.colorButtons[color].classList.add(className);
    this.storeSessionConfig();
  }

  setPaintColorMode(mode) {
    this.colorMode = mode != null ? mode : +!this.colorMode;
    if (this.colorMode) {
      this.board.toolMisc.color.classList.add('active');
      this.board.menus.color.classList.remove('hidden');
    }
    else {
      this.board.menus.color.classList.add('hidden');
      this.board.toolMisc.color.classList.remove('active');
    }
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

    this.rules = Object.assign(this.rules, preset.rules);

    this.filters = Object.assign({}, preset.filters);
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
    return Config.merge({}, obj);
  }

  getSessionConfig() {
    let sessionConfig = this.getKeyValues([
      'availableRules',
      'colorMode',
      'defaultRule',
      'filters',
      'fallbackTool',
      'groundState',
      'maxNumStates',
      'nh',
      'numStates',
      'autopause',
      'paintColors',
      'preset',
      'radius',
      'ruleBuilderMasks',
      'ruleBuilderMatch',
      'ruleBuilderMiss',
      'ruleBuilderName',
      'rules',
      'shiftTool',
      'steps',
      'theme',
      'tool',
      'toolSize'
    ]);
    Object.entries(sessionConfig.availableRules).forEach(([rule, fn]) => {
      sessionConfig.availableRules[rule] = fn.toString();
    });
    return sessionConfig;
  };

  getLocalConfig() {
    return this.getKeyValues([
      'presets',
      'themes',
    ]);
  }

  restoreModel() {
    let modelState = this.loadModel('modelState');
    if (modelState) {
      this.board.newHistoryState();
      this.board.model.import(modelState);
      this.board.draw();
    }
  }

  restoreState() {
    if (this.model)
      this.restoreModel();
    let sessionConfig = JSON.parse(this.sessionStorageObj.getItem('sessionConfig') || '{}');
    let localConfig = JSON.parse(this.localStorageObj.getItem('localConfig') || '{}');
    sessionConfig.availableRules = sessionConfig.availableRules || {};
    Object.entries(sessionConfig.availableRules).forEach(([rule, val]) => {
      let fn;
      try {
        val = eval(val);
        fn = Array.isArray(val) ? Hexular.util.ruleBuilder(...val) : val;
      }
      catch (e) {
        this.board.setMessage(`Error while loading rule "${rule}"`);
        console.log(e);
        console.trace();
      }
      if (typeof fn == 'function')
        sessionConfig.availableRules[rule] = fn;
      else
        delete sessionConfig.availableRules[rule];
    });

    let presets = localConfig.presets;
    if (presets) {
      localConfig.presets = {};
      Object.entries(presets).forEach(([presetName, preset]) => {
        localConfig.presets[presetName] = new Preset(preset);
      });
    }

    Config.merge(this, localConfig, sessionConfig);
    if (sessionConfig.preset !== undefined)
      this.preset = sessionConfig.preset;
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
    config.preset = config.preset || 'none';
    this.sessionStorageObj.setItem('sessionConfig', JSON.stringify(config));
  }

  storeSessionConfigAsync() {
    if (!this.pendingStoreSessionAsync) {
      this.pendingStoreSessionAsync = true;
      window.setTimeout(() => {
        this.storeSessionConfig();
        this.pendingStoreSessionAsync = null;
      }, 50);
    }
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