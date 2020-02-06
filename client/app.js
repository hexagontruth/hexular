// --- INIT ---

const DEFAULTS = new OptParser({
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
  nh: 6,
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
  themes: {
    dark: {
      background: '#111111',
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
    darkRainbow: {
      background: '#111111',
      colors:[
        '#000000',
        '#ff0000',
        '#ffaa00',
        '#aaff00',
        '#00ff00',
        '#00ffff',
        '#00aaff',
        '#0066ff',
        '#0000ff',
        '#aa00ff',
        '#ff00ff',
        '#ff00aa',
      ],
    },
  },
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
const onMouseEvent = EventHole('mousedown', 'mouseup', 'mouseout', 'mousemove', 'click');
const onTouchEvent = EventHole('touchstart', 'touchmove', 'touchend');

// Main board class

class Board {
  static resize(radius) {
    let opts = Object.assign({}, DEFAULTS);
    if (radius)
      opts.radius = radius;
    let board = Board.instance = new Board(opts);
    board.draw().then(() => {
      board.modals.config.update();
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
        hexfilled: HexFilledAction,
        hexoutline: HexOutlineAction,
        pinch: PinchAction,
      },
      sizableTools: [
        'brush',
        'line',
        'hexfilled',
        'hexoutline',
      ],
      modal: null,
      container: document.querySelector('.container'),
      overlay: document.querySelector('.overlay'),
      message: document.querySelector('.message'),
      infoCursor: document.querySelector('.info-cursor'),
      infoTool: document.querySelector('.info-tool'),
      toolInfo: document.querySelector('.tool-info'),
      colorToolbar: document.querySelector('.toolbar.colors'),
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
        center: document.querySelector('#center'),
        showDocumentation: document.querySelector('#show-documentation'),
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
      modals: {
        config: new ConfigModal(this, 'config'),
        resize: new ResizeModal(this, 'resize'),
      }
    };
    Object.assign(this, props, ...args);

    // Set numStates and presets
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
      this.modals.config.numStates.value = this.numStates;
      this.preset = null;
    }
    else {
      this.modals.config.numStates.value = numStates;
      this.numStates = numStates;
    }
    this.maxNumStates = Math.max(this.maxNumStates, this.numStates);

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
    this.buttons.center.onmouseup = (ev) => this.resize();
    this.buttons.showDocumentation.onmouseup = (ev) => this.showDocumentation();
    this.buttons.load.onmouseup = (ev) => this.load();
    this.buttons.save.onmouseup = (ev) => this.save();
    this.buttons.saveImage.onmouseup = (ev) => this.saveImage();
    this.buttons.import.onmouseup = (ev) => this.import();

    this.tools.move.onmouseup = (ev) => this.setTool('move');
    this.tools.fill.onmouseup = (ev) => this.setTool('fill');
    this.tools.brush.onmouseup = (ev) => this.setTool('brush');
    this.tools.line.onmouseup = (ev) => this.setTool('line');
    this.tools.hexfilled.onmouseup = (ev) => this.setTool('hexfilled');
    this.tools.hexoutline.onmouseup = (ev) => this.setTool('hexoutline');
    this.toolMisc.color.onmouseup = (ev) => this.setColorMode();
    this.toolSizes.forEach((e, i) => e.onmouseup = (ev) => this.setToolSize(i + 1));
    this.colorButtons.forEach((button, i) => {
      button.onmousedown = (ev) => this.handleSetColor(ev, i);
      button.style.backgroundColor = this.colors[i];
    });

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

    this.restoreState();
    this.setTool(this.tool);
    this.setToolSize(this.toolSize);
    this.setColorMode(this.colorMode);
    this.setColor(0, this.paintColors[0]);
    this.setColor(1, this.mobile ? -1 : this.paintColors[1]);
    this.setNh(this.nh);
    this.resize();
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
      this.storeModelState();
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
    this.storeModelState();
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

  updateInfoCursorInfo() {
    let cell = this.selected;
    this.infoCursor.innerHTML =
      cell && cell.coord.map((c) => (c > 0 ? '+' : '-') + ('0' + Math.abs(c)).slice(-2)) || '';
  }

  updateInfoTool() {
    let info = this.action && this.action.info;
    this.infoTool.innerHTML = info != null ? info : '';
  }

  // Add rule or preset - also use these if adding from console

  addRule(ruleName, fn) {
    this.availableRules[ruleName] = fn;
    this.modals.config.update();
  }

  addPreset(presetName, fnArray) {
    this.presets[presetName] = fnArray;
    this.modas.config.update();
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
      this.storeModelState();
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
        this.modals.config.update();
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

  storeModelState(bytes) {
    bytes = bytes || this.model.export();
    window.bytes = bytes;
    let str = Array.from(bytes).map((e) => e.toString(36)).join('');
    this.storeState({modelState: str});
  }

  storeState(opts={}) {
    Object.entries(opts).forEach(([key, value]) => {
      sessionStorage.setItem(key, value);
    });
  }

  restoreState() {
    let modelState = sessionStorage.getItem('modelState');
    let tool = sessionStorage.getItem('tool');
    let toolSize = sessionStorage.getItem('toolSize');
    let colorMode = parseInt(sessionStorage.getItem('colorMode'));
    let paintColors = sessionStorage.getItem('paintColors');
    if (modelState) {
      this.newHistoryState();
      let numArray = modelState.split('').map((e) => parseInt(e, 36));
      let bytes = new Int8Array(numArray);
      this.model.import(bytes);
      this.draw();
    }
    tool && this.setTool(tool);
    toolSize && this.setToolSize(toolSize);
    colorMode != null && this.setColorMode(colorMode);
    if (paintColors) {
      paintColors.split(',').forEach((e, i) => {
        this.setColor(i, parseInt(e));
      })
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
      this.storeModelState(nextState);
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
      this.storeModelState(nextState);
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
          else if (key == 'k') {
            this.toggleModal('config');
          }
          else if (key == 'j') {
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
      else if (ev.key == 'F1') {
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
      else if (ev.key == 'c') {
        this.setColorMode();
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
        this.newHistoryState();
        if (ev.buttons & 1) {
          this.startAction(ev);
        }
        else if (ev.buttons & 2) {
          let setState = this.getPaintColor(1);
          this.startAction(ev, {setState});
        }
      }
    }
    else if (ev.type == 'mouseup' && this.action) {
      this.endAction(ev);
    }
    else if (ev.type == 'click') {
      if (ev.target == this.overlay) {
        this.toggleModal();
        ev.stopPropagation();
      }
      else if (ev.target == this.message) {
        this.clearMessage();
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
        this.updateInfoCursorInfo();
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
    this.updateInfoTool();
  }

  moveAction(ev) {
    if (this.action) {
      this.action.move(ev);
      this.updateInfoTool();
    }
  }

  endAction(ev) {
    this.action && this.action.end(ev);
    this.action = null;
    this.updateInfoTool();
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
}