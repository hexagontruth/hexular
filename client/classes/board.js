class Board {
  static resize(radius) {
    let opts = Object.assign({}, DEFAULTS);
    if (radius)
      opts.radius = radius;
    let oldBoard = Board.instance;
    oldBoard && oldBoard.stop();
    let board = new Board(opts);
    Board.instance = board;
    if (oldBoard) {
      board.undoStack = oldBoard.undoStack;
      board.redoStack = oldBoard.redoStack;
      board.refreshHistoryButtons();
    }
    Board.config = board.config;
    Board.model = board.model;
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
      hooks: {
        timer: [],
      },
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
      colorToolbar: document.querySelector('.toolbar.colors'),
      infoBoxes: {
        cursor: document.querySelector('.info-cursor'),
        timer: document.querySelector('.info-timer'),
        steps: document.querySelector('.info-steps'),
        tool: document.querySelector('.info-tool'),
      },
      buttons: {
        toolHider: document.querySelector('.tool-hider button'),
        toggleRecord: document.querySelector('#toggle-record'),
        togglePlay: document.querySelector('#toggle-play'),
        step: document.querySelector('#step'),
        clear: document.querySelector('#clear'),
        undo: document.querySelector('#undo'),
        redo: document.querySelector('#redo'),
        showConfig: document.querySelector('#show-config'),
        showDoc: document.querySelector('#show-doc'),
        saveSnapshot: document.querySelector('#snapshot-save'),
        loadSnapshot: document.querySelector('#snapshot-load'),
        load: document.querySelector('#load'),
        save: document.querySelector('#save'),
        saveImage: document.querySelector('#save-image'),
        import: document.querySelector('#import'),
        allNonrecording: document.querySelectorAll(
          '.toolbar .group button:not(#toggle-record):not(#toggle-play):not(#show-config):not(#show-doc)'
        ),
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
        center: document.querySelector('#center'),
        color: document.querySelector('#tool-color'),
      },
      colorButtons: Array.from(document.querySelectorAll('.toolbar.colors button')),
    };
    Object.assign(this, props);
    this.config = new Config(this, ...args);

    // Initialize canvases
    this.bg = document.createElement('canvas');
    this.fg = document.createElement('canvas');
    this.bg.classList.add('canvas', 'canvas-bg');
    this.fg.classList.add('canvas', 'canvas-fg');
    this.bgCtx = this.bg.getContext('2d');
    this.fgCtx = this.fg.getContext('2d');

    while (this.container.firstChild)
      this.container.firstChild.remove();
    this.container.appendChild(this.bg);
    this.container.appendChild(this.fg);

    window.onblur = (ev) => this.handleBlur(ev);
    window.onkeydown = (ev) => this.handleKey(ev);
    window.onkeyup = (ev) => this.handleKey(ev);
    window.oncontextmenu = (ev) => this.handleContextmenu(ev);
    window.onresize = (ev) => this.resize();
    window.onwheel = (ev) => this.handleScale(ev);
    OnMouseEvent(this, this.handleMouse);
    OnTouchEvent(this, this.handleTouch);

    this.buttons.toolHider.onclick = this.click(this.toggleToolHidden);
    this.buttons.togglePlay.onclick = this.click(this.togglePlay);
    this.buttons.step.onclick = this.click(this.step);
    this.buttons.clear.onclick = this.click(this.clear);
    this.buttons.undo.onclick = this.click(this.undo);
    this.buttons.redo.onclick = this.click(this.redo);
    this.buttons.toggleRecord.onclick = this.click(this.toggleRecord);
    this.buttons.showConfig.onclick = this.click(() => this.toggleModal('config'));
    this.buttons.showDoc.onclick = this.click(this.showDoc);
    this.buttons.saveSnapshot.onclick = this.click(this.saveSnapshot);
    this.buttons.loadSnapshot.onclick = this.click(this.loadSnapshot);
    this.buttons.load.onclick = this.click(this.load);
    this.buttons.save.onclick = this.click(this.save);
    this.buttons.saveImage.onclick = this.click(this.saveImage);
    this.buttons.import.onclick = this.click(this.import);

    this.tools.move.onclick = this.click((ev) => this.config.setTool('move'), this.config);
    this.tools.brush.onclick = this.click((ev) => this.config.setTool('brush'), this.config);
    this.tools.brush.onclick = this.click((ev) => this.config.setTool('brush'), this.config);
    this.tools.line.onclick = this.click((ev) => this.config.setTool('line'), this.config);
    this.tools.lockline.onclick = this.click((ev) => this.config.setTool('lockline'), this.config);
    this.tools.hexfilled.onclick = this.click((ev) => this.config.setTool('hexfilled'), this.config);
    this.tools.hexoutline.onclick = this.click((ev) => this.config.setTool('hexoutline'), this.config);
    this.toolMisc.center.onclick = this.click(this.resize);
    this.toolMisc.color.onclick = this.click(this.config.setPaintColorMode, this.config);
    this.toolSizes.forEach((button, i) => {
      button.onclick = this.click(() => this.config.setToolSize(i + 1), this.config);
    });
    this.colorButtons.forEach((button, i) => {
      button.onmousedown = (ev) => this.handleSetColor(ev, i);
      button.style.backgroundColor = this.config.colors[i];
    });

    let {radius, numStates, groundState, cellRadius, borderWidth, colors} = this.config;
    this.model = Hexular({radius, numStates, groundState, cellRadius});
    this.bgAdapter = this.model.CanvasAdapter({context: this.bgCtx, borderWidth, colors});
    this.fgAdapter = this.model.CanvasAdapter({context: this.fgCtx, borderWidth, colors});
    this.resize();

    this.modals = {
      confirm: new ConfirmModal(this, 'confirm'),
      config: new ConfigModal(this, 'config'),
      custom: new CustomModal(this, 'custom'),
      resize: new ResizeModal(this, 'resize'),
    }
    this.toggleModal();
    this.config.restoreModel();
    this.config.initialize();
  }

  get running() { return !!this.timer; }

  // Bypass Firefox's idiotic space-click
  click(fn, bind=this) {
    return (ev) => ev.pageX && ev.pageY && fn.bind(bind)();
  }

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
          else if (this.config.showModelBackground)
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
        requestAnimationFrame(() => this.start());
      this.playStart = Date.now();
      this.buttons.allNonrecording.forEach((e) => e.disabled = true);
      this.buttons.toggleRecord.className = 'icon-stop active';
      this.setButtonTitle(this.buttons.toggleRecord, 'Stop');
      this.recorder = new Recorder(this);
      this.draw().then(() => this.recorder.start());
    }
    else {
      requestAnimationFrame(() => {
        this.stop();
        this.draw();
      });
      this.recorder.stop();
      this.recorder = null;
      this.buttons.toggleRecord.className = 'icon-record';
      this.setButtonTitle(this.buttons.toggleRecord, 'Record');
      this.buttons.allNonrecording.forEach((e) => e.disabled = false);
    }
  }

  togglePlay() {
    if (!this.running) {
      this.start();
    }
    else {
      this.stop();
    }
  }

  start() {
    if (!this.running) {
      this.playStart = this.playStart || Date.now();
      this.timer = setInterval(this.step.bind(this), this.config.interval);
      this.startMeta();
      this.buttons.step.disabled = true;
      this.buttons.togglePlay.className = 'icon-pause';
      this.setButtonTitle(this.buttons.togglePlay, 'Pause');
    }
  }

  stop() {
    if (this.running) {
      if (this.recorder)
        this.toggleRecord();
      clearInterval(this.timer);
      this.timer = null;
      this.playStart = null;
      this.stopMeta();
      this.buttons.step.disabled = false;
      this.buttons.togglePlay.className = 'icon-play';
      this.setButtonTitle(this.buttons.togglePlay, 'Play');
    }
  }

  startMeta() {
    let hooks = this.hooks.timer.slice();
    let sexFmt = (i) => ('00' + i).slice(-2);
    this.infoBoxes.cursor.classList.add('hidden');
    this.recorder && this.infoBoxes.timer.classList.add('recording');
    this.metaInterval = setInterval(() => {
      let deltaMs = Date.now() - this.playStart;
      let delta = Math.floor(deltaMs / 1000);
      let thirds = Math.floor((deltaMs % 1000) * 60 / 1000);
      let secs = delta % 60;
      let mins = Math.floor(delta / 60) % 60;
      let str = `${sexFmt(mins)}:${sexFmt(secs)}:${sexFmt(thirds)}`;
      this.setInfoBox('timer', str);
      while (hooks[0] && hooks[0].trigger <= delta) {
        let hook = hooks.shift();
        hook.run();
      }
    }, 50);
  }

  stopMeta() {
    clearInterval(this.metaInterval);
    this.metaInterval = null;
    this.setInfoBox('timer');
    this.infoBoxes.cursor.classList.remove('hidden');
    this.infoBoxes.timer.classList.remove('recording');
  }

  step() {
    this.newHistoryState();
    try {
      this.model.step();
      this.draw();
      this.storeModelState();
      if (!this.model.changed && this.config.autopause) {
        this.stop();
        this.undo(true);
      }
      else {
        this.config.setSteps(this.config.steps + 1);
      }
    }
    catch (e) {
      console.log(e);
      this.setMessage(e, 'error');
      if (this.running)
        this.stop();
    }
  }

  clear() {
    this.newHistoryState();
    if (this.running)
      this.stop();
    this.model.clear();
    this.draw();
    this.storeModelState();
    this.config.setSteps(0);
  }

  addHook(key, trigger, run) {
    if (this.hooks[key]) {
      this.hooks[key].push({trigger, run});
      this.hooks[key].sort((a, b) => a.trigger - b.trigger);
    }
  }

  clearHooks(key) {
    if (this.hooks[key])
      this.hooks[key] = [];
  }

  toggleModal(modal) {
    let selected = this.modals[modal];
    let current = this.modal;
    Object.values(this.modals).forEach((e) => e.close());
    if (selected && current != selected)
      this.modals[modal].open();
    else if (!selected)
      this.fg.focus();
  }

  showDoc() {
    window.open('doc/', '_blank');
  }

  toggleToolHidden() {
    let hidden = document.body.classList.toggle('tool-hidden');
    this.buttons.toolHider.classList.toggle('active');
    this.buttons.toolHider.classList.toggle('icon-eye');
    this.buttons.toolHider.classList.toggle('icon-eye-off');
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

  // Save/load

  saveSnapshot() {
    this.config.storeModel('modelSnapshot', this.model.export());
    this.setMessage('Snapshot saved!');
  }

  loadSnapshot() {
    this.newHistoryState();
    let bytes = this.config.loadModel('modelSnapshot');
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
    this.promptDownload(this.config.defaultImageFilename, dataUri);
  }

  save() {
    let bytes = this.model.export();
    let blob = new Blob([bytes], {type: 'application/octet-stream'});
    let dataUri = window.URL.createObjectURL(blob);
    this.promptDownload(this.config.defaultFilename, dataUri);
  }

  load() {
    let Class = window[this.config.arrayType];
    this.newHistoryState();
    let fileLoader = new FileLoader('.bin', {reader: 'readAsArrayBuffer'});
    fileLoader.onload = (result) => {
      let bytes = new Class(result);
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

 // Undo/redo stuff

  newHistoryState() {
    let state = this.model.export();
    state.steps = this.config.steps;
    this.undoStack.push(state);
    if (this.undoStack.length > this.config.undoStackSize)
      this.undoStack.shift();
    this.redoStack = [];
    this.refreshHistoryButtons();
  }

  storeModelState(bytes) {
    bytes = bytes || this.model.export();
    this.config.storeModel('modelState', bytes);
  }

  undo(discard=false) {
    if (this.recorder) return;
    let nextState = this.undoStack.pop();
    if (nextState) {
      let curState = this.model.export()
      curState.steps = this.config.steps;
      this.model.import(nextState);
      this.storeModelState(nextState);
      this.config.setSteps(nextState.steps);
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
      curState.steps = this.config.steps;
      this.model.import(nextState);
      this.storeModelState(nextState);
      this.config.setSteps(nextState.steps);
      if (!discard)
        this.undoStack.push(curState);
      this.draw();
      this.refreshHistoryButtons();
    }
  }

  // Canvas transform stuff

  resize() {
    this.canvasWidth = this.config.logicalWidth / this.config.scaleFactor;
    this.canvasHeight = this.config.logicalHeight / this.config.scaleFactor;
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

  refreshHistoryButtons() {
    this.buttons.undo.disabled = +!this.undoStack.length || this.recorder;
    this.buttons.redo.disabled = +!this.redoStack.length;
  }


  scale(scale) {
    this.scaleZoom *= scale;
    this.eachContext((ctx) => {
      ctx.scale(scale, scale);
    });
    this.draw();
    this.drawSelectedCell();
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

  // Page/canvas listeners

  handleClearStorage() {
    this.modals.confirm.ask('Are you sure you want to clear local data, including custom rules and presets?')
    .then((e) => {
      if (e) {
        this.config.clearStorage();
        Board.resize(this.config.radius);
        Board.instance.setMessage('Settings cleared!');
      }
    }).catch((e) => { throw e; });
  }

  handleSetColor(ev, color) {
    if (ev.buttons & 1)
      this.config.setPaintColor(0, color);
    if (ev.buttons & 2)
      this.config.setPaintColor(1, color);
  }

  handleBlur(ev) {
    this.shift = false;
    this.config.setTool();
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
    let tagNames = ['TEXTAREA', 'INPUT', 'SELECT', 'BUTTON'];
    if (ev.key != 'Escape' && tagNames.includes(ev.target.tagName) && this.modal) {
      return;
    }
    let key = ev.key.toLowerCase();
    if (ev.key == 'Shift') {
      this.config.shift = ev.type == 'keydown';
      this.config.setTool();
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
        this.showDoc();
      }
      // Tool and lesser keys
      else if (ev.key == 'g') {
        this.config.setTool('fill');
      }
      else if (ev.key == 'b') {
        this.config.setTool('brush');
      }
      else if (ev.key == 'f') {
        this.config.setTool('hexfilled');
      }
      else if (ev.key == 'h') {
        this.config.setTool('hexoutline');
      }
      else if (ev.key == 'l') {
        this.config.setTool('line');
      }
      else if (ev.key == '/') {
        this.config.setTool('lockline');
      }
      else if (ev.key == 'm') {
        this.config.setTool('move');
      }
      else if (ev.key == '1') {
        this.config.setToolSize(1);
      }
      else if (ev.key == '2') {
        this.config.setToolSize(2);
      }
      else if (ev.key == '3') {
        this.config.setToolSize(3);
      }
      else if (key == 'r') {
        this.resize();
      }
      else if (ev.key == 'c') {
        this.config.setPaintColorMode();
      }
      else if (ev.key == 'q') {
        this.saveSnapshot();
      }
      else if (ev.key == 'a') {
        this.loadSnapshot();
      }
      else if (ev.shiftKey && this.config.colorMode && ev.key == 'ArrowUp') {
        let newColor = Hexular.math.mod(this.config.paintColors[1] - 1, this.colorButtons.length);
        this.config.setPaintColor(1, newColor);
      }
      else if (ev.shiftKey && this.config.colorMode && ev.key == 'ArrowDown') {
        let newColor = Hexular.math.mod(this.config.paintColors[1] + 1, this.colorButtons.length);
        this.config.setPaintColor(1, newColor);
      }
      else if (this.config.colorMode && ev.key == 'ArrowUp') {
        let newColor = Hexular.math.mod(this.config.paintColors[0] - 1, this.colorButtons.length);
        this.config.setPaintColor(0, newColor);
      }
      else if (this.config.colorMode && ev.key == 'ArrowDown') {
        let newColor = Hexular.math.mod(this.config.paintColors[0] + 1, this.colorButtons.length);
        this.config.setPaintColor(0, newColor);
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
          let setState = this.config.getPaintColor(1);
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
          this.config.setTool('pinch', this.config.tool);
          this.startAction(ev);
          this.config.setTool();
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
    let Class = this.toolClasses[this.config.tool];
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
        let selectSize = this.sizableTools.includes(this.config.tool) ? this.config.toolSize : 1;
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