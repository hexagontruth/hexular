// --- INIT ---

const DEFAULTS = {
  radius: 60,
  mobileRadius: 30,
  numStates: null,
  maxNumStates: 12,
  timerLength: 100,
  autopause: 1,
  undoStackSize: 64,
  mobileUndoStackSize: 16,
  availableRules: Object.assign({}, Hexular.rules, RULES),
  rule: null,
  defaultRule: 'identityRule',
  preset: 'default',
  presets: PRESETS,
  defaultImageFilename: 'hexular.png',
  defaultFilename: 'hexular.bin',
  defaultVideoFilename: 'hexular.webm',
  clampBottomFilter: 0,
  clampTopFilter: 0,
  modFilter: 1,
  edgeFilter: 0,
  cellRadius: 10,
  mobileCellRadius: 20,
  groundState: 0,
  borderWidth: 1,
  showModelBackground: 1,
  theme: 'light',
  tool: 'brush',
  toolSize: 1,
};

const THEMES = {
  dark: {
    background: '#333333',
    colors: Object.assign(Hexular.DEFAULTS.colors.slice(), [
      '#000000',
      '#888888',
      '#aaaaaa',
      '#cccccc',
      '#eeeeee',
    ]),
  },
  light: {
    background: '#eeeeee',
    colors: Hexular.DEFAULTS.colors.slice(),
  },
  white: {
    background: '#ffffff',
    colors: Hexular.DEFAULTS.colors.slice(),
  },
};

let board;

window.addEventListener('load', function(e) {
  let opts = {};
  location.search.substring(1).split('&').filter((e) => e.length > 0).forEach((e) => {
    let pair = e.split('=');
    let parsedInt = parseInt(pair[1]);
    opts[pair[0]] = Number.isNaN(parsedInt) ? pair[1] : parsedInt;
  });
  board = new Board(opts);
  board.restoreState();
  board.draw().then(() => {
    board.refreshRules();
    document.body.style.opacity = 1;
  });
});

// --- STUFF ---

const EventHole = (...events) => {
  let handlerFn = () => {};
  let handler = (ev) => handlerFn(ev);
  events.map((e) => window.addEventListener(e, handler, {passive: false}));
  return (obj, fn) => {
    handlerFn = fn.bind(obj);
  };
};
const onMouseEvent = EventHole('mousedown', 'mouseup', 'mouseout', 'mousemove');
const onTouchEvent = EventHole('touchstart', 'touchmove', 'touchend');


