class Config {
  static get defaults() {
    return {
      preset: 'default',
      theme: 'light',
      meta: {},
      radius: 60,
      cellRadius: 10,
      defaultScale: 1,
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
      mobileDefaultScale: 1.5,
      mobileUndoStackSize: 32,
      interval: 125,
      autopause: true,
      colors: [
        'transparent',
        '#ccccbb',
        '#99998f',
        '#666655',
        '#33332f',
        '#cc4444',
        '#ee7722',
        '#eebb33',
        '#66bb33',
        '#66aaaa',
        '#4455bb',
        '#aa55bb',
      ],
      fillColors: Array(256).fill(),
      strokeColors: Array(256).fill(),
      colorMapping: {
        fill: true,
        stroke: true,
      },
      defaultColor: '#ccccff',
      pageBackground: '#f8f8f8',
      modelBackground: '#ffffff',
      defaultColor: '#77f0f0',
      selectWidth: 2,
      selectColor: '#ffbb33',
      cellGap: 1,
      cellBorderWidth: 1,
      rules: Array(this.maxNumStates).fill(this.defaultRule),
      plugins: [],
      arrayType: 'Uint8Array',
      imageFormat: 'png',
      defaultImageFilenameBase: 'hex',
      defaultArchiveFilename: 'hexular.ar',
      defaultFilename: 'hexular.bin',
      defaultVideoFilename: 'hexular.webm',
      defaultSettingsFilename: 'hexular.json',
      recordingMode: false,
      videoMimeType: 'video/webm',
      videoCodec: 'vp9',
      videoFrameRate: 30,
      videoBitsPerSecond: 2 ** 28,
      scaleFactor: 2,
      tool: 'brush',
      shiftTool: 'move',
      toolSize: 1,
      colorMode: 0,
      paintColors: [1, 0],
      customPaintMap: null,
      steps: 0,
      drawDefaultQ: 1,
      drawStepInterval: 1,
      blendMode: 'source-over',
      defaultCap: 'butt', // lol
      defaultJoin: 'miter',
      rbName: 'newSimpleRule',
      rbMiss: 0,
      rbMatch: 1,
      rbMissRel: 0,
      rbMatchRel: 0,
      rbRel: 0,
      rbStates: Array(64).fill(false),
      trb: {
        ruleName: 'newTemplateRule',
        selectedName: '',
        selectedRuleDef: [],
        selectedControlIdx: -1,
        templateDefs: [],
        templateDef: Hexular.util.templateRuleBuilder().defs[0],
      },
      drawFunctions: {
        sortCellsAsc: false,
        sortCellsDesc: false,
        drawModelBackground: true,
        drawFilledPointyHex: true,
        drawOutlinePointyHex: false,
        drawFilledFlatHex: false,
        drawOutlineFlatHex: false,
        drawFilledCircle: false,
        drawOutlineCircle: false,
      },
      radioGroups: {
        draw: [
          ['drawModelBackground'],
          [
            'sortCellsAsc',
            'sortCellsDesc',
          ]
        ],
        drawCell: [
          [
            'drawFilledPointyHex',
            'drawOutlinePointyHex',
            'drawFilledFlatHex',
            'drawOutlineFlatHex',
            'drawFilledCircle',
            'drawOutlineCircle',
          ]
        ],
      },
      radioMap: {},
      customInput: null,
      localStorageObj: window.localStorage,
      sessionStorageObj: window.sessionStorage,
    };
  }

  static toObject(kvArray) {
    let obj = {};
    for (let [key, value] of kvArray)
      obj[key] = value;
    return obj;
  }

