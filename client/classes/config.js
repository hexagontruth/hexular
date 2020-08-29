class Config {
  static get defaults() {
    return {
      preset: 'default',
      theme: 'light',
      meta: {},
      media: {},
      order: 60,
      cellRadius: 10,
      zoom: 1,
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
      undoStackSize: 128,
      mobileOrder: 30,
      mobileZoom: 1.5,
      mobileUndoStackSize: 64,
      interval: 125,
      autopause: true,
      theme: 'default',
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
      backgroundColor: '#f8f8f8',
      modelBackgroundColor: '#ffffff',
      defaultColor: '#77f0f0',
      selectWidth: 2,
      selectColor: '#ffbb33',
      cellGap: 1,
      cellBorderWidth: 1,
      rules: Array(this.maxNumStates).fill(this.defaultRule),
      plugins: [],
      arrayType: 'Uint8Array',
      imageFormat: 'png',
      imageQuality: 1,
      padStepDigits: 4,
      padDrawStepDigits: 2,
      defaultImageFilenameTemplate: 'hex-{steps}.{format}',
      defaultModelFilenameTemplate: 'hex-{steps}.bin',
      defaultArchiveFilename: 'hexular.ar',
      defaultSettingsFilename: 'hexular.json',
      defaultVideoFilename: 'hexular.webm',
      recordingMode: false,
      videoMimeType: 'video/webm',
      videoCodec: 'vp9',
      videoFrameRate: 60,
      videoBitsPerSecond: 2 ** 28,
      scaleFactor: 1,
      pixelScaleFactor: 1,
      tool: 'brush',
      shiftTool: 'move',
      blurTool: null,
      locked: false,
      lockedTool: null,
      toolSize: 1,
      colorMode: 0,
      paintColors: [1, 0],
      importMask: [],
      customPaintMap: null,
      steps: 0,
      drawDefaultQ: 1,
      clearOnDraw: true,
      drawStepInterval: 1,
      fadeIndex: 0,
      drawModelBackground: true,
      alpha: 1,
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
      snippetFields: {
        name: null,
        text: '',
      },
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
        drawFilledPointyHex: true,
        drawOutlinePointyHex: false,
        drawFilledFlatHex: false,
        drawOutlineFlatHex: false,
        drawFilledCircle: false,
        drawOutlineCircle: false,
      },
      radioGroups: {
        draw: [
          [
            'sortCellsAsc',
            'sortCellsDesc',
          ],
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
      presets: Hexular.util.merge({}, Presets),
      snippets: Hexular.util.merge({}, Examples.snippets),
      themes: Hexular.util.merge(Themes),
    };
    this.board = board;
    Hexular.util.merge(this, Config.defaults, library);
    this.colors = Color.from(this.colors);
    // Let us infer if this is a mobile browser and make some tweaks
    if (window.devicePixelRatio > 1 && screen.width < 640) {
      this.mobile = true;
      this.order = Config.defaults.mobileOrder;
      this.zoom = Config.defaults.mobileZoom;
      this.undoStackSize = Config.defaults.mobileUndoStackSize;
    }

    // Restore state from local/session storage
    this.restoreState();

    // Finally, merge in URL parameter and constructor args
    Hexular.util.merge(this, new OptParser(this), ...args);

    // Set logical size for all canvases
    let width = (this.order + 1) * this.cellRadius * Hexular.math.apothem * 4;
    let height = (this.order + 1) * this.cellRadius * 3;
    this.logicalWidth = width;
    this.logicalHeight = height;

    this.mobile && document.body.classList.add('mobile');
  }

  initialize() {
    try {
      this.model = this.board.model;
      this.bgAdapter = this.board.bgAdapter;
      this.adapter = this.board.adapter;
      this.fgAdapter = this.board.fgAdapter;
      this.configModal = this.board.modals.config;
      this.themeModal = this.board.modals.theme;
      this.drawModal = this.board.modals.draw;
      this.srbModal = this.board.modals.srb;
      this.trbModal = this.board.modals.trb;
      this.pluginModal = this.board.modals.plugin;
      this.customModal = this.board.modals.custom;
      this.configModal.update();
      this.updateMathPresets();

      // Drawing config initialization
      this.adapterFunctions = {
          sortCellsAsc: () => this.model.sortCells((a, b) => a.state - b.state),
          sortCellsDesc: () => this.model.sortCells((a, b) => b.state - a.state),
        };
      let cellCallbacks = [
          'drawFilledPointyHex',
          'drawOutlinePointyHex',
          'drawFilledFlatHex',
          'drawOutlineFlatHex',
          'drawFilledCircle',
          'drawOutlineCircle',
      ];
      for (let cb of cellCallbacks) {
        this.adapterFunctions[cb] = (...args) => {
          this.model.eachCell((cell) => {
            this.adapter[cb](cell);
          });
        }
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
        return this.adapterFunctions[active];
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
      this._setTool(this.tool);
      this.setToolSize(this.toolSize);
      this.setSteps(this.steps);
      this.setScaleFactor(this.scaleFactor);
      this.setZoom(this.zoom);
      this.setLock(this.locked);

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
      this.drawModal.reset();

      // Theme modal
      this.themeModal.update();
      this.themeModal.reset();

      // Plugins
      this.pluginModal.update();

      // Custom code modal
      this.customModal.update();

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
    delete this.availableRules[ruleName];
    this.updateRules();
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
    this.updatePresets();
  }

  deletePreset(presetName) {
    delete this.presets[presetName];
    this.updatePresets();
  }

  updatePresets() {
    this.configModal.update();
    this.storeLocalConfigAsync();
  }

  addSnippet(snippetName, snippet) {
    this.snippets[snippetName] = snippet;
    this.updateSnippets();
  }

  deleteSnippet(snippetName) {
    delete this.snippets[snippetName];
    if (this.snippetFields.name == snippetName)
      this.snippetFields.name = null;
    this.updateSnippets();
  }

  updateSnippets() {
    this.customModal.update();
    this.storeLocalConfigAsync();
  }

  addTheme(themeName, themeObj) {
    this.themes[themeName] = this.getThemeFromObject(themeObj || this);
    this.updateThemes();
  }

  deleteTheme(themeName) {
    delete this.themes[themeName];
    this.updateThemes();
  }

  updateThemes() {
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

  resize(order=this.order) {
    this.order = order;
    this.storeSessionConfig();
    Board.resize();
  }

  radioAlts(buttonName) {
    for (let radioGroup of this.radioGroups)
      if (radioGroup.includes(buttonName))
        return radioGroup.filter((e) => e != buttonName);
    return [];
  }

  resetOnDraw() {
    this.drawFunctions = Object.assign({}, Config.defaults.drawFunctions);
    this.setOnDraw();
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

  updateMathPresets() {
    this.cellRadius = this.model.cellRadius;
    this.innerRadius = this.cellRadius - this.cellGap / (2 * Hexular.math.apothem);
    this.flatVertices = Hexular.math.scalarOp(Hexular.math.vertices, this.innerRadius);
    this.pointyVertices = Hexular.math.scalarOp(Hexular.math.vertices.map(([x, y]) => [y, x]), this.innerRadius);
    this.board.draw();
  }

  lock() {
    return this.setLock(true);
  }

  unlock() {
    return this.setLock(false);
  }

  setLock(value=!this.locked) {
    let cur = this.locked;
    this.locked = value;
    let lockButton = this.board.buttons.toggleLock;
    if (value) {
      if (!cur && !this.lockedTool) {
        this.lockedTool = this.tool;
      }
      this._setTool('none');
    }
    else {
      if (cur && this.lockedTool) {
        this._setTool(this.lockedTool);
      }
      this.lockedTool = null;
    }
    document.body.classList.toggle('locked', value);
    lockButton.classList.toggle('active', value);
    lockButton.classList.toggle('icon-lock', value);
    lockButton.classList.toggle('icon-lock-open', !value);
    lockButton.setAttribute('title', value ? 'Unlock' : 'Lock');
    Object.values(this.board.tools).forEach((e) => e.disabled = value);
    document.title = Board.constants.baseTitle  + (value ? ' [LOCKED]' : '');
    this.storeSessionConfigAsync();
    return value;
  }

  // --- SETTERS ---

  setAutopause(value) {
    this.autopause = value;
    this.drawModal.updateAutopause();
    this.storeSessionConfigAsync();
  }

  setCellGap(width) {
    this.cellGap = width != null ? width : this.cellGap;
    this.themeModal.cellGap.value = this.cellGap;
    this.updateMathPresets();
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setCellBorderWidth(width) {
    this.cellBorderWidth = width != null ? width : this.cellBorderWidth;
    this.themeModal.cellBorderWidth.value = this.cellBorderWidth;
    this.updateMathPresets();
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setClearOnDraw(value=this.clearOnDraw) {
    this.clearOnDraw = value;
    value && this.board.draw();
    this.drawModal.updateClearOnDraw();
    this.storeSessionConfigAsync();
  }

  setSnippetFields(snippetFields) {
    this.snippetFields = Object.assign(this.snippetFields, snippetFields);
    this.storeSessionConfigAsync();
  }

  setDrawModelBackground(value=this.drawModelBackground) {
    this.drawModelBackground = value;
    this.board.draw();
    this.drawModal.updateDrawModelBackground();
    this.storeSessionConfigAsync();
  }

  setAlpha(alpha) {
    this.alpha = alpha = Math.max(0, Math.min(1, isNaN(alpha) ? 1 : alpha));
    this.adapter.context.globalAlpha = alpha;
    this.themeModal.alpha.value = alpha;
    this.checkTheme();
    this.board.draw();
    this.storeSessionConfigAsync();
  }

  setBlendMode(mode) {
    this.blendMode = mode;
    this.adapter.context.globalCompositeOperation = mode;
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
    let types = type ? [type] : ['backgroundColor', 'modelBackgroundColor', 'defaultColor'];
    types.forEach((key) => {
      let keyColor = this[key] = Color(color || this[key]);
      this.themeModal[key].jscolor.fromString(keyColor.hex);
      if (key == 'backgroundColor')
        document.body.style.backgroundColor = keyColor.hex;
    });
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setScaleFactor(scale) {
    this.scaleFactor = parseFloat(scale) || this.scaleFactor || 1;
    this.pixelScaleFactor = this.scaleFactor * window.devicePixelRatio;
    this.drawModal.updateScaleFactor();
    this.board.resetTransform();
    this.storeSessionConfigAsync();
  }

  setZoom(value) {
    this.zoom = value && parseFloat(value) || Config.defaults.zoom;
    this.drawModal.updateZoom();
    this.board.scaleTo(this.zoom);
    this.storeSessionConfigAsync();
  }

  setDrawStepInterval(value) {
    this.drawStepInterval = value && parseFloat(value) || Config.defaults.drawStepInterval;
    this.drawModal.updateDrawStepInterval();
    this.storeSessionConfigAsync();
  }

  setFadeIndex(value) {
    this.fadeIndex = parseFloat(value);
    this.drawModal.updateFadeIndex();
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

  setInterval(value=this.interval) {
    this.interval = parseInt(value);
    this.drawModal.updateInterval();
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
    else if (this.radioMap[fnName]){
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
    this.recordingMode = value != null ? value : !this.recordingMode;
  }

  setSteps(steps) {
    steps = steps != null ? steps : this.steps;
    this.steps = parseInt(steps);
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
    this.setAlpha(this.alpha);
    this.setColors();
    this.setCellGap();
    this.setCellBorderWidth();
  }

  setTool(tool, fallbackTool, force=false) {
    !this.locked && this._setTool(tool, fallbackTool);
  }

  _setTool(tool, fallbackTool) {
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
    this.board.fgCanvas.setAttribute('data-tool', this.tool);
    this.board.drawFg();
  }

  setToolSize(size) {
    this.toolSize = size || 1;
    this.board.toolSizes.forEach((e) => e.classList.remove('active'));
    let selected = this.board.toolSizes[size - 1];
    selected && selected.classList.add('active');
    this.board.drawFg();
    this.storeSessionConfigAsync();
  }

  setUndoStackSize(size) {
    this.undoStackSize = size;
    this.board.undoStack = size ? this.board.undoStack.slice(-size) : [];
    this.board.refreshHistoryButtons();
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
      || !Color.eq(theme.backgroundColor, this.backgroundColor)
      || !Color.eq(theme.modelBackgroundColor, this.modelBackgroundColor)
      || !Color.eq(theme.defaultColor, this.defaultColor)
      || theme.alpha != this.alpha
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
      let {
        alpha, blendMode, cellGap, cellBorderWidth, backgroundColor,
        modelBackgroundColor, defaultColor, colors
      } = e;
      return {
        alpha, blendMode, cellGap, cellBorderWidth, backgroundColor,
        modelBackgroundColor, defaultColor, colors
      };
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
      'alpha',
      'autopause',
      'blendMode',
      'blurTool',
      'cellBorderWidth',
      'cellGap',
      'clearOnDraw',
      'colorMapping',
      'colorMode',
      'colors',
      'defaultCap',
      'defaultColor',
      'defaultJoin',
      'defaultRule',
      'drawFunctions',
      'drawDefaultQ',
      'drawModelBackground',
      'drawStepInterval',
      'fadeIndex',
      'fallbackTool',
      'filters',
      'groundState',
      'imageFormat',
      'imageQuality',
      'importMask',
      'interval',
      'locked',
      'lockedTool',
      'maxNumStates',
      'meta',
      'modelBackgroundColor',
      'nh',
      'numStates',
      'backgroundColor',
      'paintColors',
      'preset',
      'order',
      'rbMiss',
      'rbMatch',
      'rbMissRel',
      'rbMatchRel',
      'rbName',
      'rbRel',
      'rbStates',
      'rules',
      'scaleFactor',
      'shiftTool',
      'showModelBackground',
      'snippetFields',
      'steps',
      'theme',
      'tool',
      'toolSize',
      'trb',
      'videoBitsPerSecond',
      'videoCodec',
      'videoFrameRate',
      'videoMimeType',
      'zoom',
    ]);
    sessionConfig.pluginData = this.plugins.map((e) => e.toString());
    return sessionConfig;
  };

  getLocalConfig() {
    let localConfig = this.getKeyValues([
      'availableRules',
      'presets',
      'snippets',
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

  getSessionItem(key) {
    return this.sessionStorageObj.getItem(key);
  }

  getLocalItem(key) {
    return this.localStorageObj.getItem(key);
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

  clearStorage(session=true, local=true) {
    let modelState = this.loadModel('modelState');
    session && this.sessionStorageObj.clear();
    local && this.localStorageObj.clear();
    modelState && this.storeModel('modelState', modelState);
  }

  _strToTuple(str) {
    return str.split(':').map((e) => parseInt(e)).map((e) => isNaN(e) ? null : e);
  }

  _tupleToStr(tuple) {
    return tuple.join(':');
  }
}
