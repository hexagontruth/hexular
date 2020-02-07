// --- INIT ---

const DEFAULTS = new OptParser({
  radius: 60,
  mobileRadius: 30,
  maxNumStates: 12,
  interval: 100,
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
  storage: 'sessionStorage',
  clampBottomFilter: 0,
  clampTopFilter: 0,
  modFilter: 1,
  edgeFilter: 0,
  cellRadius: 10,
  mobileCellRadius: 20,
  scaleFactor: 1,
  groundState: 0,
  borderWidth: 1,
  showModelBackground: 1,
  theme: 'light',
  tool: 'brush',
  shiftTool: 'move',
  toolSize: 1,
  colorMode: 0,
  paintColors: [1, 0],
  numStates: null,
  nh: null,
  lastSteps: null,
  steps: 0,
  themes: THEMES,
});

window.addEventListener('load', function(e) {
  if (DEFAULTS.mobile)
    document.body.classList.add('mobile');
  Board.resize();
});

// Event holes

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

// Main board class

class Board {
  static resize(radius) {
    let opts = Object.assign({}, DEFAULTS);
    if (radius)
      opts.radius = radius;
    let board = Board.instance = new Board(opts);
    board.draw().then(() => {
      document.body.style.opacity = 1;
    });
  }

  constructor(...args) {
    let props = {
      selected: null,
      lastSet: null,
      setState: null,
      timer: null,
      messageTimer: null,
      undoStack: [],
      redoStack: [],
      msgIdx: 0,
      shift: false,
      toolClasses: {
        move: MoveAction,
        fill: FillAction,
        brush: BrushAction,
        line: LineAction,
        lockline: LocklineAction,
        hexfilled: HexFilledAction,
        hexoutline: HexOutlineAction,
        pinch: PinchAction,
      },
      sizableTools: [
        'brush',
        'line',
        'lockline',
        'hexfilled',
        'hexoutline',
      ],
      modal: null,
      container: document.querySelector('.container'),
      overlay: document.querySelector('.overlay'),
      message: document.querySelector('.message'),
      toolInfo: document.querySelector('.tool-info'),
      colorToolbar: document.querySelector('.toolbar.colors'),
      infoBoxes: {
        steps: document.querySelector('.info-steps'),
        tool: document.querySelector('.info-tool'),
        cursor: document.querySelector('.info-cursor'),
      },
      buttons: {
        toolHider: document.querySelector('.tool-hider'),
        toggleRecord: document.querySelector('#toggle-record'),
        togglePlay: document.querySelector('#toggle-play'),
        step: document.querySelector('#step'),
        clear: document.querySelector('#clear'),
        undo: document.querySelector('#undo'),
        redo: document.querySelector('#redo'),
        showConfig: document.querySelector('#show-config'),
        resize: document.querySelector('#resize'),
        showCustom: document.querySelector('#show-custom'),
        center: document.querySelector('#center'),
        showDocumentation: document.querySelector('#show-documentation'),
        saveSnapshot: document.querySelector('#snapshot-save'),
        loadSnapshot: document.querySelector('#snapshot-load'),
        load: document.querySelector('#load'),
        save: document.querySelector('#save'),
        saveImage: document.querySelector('#save-image'),
        import: document.querySelector('#import'),
        allNonrecording: document.querySelectorAll('.toolbar .group button:not(#toggle-record):not(#toggle-play)'),
      },
      tools: {
        fill: document.querySelector('#tool-fill'),
        move: document.querySelector('#tool-move'),
        brush: document.querySelector('#tool-brush'),
        line: document.querySelector('#tool-line'),
        lockline: document.querySelector('#tool-lockline'),
        hexfilled: document.querySelector('#tool-hexfilled'),
        hexoutline: document.querySelector('#tool-hexoutline'),
      },
      toolSizes: [
        document.querySelector('#ts-1'),
        document.querySelector('#ts-2'),
        document.querySelector('#ts-3'),
      ],
      toolMisc: {
        color: document.querySelector('#tool-color'),
      },
      colorButtons: Array.from(document.querySelectorAll('.toolbar.colors button')),
    };
    Object.assign(this, props, ...args);
    this.storage = window[this.storage] || {getItem: () => null, setItem: () => null};

    this.rules = Array(this.maxNumStates).fill(this.availableRules[this.defaultRule]);

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

    // Initialize canvases
    this.bg = document.createElement('canvas');
    this.fg = document.createElement('canvas');
    this.bg.classList.add('canvas', 'canvas-bg');
    this.fg.classList.add('canvas', 'canvas-fg');
    this.bgCtx = this.bg.getContext('2d');
    this.fgCtx = this.fg.getContext('2d');

    while (this.container.firstChild) this.container.firstChild.remove();
    this.container.appendChild(this.bg);
    this.container.appendChild(this.fg);

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
    this.buttons.togglePlay.onmouseup = (ev) => this.togglePlay();
    this.buttons.step.onmouseup = (ev) => this.step();
    this.buttons.clear.onmouseup = (ev) => this.clear();
    this.buttons.undo.onmouseup = (ev) => this.undo();
    this.buttons.redo.onmouseup = (ev) => this.redo();
    this.buttons.toggleRecord.onmouseup = (ev) => this.toggleRecord();
    this.buttons.showConfig.onmouseup = (ev) => this.toggleModal('config');
    this.buttons.resize.onmouseup = (ev) => this.toggleModal('resize');
    this.buttons.showCustom.onmouseup = (ev) => this.toggleModal('custom');
    this.buttons.center.onmouseup = (ev) => this.resize();
    this.buttons.showDocumentation.onmouseup = (ev) => this.showDocumentation();
    this.buttons.saveSnapshot.onmouseup = (ev) => this.saveSnapshot();
    this.buttons.loadSnapshot.onmouseup = (ev) => this.loadSnapshot();
    this.buttons.load.onmouseup = (ev) => this.load();
    this.buttons.save.onmouseup = (ev) => this.save();
    this.buttons.saveImage.onmouseup = (ev) => this.saveImage();
    this.buttons.import.onmouseup = (ev) => this.import();

    this.tools.move.onmouseup = (ev) => this.setTool('move');
    this.tools.fill.onmouseup = (ev) => this.setTool('fill');
    this.tools.brush.onmouseup = (ev) => this.setTool('brush');
    this.tools.line.onmouseup = (ev) => this.setTool('line');
    this.tools.lockline.onmouseup = (ev) => this.setTool('lockline');
    this.tools.hexfilled.onmouseup = (ev) => this.setTool('hexfilled');
    this.tools.hexoutline.onmouseup = (ev) => this.setTool('hexoutline');
    this.toolMisc.color.onmouseup = (ev) => this.setColorMode();
    this.toolSizes.forEach((e, i) => e.onmouseup = (ev) => this.setToolSize(i + 1));
    this.colorButtons.forEach((button, i) => {
      button.onmousedown = (ev) => this.handleSetColor(ev, i);
      button.style.backgroundColor = this.colors[i];
    });

    let {rules, radius, numStates, groundState, cellRadius, borderWidth, colors} = this;
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

    this.restoreState();
    this.setTool(this.tool);
    this.setToolSize(this.toolSize);
    this.setColorMode(this.colorMode);
    this.setColor(0, this.paintColors[0]);
    this.setColor(1, this.mobile ? -1 : this.paintColors[1]);
    this.setNh(this.nh);
    this.resize();
    this.setSteps(this.steps);
    this.loadPresets();
    this.modals = {
      config: new ConfigModal(this, 'config'),
      custom: new CustomModal(this, 'custom'),
      resize: new ResizeModal(this, 'resize'),
    }
    this.toggleModal();
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
      if (!this.running)
        requestAnimationFrame(() => this.togglePlay());
      this.buttons.allNonrecording.forEach((e) => e.disabled = true);
      this.buttons.toggleRecord.className = 'icon-stop active';
      this.setButtonTitle(this.buttons.toggleRecord, 'Stop');
      this.recorder = new Recorder(this);
      this.recordStart = Date.now();
      let sexFmt = (i) => ('00' + i).slice(-2);
      this.recordInterval = setInterval(() => {
        let delta = Date.now() - this.recordStart;
        let rawSecs = Math.floor(delta / 1000);
        let thirds = Math.floor((delta % 1000) * 60 / 1000);
        let secs = rawSecs % 60;
        let mins = Math.floor(rawSecs / 60) % 60;
        let hours = Math.floor(rawSecs / 3600) % 60;
        let str = `<span class='timer'>${sexFmt(hours)}:${sexFmt(mins)}:${sexFmt(secs)}:${sexFmt(thirds)}</span>`;
        this.setInfoBox('tool', str);
      }, 50);
      this.draw().then(() => this.recorder.start());
    }
    else {
      this.recorder.stop();
      this.recorder = null;
      clearInterval(this.recordInterval);
      this.setInfoBox('tool');
      this.recordInterval = null;
      this.recordStart = null;
      this.togglePlay();
      this.draw();
      this.buttons.toggleRecord.className = 'icon-record';
      this.setButtonTitle(this.buttons.toggleRecord, 'Record');
      this.buttons.allNonrecording.forEach((e) => e.disabled = false);

    }
  }

  togglePlay() {
    if (!this.running) {
      this.timer = setInterval(this.step.bind(this), this.interval);
      this.buttons.step.disabled = true;
      this.buttons.togglePlay.className = 'icon-pause';
      this.setButtonTitle(this.buttons.togglePlay, 'Pause');
    }
    else {
      if (this.recorder) {
        this.toggleRecord();
      }
      clearInterval(this.timer);
      this.timer = null;
      this.buttons.step.disabled = false;
      this.buttons.togglePlay.className = 'icon-play';
      this.setButtonTitle(this.buttons.togglePlay, 'Play');
    }
  }

  step() {
    this.newHistoryState();
    try {
      this.model.step();
      this.draw();
      this.storeModelState();
      if (this.autopause && !this.model.changed) {
        this.togglePlay();
        this.undo(true);
      }
      else {
        this.setSteps(this.steps + 1);
      }
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
    this.storeModelState();
    this.setSteps(0);
  }

  toggleModal(modal) {
    Object.values(this.modals).forEach((e) => e.close());
    let selected = this.modals[modal];
    let current = this.modal;
    if (!selected || current == selected) {
      this.modal = null;
      this.overlay.classList.add('hidden');
      return;
    }
    this.modals[modal].open();
  }

  showDocumentation() {
    window.open('doc/', '_blank');
  }

  toggleToolHidden() {
    let hidden = document.body.classList.toggle('tool-hidden');
    this.buttons.toolHider.classList.toggle('active');
    this.buttons.toolHider.classList.toggle('icon-eye');
    this.buttons.toolHider.classList.toggle('icon-eye-off');
  }

  setTool(tool, fallbackTool) {
    if (tool) {
      this.tool = tool;
      this.fallbackTool = fallbackTool || tool;
      this.storeState({tool: this.tool});
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
    this.storeState({toolSize: this.toolSize});
    this.toolSizes.forEach((e) => e.classList.remove('active'));
    let selected = this.toolSizes[size - 1];
    selected && selected.classList.add('active');
    this.drawSelectedCell();
  }

  setColorMode(mode) {
    this.colorMode = mode != null ? mode : +!this.colorMode;
    this.storeState({colorMode: this.colorMode});
    if (this.colorMode) {
      this.toolMisc.color.classList.add('active');
      this.colorToolbar.classList.remove('hidden');
    }
    else {
      this.colorToolbar.classList.add('hidden');
      this.toolMisc.color.classList.remove('active');
    }
  }

  setColor(idx, color) {
    this.paintColors[idx] = color;
    this.storeState({paintColors: this.paintColors.join(',')});
    let className = `active-${idx}`;
    this.colorButtons.forEach((e) => e.classList.remove(className));
    this.colorButtons[color] && this.colorButtons[color].classList.add(className);
  }

  getPaintColor(idx) {
    let offset = idx ? -1 : 1;
    return this.colorMode ? this.paintColors[idx] : Hexular.math.mod(this.selected.state + offset, this.numStates);
  }

  setNh(nh) {
    this.model.setNeighborhood(nh);
    this.nh = nh;
  }

  setButtonTitle(button, title) {
    let cur = button.title.split(' ');
    cur[0] = title;
    button.title = cur.join(' ');
  }

  setCursorInfoInfo() {
    let cell = this.selected;
    let coord = cell && cell.coord.map((c) => (c > 0 ? '+' : '-') + ('0' + Math.abs(c)).slice(-2));
    this.setInfoBox('cursor', coord);
  }

  setToolInfo() {
    let info = this.action && this.action.info;
    this.setInfoBox('tool', info);
  }

  // Add rule or preset - also use these if adding from console

  addRule(ruleName, fn) {
    this.availableRules[ruleName] = fn;
    this.modals.config.update();
  }

  addPreset(presetName, preset) {
    this.presets[presetName] = preset
    this.storeState({presets: JSON.stringify(this.presets)});
    this.modals && this.modals.config && this.modals.config.update();
  }

  loadPresets() {
    let presets = this.storage.getItem('presets');
    if (!presets)
      return;
    let obj = JSON.parse(presets) || {};
    Object.entries(obj).forEach(([presetName, presetObj]) => {
      this.addPreset(presetName, presetObj);
    });
  }

  // Save/load

  saveSnapshot() {
    this.storeModel('modelSnapshot', this.model.export());
    this.setMessage('Snapshot saved!');
  }

  loadSnapshot() {
    this.newHistoryState();
    let bytes = this.loadModel('modelSnapshot');
    if (bytes) {
      let cur = this.model.export();
      let diff = false;
      for (let i = 0; i < cur.length; i++)
        if (cur[i] != bytes[i]) {
          diff = true;
          break;
        }
      if (diff) {
        this.model.import(bytes);
        this.draw();
        this.setMessage('Snapshot loaded!');
      }
      else {
        this.setMessage('Snapshot already loaded!', 'warning');
      }
    }
    else {
      this.setMessage('No snapshot found!', 'warning');
    }
  }

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
    let fileLoader = new FileLoader('.bin', {reader: 'readAsArrayBuffer'});
    fileLoader.onload = (result) => {
      let bytes = new Int8Array(result);
      this.model.import(bytes);
      this.draw();
      this.storeModelState();
      this.setMessage('Model loaded!');
    };
    fileLoader.prompt();
  }

  import() {
    let fileLoader = new FileLoader('.js', {multiple: true});
    fileLoader.onload =  (code) => {
      try {
        eval(code) // lol
        this.modals.config.update();
        this.setMessage('Custom code imorted!');
      }
      catch (e) {
        this.setMessage(e.toString(), 'error');
      }

    };
    fileLoader.filter = (files) => {
      let result = files.map((file) => file.type.indexOf('javascript') >= 0);
      result.some((e) => !e) && this.setMessage('Not all selected files are JavaScript files', 'error');
      return result;
    };
    fileLoader.prompt();
  }

  promptDownload(filename, dataUri) {
    let a = document.createElement('a');
    a.href = dataUri;
    a.download = filename;
    a.click();
  }

  storeModelState(bytes) {
    bytes = bytes || this.model.export();
    this.storeModel('modelState', bytes);
  }

  restoreState() {
    let modelState = this.storage.getItem('modelState');
    let steps = this.storage.getItem('steps');
    let tool = this.storage.getItem('tool');
    let toolSize = this.storage.getItem('toolSize');
    let colorMode = this.storage.getItem('colorMode');
    let paintColors = this.storage.getItem('paintColors');
    if (modelState) {
      this.newHistoryState();
      let bytes = this.loadModel('modelState');
      this.model.import(bytes);
      this.draw();
    }
    steps != null && this.setSteps(parseInt(steps));
    tool && this.setTool(tool);
    toolSize && this.setToolSize(toolSize);
    colorMode && this.setColorMode(parseInt(colorMode));
    if (paintColors) {
      paintColors.split(',').forEach((e, i) => {
        this.setColor(i, parseInt(e));
      })
    }
  }

  storeState(opts={}) {
    Object.entries(opts).forEach(([key, value]) => {
      this.storage.setItem(key, value);
    });
  }

  storeModel(key, bytes, obj={}) {
    obj[key] = Array.from(bytes).map((e) => e.toString(36)).join('');
    this.storeState(obj);
  }

  loadModel(key) {
    let str = this.storage.getItem(key);
    if (str) {
      let array = str.split('').map((e) => parseInt(e, 36));
      return new Int8Array(array);
    }
  }

 // Undo/redo stuff

  newHistoryState() {
    let state = this.model.export();
    state.steps = this.steps;
    this.undoStack.push(state);
    if (this.undoStack.length > this.undoStackSize)
      this.undoStack.shift();
    this.redoStack = [];
    this.refreshHistoryButtons();
  }

  undo(discard=false) {
    if (this.recorder) return;
    let nextState = this.undoStack.pop();
    if (nextState) {
      let curState = this.model.export()
      curState.steps = this.steps;
      this.model.import(nextState);
      this.storeModelState(nextState);
      this.setSteps(nextState.steps);
      if (!discard)
        this.redoStack.push(curState);
      this.draw();
      this.refreshHistoryButtons();
    }
  }

  redo(discard=false) {
    if (this.recorder) return;
    let nextState = this.redoStack.pop();
    if (nextState) {
      let curState = this.model.export()
      curState.steps = this.steps;
      this.model.import(nextState);
      this.storeModelState(nextState);
      this.setSteps(nextState.steps);
      if (!discard)
        this.undoStack.push(curState);
      this.draw();
      this.refreshHistoryButtons();
    }
  }

  refreshHistoryButtons() {
    this.buttons.undo.disabled = +!this.undoStack.length || this.recorder;
    this.buttons.redo.disabled = +!this.redoStack.length;
  }

  setSteps(steps) {
    steps = steps != null ? steps : this.steps;
    this.steps = steps;
    this.setInfoBox('steps', steps);
    this.storeState({steps});
  }

  setInfoBox(boxName, value) {
    value = value != null ? value.toString() : '';
    let box = this.infoBoxes[boxName];
    let lastValue = box.innerHTML;
    box.innerHTML = value;
    if (lastValue == '' && value != '')
      box.classList.add('active');
    else if (lastValue != '' && value == '')
      box.classList.remove('active');
  }

  // Canvas transform stuff

  resize() {
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
    this.drawSelectedCell();
  }

  // Page/canvas listeners

  handleSetColor(ev, color) {
    if (ev.buttons & 1)
      this.setColor(0, color);
    if (ev.buttons & 2)
      this.setColor(1, color);
  }

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
    if (ev.target == this.fg || this.colorButtons.includes(ev.target))
      ev.preventDefault();
  }

  handleKey(ev) {
    let types = ['textarea', 'input', 'select'];
    if (types.includes(ev.target.type)) {
      return;
    }
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
          else if (key == 'c') {
            this.clear();
          }
          else if (key == 'f') {
            this.toggleModal('custom');
          }
          else if (key == 'i') {
            this.import();
          }
          else if (key == 'k') {
            this.toggleModal('config');
          }
          else if (key == 'r') {
            this.toggleModal('resize');
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
        if (this.modal) {
          this.toggleModal();
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
      // F1 to show documentation
      else if (ev.key == 'F1' || ev.key == '?') {
        this.showDocumentation();
      }
      // Tool and lesser keys
      else if (ev.key == 'g') {
        this.setTool('fill');
      }
      else if (ev.key == 'b') {
        this.setTool('brush');
      }
      else if (ev.key == 'f') {
        this.setTool('hexfilled');
      }
      else if (ev.key == 'h') {
        this.setTool('hexoutline');
      }
      else if (ev.key == 'l') {
        this.setTool('line');
      }
      else if (ev.key == '/') {
        this.setTool('lockline');
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
      else if (key == 'r') {
        this.resize();
      }
      else if (ev.key == 'c') {
        this.setColorMode();
      }
      else if (ev.key == 'q') {
        this.saveSnapshot();
      }
      else if (ev.key == 'a') {
        this.loadSnapshot();
      }
      else if (ev.shiftKey && this.colorMode && ev.key == 'ArrowUp') {
        this.setColor(1, Hexular.math.mod(this.paintColors[1] - 1, this.colorButtons.length));
      }
      else if (ev.shiftKey && this.colorMode && ev.key == 'ArrowDown') {
        this.setColor(1, Hexular.math.mod(this.paintColors[1] + 1, this.colorButtons.length));
      }
      else if (this.colorMode && ev.key == 'ArrowUp') {
        this.setColor(0, Hexular.math.mod(this.paintColors[0] - 1, this.colorButtons.length));
      }
      else if (this.colorMode && ev.key == 'ArrowDown') {
        this.setColor(0, Hexular.math.mod(this.paintColors[0] + 1, this.colorButtons.length));
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
        if (ev.buttons & 1) {
          this.startAction(ev);
        }
        else if (ev.buttons & 2) {
          let setState = this.getPaintColor(1);
          this.startAction(ev, {setState});
        }
      }
      this.clickTarget = ev.target;
    }
    else if (ev.type == 'mouseup') {
      if (this.action)
        this.endAction(ev);
      else if (this.clickTarget == ev.target) {
        if (ev.target == this.overlay) {
          this.toggleModal();
        }
        else if (ev.target == this.message) {
          this.clearMessage()
        }
        this.clickTarget = null;
      }
    }
    else if (ev.type == 'mousemove') {
      let cell;
      if (ev.target == this.fg) {
        this.selectCell([ev.pageX, ev.pageY]);
        this.moveAction(ev);
      }
      else {
        this.selectCell();
      }
      if (ev.target != this.info) {
        this.setCursorInfoInfo();
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
          this.moveAction(ev);
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
          this.moveAction(ev);
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
    this.setToolInfo();
  }

  moveAction(ev) {
    if (this.action) {
      this.action.move(ev);
      this.setToolInfo();
    }
  }

  endAction(ev) {
    this.action && this.action.end(ev);
    this.action = null;
    this.setToolInfo();
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
    [x, y] = this.windowToModel([x, y]);
    return this.model.cellAt([x, y]);
  }

  // TODO: Use Hexular.math.matrixMult
  windowToModel([x, y]) {
    x -= this.translateX;
    y -= this.translateY;
    x -= this.offsetX;
    x -= this.offsetY;
    x = x / this.scaleZoom;
    y = y / this.scaleZoom;
    return [x, y];
  }

  modelToWindow([x, y]) {
    x = x * this.scaleZoom;
    y = y * this.scaleZoom;
    x += this.offsetX;
    y += this.offsetY;
    x += this.translateX;
    y += this.translateY;
    return [x, y];
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
    }, 4000);
  }

  clearMessage() {
    this.message.className = 'message';
    requestAnimationFrame(() => this.message.innerHTML = '');
    clearTimeout(this.messageTimer);
  }
}