  constructor(board, ...args) {
    // We load these after Config.defaults b/c it needs to be available for populating themes &c.
    let library = {
      availableRules: Hexular.util.merge({}, Rules),
      themes: Hexular.util.merge(Themes),
      presets: Hexular.util.merge({}, Presets)
    };
    this.board = board;
    Hexular.util.merge(this, Config.defaults, library);
    this.colors = Color.from(this.colors);
    // Let us infer if this is a mobile browser and make some tweaks
    if (window.devicePixelRatio > 1 && screen.width < 640) {
      this.scaleFactor *= window.devicePixelRatio;
      this.mobile = true;
      this.radius = Config.defaults.mobileRadius;
      this.defaultScale = Config.defaults.mobileDefaultScale;
      this.undoStackSize = Config.defaults.mobileUndoStackSize;
    }

    // Restore state from local/session storage
    this.restoreState();

    // Finally, merge in URL parameter and constructor args
    Hexular.util.merge(this, new OptParser(this), ...args);

    // Set logical size and scale small boards
    // (Suspended as part of antialias precision reform efforts)
    let width = this.radius * this.cellRadius * Hexular.math.apothem * 4;
    let height = this.radius * this.cellRadius * 3;
    // let scaleThreshold = 10 / 12;
    // let scaleRatio = 1;
    // if (width < window.innerWidth * scaleThreshold) {
    //   scaleRatio = window.innerWidth * scaleThreshold / width;
    // }
    // if (height < window.innerHeight * scaleThreshold) {
    //   scaleRatio = window.innerWidth * scaleThreshold / width;
    // }
    // this.scaleRatio = scaleRatio;
    // this.cellRadius *= scaleRatio;
    // width *= scaleRatio;
    // height *= scaleRatio;
    this.logicalWidth = width;
    this.logicalHeight = height;

    this.mobile && document.body.classList.add('mobile');
  }

  initialize() {
    try {
      this.model = this.board.model;
      this.bgAdapter = this.board.bgAdapter;
      this.fgAdapter = this.board.fgAdapter;
      this.configModal = this.board.modals.config;
      this.customModal = this.board.modals.custom;
      this.drawModal = this.board.modals.draw;
      this.srbModal = this.board.modals.srb;
      this.trbModal = this.board.modals.trb;
      this.themeModal = this.board.modals.theme;
      this.configModal.update();

      // Drawing config initialization
      this.drawingFunctions = {
          sortCellsAsc: () => this.model.sortCells((a, b) => a.state - b.state),
          sortCellsDesc: () => this.model.sortCells((a, b) => b.state - a.state),
        };
      let bgAdapterCallbacks = [
          'drawSolidBackground',
          'drawModelBackground',
          'drawFilledPointyHex',
          'drawOutlinePointyHex',
          'drawFilledFlatHex',
          'drawOutlineFlatHex',
          'drawFilledCircle',
          'drawOutlineCircle',
      ];
      for (let cb of bgAdapterCallbacks) {
        this.drawingFunctions[cb] = (...args) => this.bgAdapter[cb](...args);
      }
      let drawCb = (active, alts) => {
        for (let alt of alts) {
          this.drawModal.drawButtons[alt].classList.remove('active');
          this.drawFunctions[alt] = false;
        }
        if (active) {
          this.drawFunctions[active] = true;
          this.drawModal.drawButtons[active].classList.add('active');
        }
        return this.drawingFunctions[active];
      };
      for (let hook of Object.keys(this.radioGroups)) {
        for (let group of this.radioGroups[hook]) {
          let radioGroup = new RadioGroup(group, drawCb);
          for (let key of group)
            this.radioMap[key] = radioGroup;
          this.board.addHook(hook, radioGroup.fn);
        }
      }
      this.setOnDraw();
      this.setMaxNumStates();

      // Board
      this.setTheme(this.theme);
      if (!this.theme)
        this.setThemable();
      this.setPaintColor(0, this.paintColors[0]);
      this.setPaintColor(1, this.mobile ? -1 : this.paintColors[1]);
      this.setPaintColorMode(this.colorMode);
      this.setTool(this.tool);
      this.setToolSize(this.toolSize);
      this.setSteps(this.steps);
      this.setDefaultScale(this.defaultScale);

      // Config modal
      this.setPreset(this.preset);
      if (!this.preset) {
        this.setNh(this.nh);
        this.setNumStates(this.numStates);
        this.setRules();
        this.setFilters();
      }

      // Rule builder modals
      this.srbModal.ruleName.value = this.rbName || Config.defaults.rbName;
      this.setRbMiss([this.rbMiss, this.rbMissRel]);
      this.setRbMatch([this.rbMatch, this.rbMatchRel]);
      this.srbModal.stateElements.forEach((e, i) => {
        this.rbStates[i] && e.classList.add('active');
      });
      this.srbModal.updateRuleString();
      this.srbModal.update();

      this.trbModal.update();
      this.trbModal.reset();

      // Draw modal
      this.drawModal.update();
      this.drawModal.reset();

      // Theme modal
      this.themeModal.update();
      this.themeModal.reset();

      // Custom code modal
      this.setCustomInput(this.customInput);

      // Restore plugins
      this.restorePlugins();
    }
    catch (error) {
      console.error(error);
      if (!this.error) {
        this.localStorageObj.clear();
        Board.resize({error});
      }
      else {
        console.error('If error persists, try clearing local storage.');
      }
    }
  }