class Board {
  constructor(...args) {
    let props = {
      selected: null,
      lastSet: null,
      setState: null,
      timer: null,
      messageTimer: null,
      ruleMenus: [],
      undoStack: [],
      redoStack: [],
      msgIdx: 0,
      shift: false,
      shiftTool: 'move',
      toolClasses: {
        move: MoveAction,
        brush: BrushAction,
        line: LineAction,
        hexfilled: HexFilledAction,
        hexoutline: HexOutlineAction,
        pinch: PinchAction,
      },
      sizableTools: [
        'brush',
        'line',
      ],
      container: document.querySelector('.container'),
      overlay: document.querySelector('.overlay'),
      message: document.querySelector('.message'),
      info: document.querySelector('.info'),
      ruleConfig: document.querySelector('.rule-config'),
      buttons: {
        toolHider: document.querySelector('.tool-hider'),
        toggleRecord: document.querySelector('#toggle-record'),
        togglePlay: document.querySelector('#toggle-play'),
        step: document.querySelector('#step'),
        clear: document.querySelector('#clear'),
        undo: document.querySelector('#undo'),
        redo: document.querySelector('#redo'),
        center: document.querySelector('#center'),
        showConfig: document.querySelector('#show-config'),
        saveImage: document.querySelector('#save-image'),
        save: document.querySelector('#save'),
        load: document.querySelector('#load'),
        import: document.querySelector('#import'),
        resize: document.querySelector('#resize'),
        allNonrecording: document.querySelectorAll('.toolbar .group button:not(#toggle-record):not(#toggle-play)'),
      },
      tools: {
        move: document.querySelector('#tool-move'),
        brush: document.querySelector('#tool-brush'),
        line: document.querySelector('#tool-line'),
        hexfilled: document.querySelector('#tool-hexfilled'),
        hexoutline: document.querySelector('#tool-hexoutline'),
      },
      toolSizes: [
        document.querySelector('#ts-1'),
        document.querySelector('#ts-2'),
        document.querySelector('#ts-3'),
      ],
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
    Object.assign(this, THEMES[this.theme]);
    let numStates = this.maxNumStates;
    this.rules = Array(this.maxNumStates).fill(this.availableRules[this.defaultRule]);
    if (this.presets[this.preset]) {
      this.rules = Object.assign(this.rules, this.presets[this.preset].map((e) => this.availableRules[e]));
      numStates = this.presets[this.preset].length;
    }
    else {
      this.preset = null;
    }

    if (this.numStates && this.numStates != numStates) {
      this.controls.numStates.value = this.numStates;
      this.preset = null;
    }
    else {
      this.controls.numStates.value = numStates;
      this.numStates = numStates;
    }
    this.bg = document.createElement('canvas');
    this.fg = document.createElement('canvas');
    this.bg.classList.add('canvas', 'canvas-bg');
    this.fg.classList.add('canvas', 'canvas-fg');
    this.bgCtx = this.bg.getContext('2d');
    this.fgCtx = this.fg.getContext('2d');

    while (this.container.firstChild) this.container.firstChild.remove();
    this.container.appendChild(this.bg);
    this.container.appendChild(this.fg);
    this.customRuleTemplate = this.controls.customRule.value;

    this.scaleFactor = 1
    // Let us infer if this is a mobile browser and make some tweaks
    if (window.devicePixelRatio > 1 && screen.width < 640) {
      this.scaleFactor = window.devicePixelRatio;
      this.mobile = true;
      document.body.classList.add('mobile');
      this.radius = this.mobileRadius;
      this.cellRadius = this.mobileCellRadius;
      this.undoStackSize = this.mobileUndoStackSize;
    }


    document.body.style.backgroundColor = this.background;
    this.colors = this.colors.slice();

    window.onblur = (ev) => this.handleBlur(ev);
    window.onkeydown = (ev) => this.handleKey(ev);
    window.onkeyup = (ev) => this.handleKey(ev);
    window.oncontextmenu = (ev) => this.handleContextmenu(ev);
    window.onresize = (ev) => this.resize();
    window.onwheel = (ev) => this.handleScale(ev);
    onMouseEvent(this, this.handleMouse);
    onTouchEvent(this, this.handleTouch);

    this.buttons.toolHider.onmouseup = (ev) => this.toggleToolHidden();
    this.buttons.toggleRecord.onmouseup = (ev) => this.toggleRecord();
    this.buttons.togglePlay.onmouseup = (ev) => this.togglePlay();
    this.buttons.step.onmouseup = (ev) => this.step();
    this.buttons.clear.onmouseup = (ev) => this.clear();
    this.buttons.undo.onmouseup = (ev) => this.undo();
    this.buttons.redo.onmouseup = (ev) => this.redo();
    this.buttons.center.onmouseup = (ev) => this.resize();
    this.buttons.showConfig.onmouseup = (ev) => this.toggleConfig();
    this.buttons.saveImage.onmouseup = (ev) => this.saveImage();
    this.buttons.save.onmouseup = (ev) => this.save();
    this.buttons.load.onmouseup = (ev) => this.load();
    this.buttons.import.onmouseup = (ev) => this.import();
    this.buttons.resize.onmouseup = (ev) => this.promptResize();

    this.tools.move.onmouseup = (ev) => this.setTool('move');
    this.tools.brush.onmouseup = (ev) => this.setTool('brush');
    this.tools.line.onmouseup = (ev) => this.setTool('line');
    this.tools.hexfilled.onmouseup = (ev) => this.setTool('hexfilled');
    this.tools.hexoutline.onmouseup = (ev) => this.setTool('hexoutline');
    this.toolSizes.forEach((e, i) => e.onmouseup = (ev) => this.setToolSize(i + 1));

    this.controls.addRule.onmouseup = (ev) => this.handleAddRule();
    this.controls.checkAll.onmouseup = (ev) => this.handleCheckAll();
    this.controls.numStates.onchange = (ev) => this.setNumStates(ev.target.value);
    this.controls.selectPreset.onchange = (ev) => this.selectPreset(ev.target.value);
    this.controls.setAll.onchange = (ev) => this.handleSetAll(ev);
    this.controls.selectNeighborhood.onchange = (ev) => this.setNeighborhood(ev.target.value);


    let {rules, radius, groundState, cellRadius, borderWidth, colors} = this;
    this.model = Hexular({rules, radius, numStates, groundState, cellRadius});
    if (this.clampBottomFilter)
      this.model.addFilter(Hexular.filters.clampBottomFilter);
    if (this.clampTopFilter)
      this.model.addFilter(Hexular.filters.clampTopFilter);
    if (this.modFilter)
      this.model.addFilter(Hexular.filters.modFilter);
    if (this.edgeFilter)
      this.model.addFilter(Hexular.filters.edgeFilter);
    this.bgAdapter = this.model.CanvasAdapter({context: this.bgCtx, borderWidth, colors});
    this.fgAdapter = this.model.CanvasAdapter({context: this.fgCtx, borderWidth, colors});
    this.setTool(this.tool);
    this.setToolSize(this.toolSize);
    this.resize();
  }

  get running() { return !!this.timer; }

  eachContext(fn) {
    [this.bgCtx, this.fgCtx].forEach(fn);
  }

  draw() {
    if (this.bgAdapter && !this.drawPromise) {
      this.drawPromise = new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
          let callback;
          if (!!this.recorder)
            callback = this.bgAdapter.drawBackground;
          else if (this.showModelBackground)
            callback = this.bgAdapter.drawCubicBackground;
          this.bgAdapter.draw(callback);
          this.drawPromise = null;
          resolve();
        });
      });
    }
    return this.drawPromise;
  }

  // Button handlers (can also be called directly)

  toggleRecord() {
    if (!this.recorder) {
      if (!this.running) {
        this.togglePlay();
      }
      this.buttons.allNonrecording.forEach((e) => e.disabled = true);
      this.buttons.toggleRecord.className = 'icon-stop active';
      this.recorder = new Recorder(this);
      this.draw().then(() => this.recorder.start());
    }
    else {
      this.recorder.stop();
      this.recorder = null;
      this.togglePlay();
      this.draw();
      this.buttons.toggleRecord.className = 'icon-record';
      this.buttons.allNonrecording.forEach((e) => e.disabled = false);

    }
  }

  togglePlay() {
    if (!this.running) {
      this.timer = setInterval(this.step.bind(this), this.timerLength);
      this.buttons.step.disabled = true;
      this.buttons.togglePlay.className = 'icon-pause';
    }
    else {
      if (this.recorder) {
        this.toggleRecord();
      }
      clearInterval(this.timer);
      this.timer = null;
      this.buttons.step.disabled = false;
      this.buttons.togglePlay.className = 'icon-play';
    }
  }

  step() {
    this.newHistoryState();
    try {
      this.model.step();
      this.draw();
      this.storeState();
      if (this.autopause && !this.model.changed)
        this.togglePlay();
    }
    catch (e) {
      console.log(e);
      this.setMessage(e, 'error');
    }
  }

  clear() {
    this.newHistoryState();
    if (this.running) this.togglePlay();
    this.model.clear();
    this.draw();
    this.storeState();
  }

  toggleConfig() {
    this.overlay.classList.toggle('hidden');
  }

  toggleToolHidden() {
    let hidden = document.body.classList.toggle('tool-hidden');
    this.buttons.toolHider.classList.toggle('active');
    this.buttons.toolHider.classList.toggle('icon-eye');
    this.buttons.toolHider.classList.toggle('icon-eye-off');
  }

  promptResize() {
    let radiusParam = this.mobile ? 'mobileRadius' : 'radius';
    let newSize = prompt('Plz enter new board size > 1 or 0 for default. Rules will be reset and cells outside of new radius will be lost.', this.model.radius);
    if (newSize == null)
      return;
    let n = Number(newSize) || DEFAULTS[radiusParam];
    if (isNaN(n) || n < 0 || n == 1) {
      this.setMessage('Board size must be natural number > 1', 'error');
    }
    else if (n != this.model.radius) {
      let [base, params] = window.location.href.split('?');
      let paramMap = {};
      params = (params || '').split('&').filter((e) => e != '').map((e) => {
        let [key, value] = e.split('=');
        paramMap[key] = value;
      });

      paramMap[radiusParam] = n;
      if (n == DEFAULTS[radiusParam])
        delete paramMap[radiusParam];
      let url = base;
      if (Object.keys(paramMap).length > 0)
        url += '?' + Object.entries(paramMap).map((e) => e.join('=')).join('&');
      location.href = url;
    }
  }

  setTool(tool, fallbackTool) {
    if (tool) {
      this.tool = tool;
      this.fallbackTool = fallbackTool || tool;
    }
    else if (this.shift) {
      this.tool = this.shiftTool;
    }
    else if (this.tool != this.fallbackTool) {
      this.tool = this.fallbackTool;
    }
    Object.values(this.tools).forEach((e) => e.classList.remove('active'));
    if (this.tools[this.tool])
      this.tools[this.tool].classList.add('active');
    this.fg.setAttribute('data-tool', this.tool);
    this.drawSelectedCell();
  }

  setToolSize(size) {
    this.toolSize = size || 1;
    this.toolSizes.forEach((e) => e.classList.remove('active'));
    let selected = this.toolSizes[size - 1];
    selected && selected.classList.add('active');
    this.drawSelectedCell();
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

  saveImage() {
    let dataUri = this.bg.toDataURL('image/png');
    this.promptDownload(this.defaultImageFilename, dataUri);
  }

  save() {
    let bytes = this.model.export();
    let blob = new Blob([bytes], {type: 'application/octet-stream'});
    let dataUri = window.URL.createObjectURL(blob);
    this.promptDownload(this.defaultFilename, dataUri);
  }

  load() {
    this.newHistoryState();
    let fileReader = new FileReader();
    let input = document.createElement('input');
    input.type = 'file';
    fileReader.onload = (ev) => {
      let buffer = ev.target.result;
      let bytes = new Int8Array(buffer);
      this.model.import(bytes);
      this.draw();
      this.storeState();
    };
    input.onchange = () => {
      fileReader.readAsArrayBuffer(input.files[0]);
    };
    input.click();
  }

  import() {
    let fileReader = new FileReader();
    let input = document.createElement('input');
    input.type = 'file';
    fileReader.onload =  (ev) => {
      let code = ev.target.result;
      try {
        eval(code) // lol
        this.refreshRules();
        this.setMessage('Custom code imorted!');
      }
      catch (e) {
        this.setMessage(e.toString(), 'error');
      }

    };
    input.onchange = () => {
      let file = input.files[0];
      if (file.type.indexOf('javascript') != -1)
        fileReader.readAsText(file);
      else
        this.setMessage('Please provide a JavaScript file', 'error');
    };
    input.click();
  }

  promptDownload(filename, dataUri) {
    let a = document.createElement('a');
    a.href = dataUri;
    a.download = filename;
    a.click();
  }

  storeState(bytes) {
    bytes = bytes || this.model.export();
    let str = bytes.join('');
    sessionStorage.setItem('modelState', str);
  }

  restoreState() {
    let modelState = sessionStorage.getItem('modelState');
    if (modelState) {
      this.newHistoryState();
      let bytes = new Int8Array(modelState.split(''));
      this.model.import(bytes);
      this.draw();
    }
  }

 // Undo/redo stuff

  newHistoryState() {
    this.undoStack.push(this.model.export());
    if (this.undoStack.length > this.undoStackSize)
      this.undoStack.shift();
    this.redoStack = [];
    this.refreshHistoryButtons();
  }

  undo() {
    if (this.recorder) return;
    let nextState = this.undoStack.pop();
    if (nextState) {
      let curState = this.model.export()
      this.model.import(nextState);
      this.storeState(nextState);
      this.redoStack.push(curState);
      this.draw();
      this.refreshHistoryButtons();
    }
  }

  redo() {
    if (this.recorder) return;
    let nextState = this.redoStack.pop();
    if (nextState) {
      let curState = this.model.export()
      this.model.import(nextState);
      this.storeState(nextState);
      this.undoStack.push(curState);
      this.draw();
      this.refreshHistoryButtons();
    }
  }

  refreshHistoryButtons() {
    this.buttons.undo.disabled = +!this.undoStack.length || this.recorder;
    this.buttons.redo.disabled = +!this.redoStack.length;
  }

  // Canvas transform stuff

  resize() {
    this.logicalWidth = this.radius * this.cellRadius * Hexular.math.apothem * 4;
    this.logicalHeight = this.radius * this.cellRadius * 3;
    this.canvasWidth = this.logicalWidth / this.scaleFactor;
    this.canvasHeight = this.logicalHeight / this.scaleFactor;
    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.scaleZoom = 1;
    this.eachContext((ctx) => {
      ctx.canvas.width = this.canvasWidth;
      ctx.canvas.height = this.canvasHeight;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    });
    // Resize
    let [oldX, oldY] = [this.scaleX, this.scaleY];
    this.scaleX = this.canvasWidth / window.innerWidth;
    this.scaleY = this.canvasHeight / window.innerHeight;
    let [scaleX, scaleY] = [this.scaleX / oldX, this.scaleY / oldY];
    this.eachContext((ctx) => {
      ctx.scale(scaleX, scaleY);
    });
    // Translate to center
    this.translate([this.canvasWidth / this.scaleX / 2, this.canvasHeight / this.scaleY / 2]);
    this.draw();
  }

  translate([x, y]) {
    this.translateX += x;
    this.translateY += y;
    x /= this.scaleZoom;
    y /= this.scaleZoom;
    this.eachContext((ctx) => {
      ctx.translate(x, y);
    });
    this.draw();
  }

  scale(scale) {
    this.scaleZoom *= scale;
    this.eachContext((ctx) => {
      ctx.scale(scale, scale);
    });
    this.draw();
  }

  // Page/canvas listeners

  handleBlur(ev) {
    this.shift = false;
    this.setTool();
  }

  handleScale(ev) {
    let scale = 1 - Math.sign(ev.deltaY) * 0.1;
    this.scale(scale);
    this.draw();
  }

  handleContextmenu(ev) {
    if (ev.target == this.fg) ev.preventDefault();
  }

  handleKey(ev) {
    let key = ev.key.toLowerCase();
    if (ev.key == 'Shift') {
      this.shift = ev.type == 'keydown';
      this.setTool();
      return;
    }
    else if (ev.type == 'keyup') {
      return;
    }
    else if (ev.type == 'keydown' && !ev.repeat) {
      if (ev.ctrlKey) {
        if (key == 'z') {
          if (ev.shiftKey) {
            this.redo();
          }
          else {
            this.undo();
          }
        }
        else if (!ev.shiftKey) {
          if (key == 's') {
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
          else if (key == 'i') {
            this.import();
          }
          else if (key == 'r') {
            this.resize();
          }
          else {
            return;
          }
        }
        else {
          return;
        }
      }
      // ESC to hide/show controls
      else if (ev.key == 'Escape') {
        if (!this.overlay.classList.contains('hidden')) {
          this.toggleConfig();
        }
        else {
          this.toggleToolHidden();
        }
      }

      // TAB to start/stop
      else if (ev.key == 'Tab') {
        if (ev.shiftKey) {
          this.toggleRecord();
        }
        else {
          this.togglePlay();
        }
      }

      // SPACE to step or stop
      else if (ev.key == ' ') {
        if (this.running) {
          this.togglePlay();
        }
        else {
          this.step();
        }
      }
      else if (ev.key == 'b') {
        this.setTool('brush');
      }
      else if (ev.key == 'g') {
        this.setTool('hexfilled');
      }
      else if (ev.key == 'h') {
        this.setTool('hexoutline');
      }
      else if (ev.key == 'l') {
        this.setTool('line');
      }
      else if (ev.key == 'm') {
        this.setTool('move');
      }
      else if (ev.key == '1') {
        this.setToolSize(1);
      }
      else if (ev.key == '2') {
        this.setToolSize(2);
      }
      else if (ev.key == '3') {
        this.setToolSize(3);
      }
      else if (ev.key == '`') {
        this.toggleConfig();
      }
      else {
        return;
      }
    }
    ev.preventDefault();
  }

  handleMouse(ev) {
    if (ev.type == 'mousedown') {
      if (ev.target == this.fg && this.selected && !this.action) {
        this.newHistoryState();
        if (ev.buttons & 1) {
          this.startAction(ev);
        }
        else if (ev.buttons & 2) {
          let setState = Hexular.math.mod(this.selected.state - 1, this.model.numStates);
          this.startAction(ev, {setState});
        }
      }
      else if (ev.target == this.overlay) {
        this.toggleConfig();
      }
      else if (ev.target == this.message) {
        this.clearMessage();
      }
    }
    else if (ev.type == 'mouseup' && this.action) {
      this.endAction(ev);
    }
    else if (ev.type == 'mousemove') {
      let cell;
      if (ev.target == this.fg) {
        this.selectCell([ev.pageX, ev.pageY]);
        this.action && this.action.move(ev);
      }
      else {
        this.selectCell();
      }
      if (ev.target != this.info) {
        let cell = this.selected;
        this.info.innerHTML = cell && cell.coord.map((c) => (c > 0 ? '+' : '-') + ('0' + Math.abs(c)).slice(-2)) || '';
      }
    }
    else if (ev.type == 'mouseout') {
      this.selectCell();
    }
  }

  handleTouch(ev) {
    if (ev.target == this.fg) {
      if (ev.touches.length == 1) {
        let [x, y] = [ev.touches[0].pageX, ev.touches[0].pageY];
        if (ev.type == 'touchstart') {
          this.selectCell([x, y]);
          this.startAction(ev);
        }
        if (ev.type == 'touchmove') {
          this.selectCell([x, y]);
          this.action && this.action.move(ev);
        }
        ev.preventDefault();
      }
      else if (ev.touches.length == 2) {
        if (ev.type == 'touchstart') {
          this.setTool('pinch', this.tool);
          this.startAction(ev);
          this.setTool();
        }
        if (ev.type == 'touchmove') {
          this.action && this.action.move(ev);
        }
      }
      if (ev.type == 'touchend') {
        this.endAction(ev);
        this.selectCell();
      }
    }
  }

  startAction(ev, ...args) {
    let ctrl = ev.ctrlKey;
    let shift = ev.shiftKey;
    let Class = this.toolClasses[this.tool];
    this.action = new Class(this, {ctrl, shift}, ...args);
    this.action.start(ev);
  }

  endAction(ev) {
    this.action && this.action.end(ev);
    this.action = null;
  }

  // Cell selection and setting

  selectCell(coord) {
    this.selected = coord && this.cellAt(coord);
    this.drawSelectedCell();
  }

  drawSelectedCell() {
    let cell = this.selected;
    if (!this.action) {
      this.fgAdapter.clear();
      if (cell) {
        let selectSize = this.sizableTools.includes(this.tool) ? this.toolSize : 1;
        Hexular.util.hexWrap(cell, selectSize).forEach((e) => this.fgAdapter.defaultDrawSelector(e));
      }
    }
  }

  cellAt([x, y]) {
    x -= this.translateX;
    y -= this.translateY;
    x -= this.offsetX;
    x -= this.offsetY;
    x = x / this.scaleZoom;
    y = y / this.scaleZoom;
    return this.model.cellAt([x, y]);
  }

  // Alert messages

  setMessage(message, className) {
    let idx = ++this.msgIdx;
    className = className || 'alert';
    this.message.classList = 'message active ' + className;
    this.message.innerHTML = message;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      if (this.msgIdx == idx)
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
        this.model.rules[ruleMenu.index] = rule;
      }
    });
    this.controls.setAll.selectedIndex = 0;
    this.checkPreset();
  }

  handleSetRule(ev) {
    const ctl = ev.target;
    this.model.rules[ctl.ruleMenu.index] = this.availableRules[ctl.value] || this.availableRules.identityRule;
    this.checkPreset();
  }

  // Set default neighborhood for rules using top-level cell helper functions

  setNeighborhood(neighborhood) {
    this.model.setNeighborhood(neighborhood);
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
      this.model.rules[ruleMenu.index] = fn;
    });
    this.preset = presetName;
    this.controls.selectPreset.value = presetName;
  }

  checkPreset() {
    const presetList = this.presets[this.preset];
    if (!presetList)
      return;
    let dirty = (() => {
      if (this.model.numStates != presetList.length)
        return true;
      return this.model.rules.slice(0, this.model.numStates).reduce((a, ruleFn, idx) => {
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
    this.numStates = this.model.numStates = parseInt(numStates);
    this.ruleMenus.forEach((ruleMenu) => {
      let disabled = ruleMenu.index >= numStates;
      ruleMenu.container.setAttribute('data-disabled', disabled);
      this.model.rules[ruleMenu.index] = this.rules[ruleMenu.index];
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
      let ruleMenu = new RuleMenu(this, i, this.model.rules[i], i >= this.model.numStates);
      ruleMenu.select.addEventListener('change', (ev) => this.handleSetRule(ev));
      this.ruleMenus.push(ruleMenu);
      this.ruleConfig.appendChild(ruleMenu.container);
    }
  }
}