  // --- ADDERS, IMPORT/EXPORT ---

  addRule(ruleName, fn) {
    this.availableRules[ruleName] = fn;
    this.updateRules();
  }

  deleteRule(ruleName) {
    if (this.availableRules[ruleName]) {
      delete this.availableRules[ruleName];
      this.updateRules();
    }
  }

  mergeRules(newRuleName, ...ruleNames) {
    let rules = ruleNames.map((e) => this.availableRules[e]).filter((e) => e && e.defs);
    let defs = rules.reduce((a, e) => a.concat(e.defs), []);
    let newRule = Hexular.util.templateRuleBuilder(defs);
    this.addRule(newRuleName, newRule);
  }

  updateRules() {
    this.configModal.update();
    this.srbModal.update();
    this.trbModal.update();
    this.setRules();
    this.storeLocalConfigAsync();
  }

  addPreset(presetName, preset) {
    this.presets[presetName] = preset
    this.configModal.update();
    this.storeLocalConfigAsync();
  }

  addTheme(themeName, themeObj) {
    this.themes[themeName] = this.getThemeFromObject(themeObj || this);
    this.themeModal.update();
    this.storeLocalConfigAsync();
  }

  exportPreset() {
    return {
      preset: this.preset,
      numStates: this.numStates,
      defaultRule: this.defaultRule,
      rules: this.rules.slice(),
      nh: this.nh,
      filters: Object.assign({}, this.filters),
    };
  }

  resize(radius=this.radius) {
    this.radius = radius;
    this.storeSessionConfig();
    Board.resize();
  }

  radioAlts(buttonName) {
    for (let radioGroup of this.radioGroups)
      if (radioGroup.includes(buttonName))
        return radioGroup.filter((e) => e != buttonName);
    return [];
  }

  restorePlugins() {
    if (this.pluginData) {
      let existingStates = this.plugins.map((e) => e.toString());
      this.pluginData.filter((e) => !existingStates.includes(e)).forEach((pluginState) => {
        PluginControl.restoreFromPluginState(this.board, pluginState);
      });
      delete this.pluginData;
    }
  }

  // --- SETTERS ---

  setAutopause(value) {
    this.autopause = value;
    if (value)
      this.drawModal.autopause.classList.add('active');
    else
      this.drawModal.autopause.classList.remove('active');
    this.storeSessionConfigAsync();
  }

  setCellGap(width) {
    this.cellGap = width != null ? width : this.cellGap;
    this.themeModal.cellGap.value = this.cellGap;
    this.updateAdapter();
  }

  setCellBorderWidth(width) {
    this.cellBorderWidth = width != null ? width : this.cellBorderWidth;
    this.themeModal.cellBorderWidth.value = this.cellBorderWidth;
    this.updateAdapter();
  }

  setCustomInput(value) {
    this.customInput = value || this.customInput;
    this.customModal.input.value = this.customInput || '';
    this.storeSessionConfigAsync();
  }

  updateAdapter() {
    this.bgAdapter.cellGap = this.cellGap; // * this.scaleRatio;
    this.fgAdapter.cellGap = this.cellGap; // * this.scaleRatio;
    this.bgAdapter.cellBorderWidth = this.cellBorderWidth; // * this.scaleRatio;
    this.fgAdapter.cellBorderWidth = this.cellBorderWidth; // * this.scaleRatio;
    this.bgAdapter.updateMathPresets();
    this.fgAdapter.updateMathPresets();
    this.checkTheme();
    this.board.draw();
    this.storeSessionConfigAsync();
  }

  setBlendMode(mode) {
    this.blendMode = mode;
    this.bgAdapter.context.globalCompositeOperation = mode;
    this.themeModal.selectBlendMode.value = mode;
    this.checkTheme();
    this.board.draw();
    this.storeSessionConfigAsync();
  }

  setColor(idx, color) {
    color = Color(color);
    this.colors[idx] = color;
    if (this.colorMapping.fill)
      this.fillColors[idx] = color;
    if (this.colorMapping.stroke)
      this.strokeColors[idx] = color;
    this.setColorControls(idx);
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setColors(colors=[]) {
    this.colors = Color.from(Hexular.util.merge(this.colors, colors));
    if (this.colorMapping.fill) {
      this.fillColors = this.colors.slice();
    }
    if (this.colorMapping.stroke) {
      this.strokeColors = this.colors.slice();
    }
    for (let i = 0; i < this.colors.length; i++)
      if (this.colors[i])
        this.setColorControls(i);
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setColorControls(idx) {
    let color = this.colors[idx];
    if (this.board.allColorButtons[idx])
      this.board.allColorButtons[idx].style.backgroundColor = color.hex;
    if (this.configModal.ruleMenus[idx])
      this.configModal.ruleMenus[idx].button.style.backgroundColor = color.hex;
    if (this.themeModal.colors[idx]) {
      this.themeModal.colors[idx].jscolor.fromString(color.hex);
    }
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setColorProperty(type, color) {
    let types = type ? [type] : ['pageBackground', 'modelBackground', 'defaultColor'];
    types.forEach((key) => {
      let keyColor = this[key] = Color(color || this[key]);
      if (key == 'pageBackground'){
        document.body.style.backgroundColor = keyColor.hex;
      }
      else if (key == 'modelBackground') {
        this.bgAdapter.backgroundColor = keyColor.hex;
        this.bgAdapter.backgroundColor = keyColor.hex;
      }
      else if (key == 'defaultColor') {
        this.bgAdapter.defaultColor = keyColor.hex;
        this.bgAdapter.defaultColor = keyColor.hex;
      }
      this.themeModal[key].jscolor.fromString(keyColor.hex);
    });

    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setDefaultScale(scale) {
    this.defaultScale = scale;
    this.board.scaleTo(scale);
    if (this.drawModal.scale.value != '0') {
      let sliderValue = Math.max(Math.min(scale, this.drawModal.scaleMax), this.drawModal.scaleMin);
      this.drawModal.scale.value = sliderValue;
    }
    this.drawModal.scaleIndicator.innerHTML = scale;
    this.storeSessionConfigAsync();
  }

  setDrawStepInterval(value) {
    this.drawStepInterval = value;
    this.drawModal.drawSteps.value = value;
    this.storeSessionConfigAsync();
  }

  setFilter(filter, value) {
    if (this.filters[filter] == value)
      return;
    this.filters[filter] = value;
    this.setFilters();
  }

  setFilters() {
    this.model.filters.keep((e) => this.filters[e.name] === undefined);
    this.model.filters.add(Object.values(Hexular.filters).filter((e) => this.filters[e.name]), 0);
    Object.values(this.configModal.filters).forEach((e) => e.classList.remove('active'));
    Object.entries(this.filters).forEach(([filter, value]) => {
      value && this.configModal.filters[filter].classList.add('active');
    });
    this.checkPreset();
    this.storeSessionConfigAsync();
  }

  setMaxNumStates(num=this.maxNumStates) {
    this.maxNumStates = num;
    if (num < this.numStates)
      this.setNumStates(num);
    this.themeModal.update();
    this.configModal.update();
    this.board.updateColorButtons();
  }

  setNh(nh) {
    this.nh = nh;
    this.model.setNeighborhood(nh);
    this.configModal.selectNh.value = nh;
    this.checkPreset();
    this.storeSessionConfigAsync();
  }

  setNumStates(num) {
    if (num) {
      if (num > this.maxNumStates)
        this.setMaxNumStates(num);
      this.configModal.numStates.value = num = parseInt(num);
    }
    else {
      num = parseInt(this.configModal.numStates.value);
    }
    this.configModal.numStatesIndicator.innerHTML = num;
    this.numStates = this.model.numStates = num;

    this.configModal.ruleMenus.forEach((ruleMenu) => {
      let disabled = ruleMenu.idx >= num;
      ruleMenu.container.setAttribute('data-disabled', disabled);
    });
    this.setRules();
    this.checkPreset();
    this.storeSessionConfigAsync();
  }

  setOnDraw(fnName, value, radio=true) {
    if (!fnName) {
      Object.values(this.drawModal.drawButtons).forEach((e) => e.classList.remove('active'));
      let activeFns = Object.entries(this.drawFunctions).filter(([k, v]) => v).map(([k, v]) => k);
      activeFns.forEach((e) => this.setOnDraw(e, true));
    }
    else {
      value = value != null ? value : this.drawFunctions[fnName];
      this.radioMap[fnName].set(value ? fnName : null);
      this.storeSessionConfigAsync();
    }
  }

  setPaintColor(idx, color) {
    this.paintColors[idx] = color;
    let className = `active-${idx}`;
    this.board.colorButtons.forEach((e) => e.classList.remove(className));
    this.board.colorButtons[color] && this.board.colorButtons[color].classList.add(className);
    this.storeSessionConfigAsync();
  }

  getPaintColor(idx) {
    let offset = idx ? -1 : 1;
    if (this.colorMode)
      return this.paintColors[idx];
    else if (this.customPaintMap)
      return this.customPaintMap(idx, this.board.selected.state);
    else
      return Hexular.math.mod((this.board.selected.state || 0) + offset, this.numStates);
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
    this.storeSessionConfigAsync();
  }

  setPlugins(plugins) {
    if (plugins)
      this.plugins = plugins;
    this.storeSessionConfigAsync();
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
    this.storeSessionConfigAsync();
    this.board.runHooksAsync('updatePreset');
  }

  setRule(idx, rule) {
    let fn = this.availableRules[rule];
    if (!fn) {
      fn = this.availableRules[this.defaultRule];
      rule = this.defaultRule;
    }
    if (idx != null) {
      if (this.configModal.ruleMenus[idx])
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
    this.storeSessionConfigAsync();
  }

  setRules() {
    this.rules.forEach((rule, idx) => {
      let fn = this.availableRules[rule];
      if (!fn) {
        fn = this.availableRules[this.defaultRule];
        rule = this.defaultRule;
      }
      if (this.configModal.ruleMenus[idx])
        this.configModal.ruleMenus[idx].select.value = rule;
      this.model.rules[idx] = fn;
    });
    this.model.rules = this.model.rules.slice(0, this.numStates);
    this.configModal.defaultRuleMenu.select.value = this.defaultRule;
    this.model.defaultRule = this.availableRules[this.defaultRule];
    this.checkPreset();
    this.storeSessionConfigAsync();
  }

  setRbName(ruleName) {
    ruleName = ruleName || this.srbModal.ruleName.value || this.rbName;
    ruleName = ruleName.length != 0 ? ruleName : null;
    this.rbName = ruleName;
    if (ruleName)
      this.srbModal.ruleName.value = this.rbName;
    this.storeSessionConfigAsync();
  }

  setRbMiss(tuple) {
    let [miss, missRel] = tuple || this._strToTuple(this.srbModal.ruleMiss.value);
    this.rbMiss = miss;
    this.rbMissRel = missRel;
    this.srbModal.ruleMiss.value = this._tupleToStr([miss, missRel]);
    this.srbModal.updateRuleString();
    this.storeSessionConfigAsync();
  }

  setRbMatch(tuple) {
    let [match, matchRel] = tuple || this._strToTuple(this.srbModal.ruleMatch.value);
    this.rbMatch = match;
    this.rbMatchRel = matchRel;
    this.srbModal.ruleMatch.value = this._tupleToStr([match, matchRel]);
    this.srbModal.updateRuleString();
    this.storeSessionConfigAsync();
  }

  setTrb(trbState) {
    this.trb = Hexular.util.merge({}, trbState);
    this.storeSessionConfigAsync();
  }

  setRecordingMode(value) {
    let fn = this.drawingFunctions.drawSolidBackground;
    if (value) {
      this.recordingMode = true;
      this.board.addHook('draw', fn, 0);
    }
    else {
      this.recordingMode = false;
      this.board.removeHook('draw', fn);
    }
  }

  setSteps(steps) {
    steps = steps != null ? steps : this.steps;
    this.steps = steps;
    this.board.setInfoBox('steps', steps);
    this.storeSessionConfigAsync();
  }

  setTheme(themeName) {
    if (this.themes[themeName]) {
      this.theme = themeName;
      this.themeModal.selectTheme.value = themeName;
      this.themeModal.addTheme.disabled = true;
      let theme = this.getThemeFromObject(this.themes[themeName]);
      Hexular.util.merge(this, theme);
      this.setThemable();
    }
    else {
      this.theme = null;
      this.themeModal.selectTheme.value = null;
      this.themeModal.addTheme.disabled = false;
    }
    this.board.draw();
    this.storeSessionConfigAsync();
    this.board.runHooksAsync('updateTheme');
  }

  setThemable() {
    this.setColorProperty();
    this.setBlendMode(this.blendMode);
    this.setColors();
    this.setCellGap();
    this.setCellBorderWidth();
  }

  setTool(tool, fallbackTool) {
    if (tool && this.board.toolClasses[tool]) {
      this.tool = tool;
      this.fallbackTool = fallbackTool || tool;
      this.storeSessionConfigAsync();
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
    this.storeSessionConfigAsync();
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
    this.board.runHooksAsync('updatePreset');
  }

  checkTheme() {
    let theme = this.themes[this.theme];
    if (!theme || !this.theme) {
      this.setTheme();
      return;
    }
    theme = this.getThemeFromObject(this.themes[this.theme]);
    let dirty = false;
    if (theme.colors)
    for (let i = 0; i < this.maxNumStates; i ++) {
      if (!Color.eq(theme.colors[i], this.colors[i])) {
        dirty = true;
        break;
      }
    }
    dirty = dirty
      || !Color.eq(theme.pageBackground, this.pageBackground)
      || !Color.eq(theme.modelBackground, this.modelBackground)
      || !Color.eq(theme.defaultColor, this.defaultColor)
      || theme.blendMode != this.blendMode
      || theme.cellGap != this.cellGap
      || theme.cellBorderWidth != this.cellBorderWidth;
    if (dirty) {
      this.setTheme();
    }
    this.board.runHooksAsync('updateTheme');
  }

  getThemeFromObject(obj) {
    let args = [Config.defaults, obj].map((e) => {
      let {blendMode, cellGap, cellBorderWidth, pageBackground, modelBackground, defaultColor, colors} = e;
      return {blendMode, cellGap, cellBorderWidth, pageBackground, modelBackground, defaultColor, colors};
    });
    return Hexular.util.merge(...args);
  }

  // --- STORAGE ---

  getKeyValues(keys) {
    let obj = {};
    for (let key of keys)
      obj[key] = this[key];
    return Hexular.util.merge({}, obj);
  }

  getSessionConfig() {
    let sessionConfig = this.getKeyValues([
      'autopause',
      'blendMode',
      'cellBorderWidth',
      'cellGap',
      'colorMapping',
      'colorMode',
      'colors',
      'customInput',
      'defaultCap',
      'defaultColor',
      'defaultJoin',
      'defaultRule',
      'defaultScale',
      'drawFunctions',
      'drawDefaultQ',
      'drawStepInterval',
      'fallbackTool',
      'filters',
      'groundState',
      'imageFormat',
      'interval',
      'maxNumStates',
      'meta',
      'modelBackground',
      'nh',
      'numStates',
      'pageBackground',
      'paintColors',
      'preset',
      'radius',
      'rbMiss',
      'rbMatch',
      'rbMissRel',
      'rbMatchRel',
      'rbName',
      'rbRel',
      'rbStates',
      'rules',
      'shiftTool',
      'showModelBackground',
      'steps',
      'theme',
      'tool',
      'toolSize',
      'trb',
      'videoBitsPerSecond',
      'videoCodec',
      'videoFrameRate',
      'videoMimeType',
    ]);
    sessionConfig.pluginData = this.plugins.map((e) => e.toString());
    return sessionConfig;
  };

  getLocalConfig() {
    let localConfig = this.getKeyValues([
      'availableRules',
      'presets',
      'themes',
    ]);
    Object.entries(localConfig.availableRules).forEach(([rule, fn]) => {
      localConfig.availableRules[rule] = fn.toString();
    });
    return localConfig;
  }

  retrieveConfig() {
    let sessionConfig = JSON.parse(this.sessionStorageObj.getItem('sessionConfig') || '{}');
    let localConfig = JSON.parse(this.localStorageObj.getItem('localConfig') || '{}');
    localConfig.availableRules = localConfig.availableRules || {};
    return {localConfig, sessionConfig}
  }

  restoreModel() {
    let modelState = this.loadModel('modelState');
    if (modelState) {
      this.board.newHistoryState();
      this.board.model.import(modelState);
      this.board.draw();
    }
  }

  restoreState(config) {
    if (this.model)
      this.restoreModel();
    config = config || this.retrieveConfig();
    let {localConfig, sessionConfig} = config;

    Object.entries(localConfig.availableRules).forEach(([rule, val]) => {
      let fn;
      try {
        val = eval(val);
        fn = val;
        if (Array.isArray(val)) {
          let ruleBuilder = val.length > 1 ? Hexular.util.ruleBuilder : Hexular.util.templateRuleBuilder;
          fn = ruleBuilder(...val);
        }
        else {
          fn = val;
        }
      }
      catch (e) {
        this.board.setMessage(`Error while loading rule "${rule}"`);
        console.error(e);
        console.trace();
      }
      if (typeof fn == 'function')
        localConfig.availableRules[rule] = fn;
      else
        delete localConfig.availableRules[rule];
    });

    let presets = localConfig.presets;
    if (presets) {
      localConfig.presets = {};
      Object.entries(presets).forEach(([presetName, preset]) => {
        localConfig.presets[presetName] = new Preset(preset);
      });
    }

    Hexular.util.merge(this, localConfig, sessionConfig);
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
    config.preset = config.preset || '';
    config.theme = config.theme || '';
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

  storeLocalConfigAsync() {
    if (!this.pendingStoreLocalAsync) {
      this.pendingStoreLocalAsync = true;
      window.setTimeout(() => {
        this.storeLocalConfig();
        this.pendingStoreLocalAsync = null;
      }, 50);
    }
  }

  storeModel(key, bytes, obj={}) {
    obj[key] = Array.from(bytes).map((e) => e.toString(36)).join(',');
    this.storeSessionState(obj);
  }

  loadModel(key) {
    let str = this.sessionStorageObj.getItem(key);
    if (str) {
      let array = str.split(',').map((e) => parseInt(e, 36));
      return new Uint8Array(array);
    }
  }

  clearStorage() {
    let modelState = this.loadModel('modelState');
    this.sessionStorageObj.clear();
    this.localStorageObj.clear();
    this.storeModel('modelState', modelState);
  }

  _strToTuple(str) {
    return str.split(':').map((e) => parseInt(e)).map((e) => isNaN(e) ? null : e);
  }

  _tupleToStr(tuple) {
    return tuple.join(':');
  }
}
