class Board {
  static registerPlugin(PluginClass) {
    Board.plugins[PluginClass.name] = PluginClass;
    Board.instance && Board.instance.modals.draw.update();
  }

  static resize(configOpts={}, boardOpts=Board.defaults) {
    // TODO: Wtf is this even doing?
    return new Promise((resolve, reject) => {
      document.body.classList.add('splash');
      let oldBoard = Board.instance;
      oldBoard && oldBoard.stop();
      setTimeout(async () => {
        let board = new Board(configOpts, boardOpts);
        Board.instance = board;
        if (oldBoard) {
          oldBoard.pluginControls.forEach((e) => e.delete());
          board.undoStack = oldBoard.undoStack;
          board.redoStack = oldBoard.redoStack;
          board.refreshHistoryButtons();
          Object.entries(oldBoard.hooks).forEach(([key, value]) => {
            value.forEach((e, i) => {
              e.fn.radio || board.addHook(key, e, i)
            });
          });
        }
        Board.config = board.config;
        Board.model = board.model;
        Board.bgAdapter = board.bgAdapter;
        Board.adapter = board.adapter;
        Board.fgAdapter = board.fgAdapter;
        Board.modals = board.modals;
        Board.shared = board.shared;
        Board.db || Board.initDb();
        board.runHooks('resize');
        await board.draw();
        board.clearFg();
        document.body.classList.remove('splash');
        resolve();
      }, 50);
    });
  }

  static async initDb() {
    // Initialize media database
    const DB_VERSION = 1;
    const DB_SCHEME = {
      media: {keyPath: 'name'}
    };
    Board.db = new Database('hexular', DB_VERSION, DB_SCHEME);
    await Board.db.connect();
    return true;
  }

  static get aspectRatio() {
    return window.innerWidth / window.innerHeight;
  }

  static get defaults() {
    let defaults = {
      selected: null,
      debugSelected: null,
      lastSet: null,
      setState: null,
      timer: null,
      drawStep: 0,
      drawStepQ: 0,
      drawStepQInc: 0,
      playStart: null,
      playSteps: 0,
      playLast: null,
      shared: new SharedStore(),
      messageTimer: null,
      undoStack: [],
      redoStack: [],
      msgIdx: 0,
      shift: false,
      configMenu: false,
      altView: false,
      imageCapture: null,
      hooks: {
        incrementStep: [],
        playStep: [],
        step: [],
        draw: [],
        drawCell: [],
        drawStep: [],
        timer: [],
        playStart: [],
        playStop: [],
        resize: [],
        center: [],
        select: [],
        debugSelect: [],
        debugStep: [],
        drawFg: [],
        clear: [],
        paint: [],
        updatePreset: [],
        updateTheme: [],
      },
      hookMap: {},
      hookQueue: new Set(),
      pluginControls: [],
      scaling: false,
      scaleQueue: [],
      toolClasses: {
        none: NoneAction,
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
      modalTranslate: null,
      container: document.querySelector('.container'),
      overlay: document.querySelector('.modal-container'),
      messageWrapper: document.querySelector('.message-wrapper'),
      message: document.querySelector('.message'),
      menus: {
        top: document.querySelector('#toolbar-top'),
        color: document.querySelector('#color-menu'),
        config: document.querySelector('#config-menu'),
      },
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
        toggleMenu: document.querySelector('#toggle-menu'),
        showConfig: document.querySelector('#show-config'),
        showTheme: document.querySelector('#show-theme'),
        showDraw: document.querySelector('#show-draw'),
        showPlugin: document.querySelector('#show-plugin'),
        showResize: document.querySelector('#show-resize'),
        showSrb: document.querySelector('#show-srb'),
        showTrb: document.querySelector('#show-trb'),
        showCustom: document.querySelector('#show-custom'),
        showClear: document.querySelector('#show-clear'),
        saveSnapshot: document.querySelector('#snapshot-save'),
        loadSnapshot: document.querySelector('#snapshot-load'),
        showDoc: document.querySelector('#show-doc'),
        saveImage: document.querySelector('#save-image'),
        toggleImageCapture: document.querySelector('#toggle-image-capture'),
        load: document.querySelector('#load'),
        save: document.querySelector('#save'),
        saveData: document.querySelector('#save-data'),
        loadData: document.querySelector('#load-data'),
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
      allColorButtons: Array.from(document.querySelectorAll('.toolbar.colors button')),
      colorButtons: [],
    };
    defaults.disableWhenRecording = [
      defaults.buttons.step,
      defaults.buttons.undo,
      defaults.buttons.redo,
      defaults.buttons.saveSnapshot,
      defaults.buttons.loadSnapshot,
      defaults.buttons.saveImage,
      defaults.buttons.toggleImageCapture,
      defaults.buttons.save,
      defaults.buttons.load,
    ];
    return defaults;
  }

  constructor(configOpts={}, boardOpts=Board.defaults) {
    Object.assign(this, boardOpts);
    this.config = new Config(this, configOpts);
    this.execCommandBroken = Util.execCommandBroken();
    this.hookCounter = 0;

    // Initialize canvases
    this.container.querySelectorAll('canvas').forEach((e) => e.remove());
    this.bgCanvas = document.createElement('canvas');
    this.mainCanvas = document.createElement('canvas');
    this.fgCanvas = document.createElement('canvas');
    this.bgCanvas.classList.add('canvas', 'canvas-bg');
    this.bgCanvas.classList.add('canvas', 'canvas-main');
    this.fgCanvas.classList.add('canvas', 'canvas-fg');
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.mainCtx = this.mainCanvas.getContext('2d');
    this.fgCtx = this.fgCanvas.getContext('2d');
    this.container.appendChild(this.bgCanvas);
    this.container.appendChild(this.mainCanvas);
    this.container.appendChild(this.fgCanvas);

    window.onblur = (ev) => this.handleBlur(ev);
    window.onkeydown = (ev) => this.handleKey(ev);
    window.onkeyup = (ev) => this.handleKey(ev);
    window.oncontextmenu = (ev) => this.handleContextmenu(ev);
    window.onresize = (ev) => this.resetTransform();
    window.onwheel = (ev) => this.handleWheel(ev);
    OnMouseEvent(this, this.handleMouse);
    OnTouchEvent(this, this.handleTouch);

    this.buttons.toolHider.onclick = this.click(this.toggleToolHidden);
    this.buttons.togglePlay.onclick = this.click(this.togglePlay);
    this.buttons.step.onclick = this.click(this.step);
    this.buttons.clear.onclick = this.click(this.clear);
    this.buttons.undo.onclick = this.click(this.undo);
    this.buttons.redo.onclick = this.click(this.redo);
    this.buttons.toggleRecord.onclick = this.click(this.toggleRecord);
    this.buttons.toggleMenu.onclick = this.click(this.toggleMenu);
    this.buttons.showConfig.onmousedown = () => this.toggleModal('config');
    this.buttons.showDraw.onmousedown = () => this.toggleModal('draw');
    this.buttons.showTheme.onmousedown = () => this.toggleModal('theme');
    this.buttons.showResize.onmousedown = () => this.toggleModal('resize');
    this.buttons.showSrb.onmousedown = () => this.toggleModal('srb');
    this.buttons.showTrb.onmousedown = () => this.toggleModal('trb');
    this.buttons.showPlugin.onmousedown = () => this.toggleModal('plugin');
    this.buttons.showCustom.onmousedown = () => this.toggleModal('custom');
    this.buttons.showClear.onmousedown = () => this.handleClearStorage();

    this.buttons.saveSnapshot.onclick = this.click(this.saveSnapshot);
    this.buttons.loadSnapshot.onclick = this.click(this.loadSnapshot);
    this.buttons.showDoc.onclick = this.click(this.showDoc);
    this.buttons.saveImage.onclick = this.click(this.promptSaveImage);
    this.buttons.toggleImageCapture.onclick = this.click(this.toggleImageCapture);
    this.buttons.load.onclick = this.click(this.load);
    this.buttons.save.onclick = this.click(this.save);
    this.buttons.loadData.onclick = this.click(this.loadData);
    this.buttons.saveData.onclick = this.click(this.saveData);

    this.tools.move.onclick = this.click((ev) => this.config.setTool('move'), this.config);
    this.tools.brush.onclick = this.click((ev) => this.config.setTool('brush'), this.config);
    this.tools.fill.onclick = this.click((ev) => this.config.setTool('fill'), this.config);
    this.tools.line.onclick = this.click((ev) => this.config.setTool('line'), this.config);
    this.tools.lockline.onclick = this.click((ev) => this.config.setTool('lockline'), this.config);
    this.tools.hexfilled.onclick = this.click((ev) => this.config.setTool('hexfilled'), this.config);
    this.tools.hexoutline.onclick = this.click((ev) => this.config.setTool('hexoutline'), this.config);
    this.toolMisc.center.onclick = this.click(this.resetTransform);
    this.toolMisc.color.onclick = this.click(this.config.setPaintColorMode, this.config);
    this.toolSizes.forEach((button, i) => {
      button.onclick = this.click(() => this.config.setToolSize(i + 1), this.config);
    });
    this.allColorButtons.forEach((button, i) => {
      button.onmousedown = (ev) => this.handleSetColor(ev, i);
    });

    let {radius, numStates, groundState, cellRadius, cellGap, colors} = this.config;
    this.model = Hexular({radius, numStates, groundState, cellRadius});
    this.bgAdapter = new CanvasAdapter({model: this.model, board: this, context: this.bgCtx, cellGap, colors});
    this.adapter = new CanvasAdapter({model: this.model, board: this, context: this.mainCtx, cellGap, colors});
    this.fgAdapter = new CanvasAdapter({model: this.model, board: this, context: this.fgCtx, cellGap, colors});
    this.resetTransform();

    this.modals = {
      confirm: new ConfirmModal(this, 'confirm'),
      config: new ConfigModal(this, 'config'),
      theme: new ThemeModal(this, 'theme'),
      draw: new DrawModal(this, 'draw'),
      plugin: new PluginModal(this, 'plugin'),
      resize: new ResizeModal(this, 'resize'),
      srb: new SrbModal(this, 'srb'),
      trb: new TrbModal(this, 'trb'),
      custom: new CustomModal(this, 'custom'),
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
    [this.bgCtx, this.mainCtx, this.fgCtx].forEach(fn);
  }

  draw() {
    if (!this.drawPromise && this.adapter) {
      this.drawPromise = new Promise((resolve, reject) => {
        if (!this.running) {
          requestAnimationFrame(() => {
            try {
              this.drawPromise && this.drawSync();
              resolve();
            }
            catch (e) {
              reject(e);
            }
          });
        }
        else {
          resolve();
        }
      });
    }
    return this.drawPromise;
  }

  drawSync() {
    this.bgAdapter.clear();
    this.bgAdapter.drawBackground();
    this.adapter.context.lineCap = this.config.defaultCap;
    this.adapter.context.lineJoin = this.config.defaultJoin;
    this.config.clearOnDraw && this.adapter.clear();
    this.adapter.draw();
    this.altView && this.drawFg();
    this.recorder && this.recorder.draw();
    this.drawPromise = null;
  }

  // Button handlers (can also be called directly)

  toggleRecord() {
    if (!this.recorder) {
      if (!this.running)
        requestAnimationFrame(() => this.start());
      this.playStart = Date.now();
      this.disableWhenRecording.forEach((e) => e.disabled = true);
      this.buttons.toggleRecord.className = 'icon-stop active';
      this.setButtonTitle(this.buttons.toggleRecord, 'Stop');
      this.config.setRecordingMode(true);
      this.drawSync();
      this.recorder = new Recorder(this);
      this.recorder.start();
    }
    else {
      this.recorder.stop();
      this.recorder = null;
      requestAnimationFrame(() => {
        this.stop();
        this.draw();
      });
      if (!this.imageCapture)
        this.config.setRecordingMode(false);
      this.buttons.toggleRecord.className = 'icon-record';
      this.setButtonTitle(this.buttons.toggleRecord, 'Record');
      this.disableWhenRecording.forEach((e) => e.disabled = false);
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
      this.playLast = this.playStart = Date.now();
      this.playSteps = 0;
      this.timer = setInterval(() => {
        let cur = Date.now();
        let delta = cur - this.playLast;
        if (delta >= this.config.interval) {
          this.playLast = cur;
          this.playSteps ++;
          this.step();
        }
      }, 5);
      this.startMeta();
      this.buttons.step.disabled = true;
      this.buttons.togglePlay.className = 'icon-pause';
      this.setButtonTitle(this.buttons.togglePlay, 'Pause');
      this.runHooks('playStart');
    }
  }

  stop() {
    if (this.running) {
      if (this.recorder)
        this.toggleRecord();
      clearInterval(this.timer);
      this.timer = null;
      this.resetDrawStep();
      this.playStart = null;
      this.playLast = null;
      this.stopMeta();
      this.buttons.step.disabled = false;
      this.buttons.togglePlay.className = 'icon-play';
      this.setButtonTitle(this.buttons.togglePlay, 'Play');
      this.runHooks('playStop');
    }
  }

  startMeta() {
    let hooks = this.hooks.timer.slice();
    let sexFmt = (i) => ('00' + i).slice(-2);
    this.infoBoxes.cursor.classList.add('hidden');
    this.recorder && this.infoBoxes.timer.classList.add('recording');
    this.metaInterval = setInterval(() => {
      let deltaMs = Date.now() - this.playStart;
      let deltaSecs = Math.floor(deltaMs / 1000);
      let thirds = Math.floor((deltaMs % 1000) * 60 / 1000);
      let secs = deltaSecs % 60;
      let mins = Math.floor(deltaSecs / 60) % 60;
      let str = `${sexFmt(mins)}:${sexFmt(secs)}:${sexFmt(thirds)}`;
      this.setInfoBox('timer', str);
      while (hooks[0] && hooks[0].trigger <= deltaMs) {
        let hook = hooks.shift();
        hook.fn();
      }
    }, 10);
  }

  stopMeta() {
    clearInterval(this.metaInterval);
    this.metaInterval = null;
    this.setInfoBox('timer');
    this.infoBoxes.cursor.classList.remove('hidden');
    this.infoBoxes.timer.classList.remove('recording');
  }

  async step() {
    try {
      this.drawStep = (this.drawStep + 1) % this.config.drawStepInterval;
      if (this.config.drawStepInterval > 1) {
        this.drawStepQ = this.drawStep / this.config.drawStepInterval;
        this.drawStepQInc = this.drawStep / (this.config.drawStepInterval - 1 || 1);
      }
      else {
        this.drawStepQ = this.drawStepQInc = 1;
      }
      if (!this.drawStep) {
        this.newHistoryState();
        this.model.step();
        this.storeModelState();
        if (!this.model.changed && this.config.autopause) {
          this.stop();
          this.undo(true);
        }
        else {
          this.config.setSteps(this.config.steps + 1);
          this.running
            ? this.runHooks('playStep')
            : this.runHooks('incrementStep');
          this.runHooks('step');
          this.debugSelected && this.runHooks('debugStep', this.debugSelected);
        }
      }
      this.drawSync();
      this.runHooks('drawStep');
      // Reset cell order in case sorting has been applied
      this.model.sortCells();
    }
    catch (e) {
      console.error(e);
      this.setMessage(e, 'error');
      if (this.running)
        this.stop();
    }

  }

  clear() {
    this.newHistoryState();
    this.model.clear();
    this.resetDrawStep();
    this.adapter.clear();
    this.draw();
    this.storeModelState();
    this.config.setSteps(0);
    this.runHooks('clear');
  }

  clearFg() {
    this.fgAdapter.clear();
    this.runHooks('drawFg');
  }

  createHook(key, obj, opts={}) {
    this.hooks[key] = this.hooks[key] || [];
    let fn = obj.fn || obj;
    obj = {...opts, key, fn, id: this.hookCounter++};
    this.hookMap[obj.id] = obj;
    return obj;
  }

  addHook(key, obj, idx, opts={}) {
    obj = this.createHook(key, obj, opts);
    idx = idx != null ? idx : this.hooks[key].length;
    this.hooks[key].splice(idx, 0, obj);
    return obj.id;
  }

  // This is ridiculous
  addTrigger(key, obj, trigger) {
    obj = this.createHook(key, obj, {trigger});
    this.hooks[key].push(obj);
    this.hooks[key].sort((a, b) => a.trigger - b.trigger);
    return obj.id;
  }

  removeHook(...args) {
    if (args.length == 2 && typeof args[1] == 'function') {
      let [hook, fn] = args;
      let idx = this.hooks[hook].findIndex((e) => e.fn == fn);
      if (idx != -1)
        this.hooks[hook].splice(idx, 1);
    }
    else {
      let [id] = args;
      let obj = this.hookMap[id];
      if (obj)
        this.hooks[obj.key] = this.hooks[obj.key].filter((e) => e.id != id);
    }
  }

  clearHooks(key) {
    if (this.hooks[key])
      this.hooks[key] = [];
  }

  runHooks(hook, ...args) {
    let fns = this.hooks[hook] || [];
    fns.forEach((e) => e.fn(...args));
  }

  runHooksAsync(hook, ...args) {
    if (!this.hookQueue.has(hook)) {
      this.hookQueue.add(hook);
      window.requestAnimationFrame(() => {
        this.hookQueue.delete(hook);
        this.runHooks(hook, ...args);
      });
    }
  }

  runHooksParallel(hook, argArray, ...args) {
    let fns = this.hooks[hook] || [];
    for (let i = 0; i < fns.length; i++) {
      for (let j = 0; j < argArray.length; j++) {
        fns[i].fn(argArray[j], ...args);
      }
    }
  }

  toggleAltView(state=!this.altView) {
    this.altView = state;
    this.selectCell();
  }

  toggleMenu(state=!this.configMenu) {
    this.configMenu = state;
    this.buttons.toggleMenu.classList.toggle('active', state);
    this.menus.config.classList.toggle('hidden', !state);
    if (!state)
      this.altView = false;
  }

  toggleModal(modal) {
    let selected = this.modals[modal];
    let current = this.modal;
    Object.values(this.modals).forEach((e) => e.close());
    if (selected && current != selected) {
      this.toggleMenu(false);
      this.modals[modal].open();
      document.body.classList.add('modal-state');
    }
    else if (!selected) {
      this.fgCanvas.focus();
      document.body.classList.remove('modal-state');
    }
  }

  translateModal(coord) {
    if (!this.modalTranslate) {
      this.modalTranslate = coord;
    }
    else if (coord && this.modal) {
      let left = parseInt(this.modal.modal.style.left || 0);
      let top = parseInt(this.modal.modal.style.top || 0);
      this.modal.modal.style.left = `${left + coord[0] - this.modalTranslate[0]}px`;
      this.modal.modal.style.top = `${top + coord[1] - this.modalTranslate[1]}px`;
      this.modalTranslate = coord;
    }
    else {
      this.modalTranslate = null;
    }
  }

  showDoc() {
    window.open('doc/', '_blank');
  }

  toggleToolHidden() {
    let hidden = document.body.classList.toggle('tool-hidden');
    this.buttons.toolHider.classList.toggle('active');
    this.buttons.toolHider.classList.toggle('icon-eye');
    this.buttons.toolHider.classList.toggle('icon-eye-off');
    setTimeout(() => this.repositionElements(), 500);
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
    this.config.storeModel('snapshotModel', this.model.export());
    this.config.storeSessionState({snapshotSteps: this.config.steps});
    this.setMessage('Snapshot saved!');
  }

  loadSnapshot() {
    this.newHistoryState();
    let bytes = this.config.loadModel('snapshotModel');
    let steps = this.config.getSessionItem('snapshotSteps');
    if (bytes) {
      this.config.setSteps(steps);
      let cur = this.model.export();
      let diff = false;
      for (let i = 0; i < cur.length; i++)
        if (cur[i] != bytes[i]) {
          diff = true;
          break;
        }
      this.resetDrawStep();
      this.draw();
      if (diff) {
        this.model.import(bytes, this.config.importMask);
        this.storeModelState();
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

  toggleImageCapture() {
    if (!this.imageCapture) {
      this.imageCapture = [];
      this.config.setRecordingMode(true);
      this.draw();
      let fn = async (e) => {
        this.imageCapture.push([this.getImageFilename(), await this.saveImage()]);
      };
      // This shocks the conscience
      this.imageCapture.handle = this.addHook('drawStep', fn);
      // Capture current state
      fn();
      this.buttons.toggleImageCapture.classList.add('active');
    }
    else {
      if (!this.recorder)
        this.config.setRecordingMode(false);
      this.draw();
      this.removeHook(this.imageCapture.handle);
      this.processImageCaptures(this.imageCapture);
      this.imageCapture = null;

      this.buttons.toggleImageCapture.classList.remove('active');
    }
  }

  async processImageCaptures(captures) {
    if (captures.length < 0)
      return;
    let string2bytes = (str) => Uint8Array.from(str.split('').map((e) => e.charCodeAt(0)));
    let padString = (str, length) => (str + ' '.repeat(length)).slice(0, length);
    let segments = [string2bytes('!<arch>\n')];
    captures.forEach(([filename, dataUri]) => {
      // I have literally no idea what I'm doing
      let data = atob(dataUri.split(',')[1]);
      let length = data.length;
      if (data.length % 2 == 1) {
        data += '\n';
      }
      let bytes = Uint8Array.from(string2bytes(data));
      let header = padString(filename + '/', 16)
        + padString('0', 12)
        + padString('0', 6)
        + padString('0', 6)
        + padString('644', 8)
        + padString(bytes.length.toString(), 10)
        + '`\n';
      segments.push(string2bytes(header));
      segments.push(bytes);
    });
    let blob = new Blob(segments, {type: 'application/x-archive'});
    let dataUri = window.URL.createObjectURL(blob);
    this.promptDownload(this.config.defaultArchiveFilename, dataUri);
  }

  async saveImage() {
    let recordingMode = this.config.recordingMode;
    this.config.setRecordingMode(true);
    await this.draw();
    let transferCanvas = new TransferCanvas(this);
    this.config.setRecordingMode(recordingMode);
    await this.draw();
    return transferCanvas.canvas.toDataURL(`image/${this.config.imageFormat}`);
  }

  async promptSaveImage() {
    let dataUri = await this.saveImage();
    this.promptDownload(this.getImageFilename(), dataUri);
  }

  getImageFilename() {
    let padStep = ('0000' + this.config.steps).slice(-4);
    if (this.config.drawStepInterval > 1)
      padStep += '-' + ('00' + this.drawStep).slice(-2);
    return `${this.config.defaultImageFilenameBase}-${padStep}.${this.config.imageFormat}`;
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
      this.model.import(bytes, this.config.importMask);
      this.draw();
      this.storeModelState();
      this.setMessage('Model loaded!');
    };
    fileLoader.prompt();
  }

  saveData() {
    this.config.storeLocalConfig();
    this.config.storeSessionConfig();
    let obj = this.config.retrieveConfig();
    let dataUri = `data:application/json,${encodeURIComponent(JSON.stringify(obj, null, 2))}`;
    this.promptDownload(this.config.defaultSettingsFilename, dataUri);
  }

  loadData() {
    let fileLoader = new FileLoader('.json');
    fileLoader.onload = (result) => {
      try {
        let config = JSON.parse(result);
        this.config.restoreState(config);
        this.config.restorePlugins();
        this.config.storeLocalConfig();
        this.config.storeSessionConfig();
        Board.resize();
        this.setMessage('Settings restored!');
      }
      catch (e) {
        this.setMessage('Unable to parse settings file!', 'error');
        console.error(e);
      }
    };
    fileLoader.prompt();
  }

  import() {
    let fileLoader = new FileLoader('.js,.jpg,.jpeg,.gif,.png,.svg,.bmp', {multiple: true});
    fileLoader.onload = (result, name, type) => {
      try {
        if (type == 'text/javascript') {
          eval(result) // lol
          this.modals.config.update();
          this.setMessage('Custom code imorted!');
        }
        else { // Assume is image
          name = name.replace(/\.\w+/, '').replace(/\W+/g, '_').replace(/_+/, '_').replace(/^_?(.*?)_?$/, '$1');
          let media = new Media(name, result, type);
          let image = Media.getImage(name, (err) => {
            // This is offensive
            if (err) {
              this.setMessage(`Error loading image "${name}"!`, 'error');
              console.error(err);
            }
            else {
              this.setMessage(`Image "${name}" loaded!`);
            }
          });
        }
      }
      catch (e) {
        this.setMessage(e.toString(), 'error');
        console.error(e);
      }
    };
    // fileLoader.filter = (files) => {
    //   let result = files.map((file) => file.type.indexOf('javascript') >= 0);
    //   result.some((e) => !e) && this.setMessage('Not all selected files are JavaScript files', 'error');
    //   return result;
    // };
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
      this.resetDrawStep();
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
      this.resetDrawStep();
      this.refreshHistoryButtons();
    }
  }

  resetDrawStep() {
    this.drawStep = 0;
    this.drawStepQ = 0;
    this.drawStepQInc = 0;
  }

  resetTransform() {
    this.repositionElements();

    // Canvas stuff
    let logicalWidth = this.config.logicalWidth;
    let logicalHeight = this.config.logicalHeight;
    this.canvasWidth = window.innerWidth * this.config.pixelScaleFactor;
    this.canvasHeight = window.innerHeight * this.config.pixelScaleFactor;
    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1
    this.eachContext((ctx) => {
      let gco = ctx.globalCompositeOperation;
      ctx.canvas.width = this.canvasWidth;
      ctx.canvas.height = this.canvasHeight;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = gco;
    });
    this.scaleTo(this.config.zoom);
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
    this.clearFg();
    this.runHooks('center');
  }

  repositionElements() {
    // Config menu
    let x, y, height;
    ({x, y, height} = this.buttons.toggleMenu.getBoundingClientRect());
    this.menus.config.style.top = `${y + height}px`;
    this.menus.config.style.left = `${x}px`;
    // Message box
    ({y, height} = this.menus.top.getBoundingClientRect());
    this.messageWrapper.style.top = `calc(${y + height}px + 1rem)`;
  }

  refreshHistoryButtons() {
    this.buttons.undo.disabled = +!this.undoStack.length || this.recorder;
    this.buttons.redo.disabled = +!this.redoStack.length;
  }

  scaleRelative(scale) {
    this.scale *= scale;
    this.eachContext((ctx) => {
      ctx.scale(scale, scale);
    });
    this.draw();
    this.drawFg();
  }

  scaleTo(target, interval=0, step=50, timingFn) {
    if (this.scaling) {
      this.scaleQueue.push([target, interval, step, timingFn]);
      return;
    } else if (!interval) {
      this.scaleRelative(target / this.scale);
      return;
    }
    this.scaling = true;
    let diff = target - this.scale;
    let numSteps = Math.ceil(interval / step);
    timingFn = timingFn || this.defaultTimingFn;
    let steps = Array(numSteps).fill(null).map((_, idx) => timingFn(idx, numSteps));
    steps = steps.map((e, i) => (steps[i + 1] || 1) - e);
    let fn = (increment) => {
      if (steps.length) {
        let stepTarget = this.scale + diff * increment;
        this.scaleRelative(stepTarget / this.scale);
        setTimeout(() => fn(steps.pop()), step);
      }
      else {
        this.scaleRelative(target / this.scale);
        this.scaling = false;
        if (this.scaleQueue.length) {
          this.scaleTo(...this.scaleQueue.shift());
        }
      }
    };
    setTimeout(() => fn(steps.pop()), step);
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
    x /= this.scale;
    y /= this.scale;
    this.eachContext((ctx) => {
      ctx.translate(x, y);
    });
    this.draw();
  }

  updateColorButtons() {
    this.colorButtons = [];
    for (let i = 0; i < this.allColorButtons.length; i++) {
      let colorButton = this.allColorButtons[i];
      if (i < this.config.maxNumStates) {
        this.colorButtons.push(colorButton);
        colorButton.classList.remove('hidden');
      }
      else {
        colorButton.classList.add('hidden');
      }
    }
  }

  // Page/canvas listeners

  handleClearStorage() {
    let msg = 'Clear all data, including rules, presets, and themes, or only session data from the current tab?'
    this.modals.confirm.ask(msg, {'Cancel': 0, 'Session data': 1, 'All data': 2})
    .then((e) => {
      if (e) {
        this.config.clearStorage(!!e, e == 2);
        Board.resize();
        Board.instance.setMessage(`${e == 2 ? 'Local' : 'Session'} settings cleared!`);
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
    this.config.blurTool && this.config.setTool(this.config.blurTool);
  }

  handleWheel(ev) {
    let textTags = ['textarea', 'input'];
    let focus = document.activeElement;
    if (focus && textTags.indexOf(focus.tagName.toLowerCase()) != -1) {
      if (focus.type =='range' && focus == ev.target) {
        let min = focus.min || -Infinity;
        let max = focus.max || Infinity;
        let step = focus.step || 1;
        let dir = -Math.sign(ev.deltaY);
        focus.value = Math.max(min, Math.min(max, parseFloat(focus.value) + step * dir));
        focus.dispatchEvent(new Event('input'));
      }
    }
    else if (ev.target == this.fgCanvas) {
      let scale = 1 - Math.sign(ev.deltaY) * 0.1;
      this.scaleRelative(scale);
      this.draw();
    }
  }

  handleContextmenu(ev) {
    if (ev.target == this.fgCanvas || this.colorButtons.includes(ev.target))
      ev.preventDefault();
  }

  handleKey(ev) {
    let key = ev.key.toLowerCase();

    // Modal-specific stuff
    if (this.modal && ev.type == 'keydown') {
      let isInput = ['TEXTAREA', 'INPUT'].includes(ev.target.tagName);
      if (ev.key == 'Escape') {
        this.toggleModal();
        ev.preventDefault();
        return;
      }
      else if (!ev.repeat && ev.ctrlKey) {
        if (key == 'a') {
          if (isInput) {
            return;
          }
          else {
            if (this.modal == this.modals.config) {
              this.modals.config._handleCheckAll();
            }
            else if (this.modal == this.modals.srb || this.modal == this.modals.trb) {
              this.modals.srb._handleCheckAll();
            }
            else if (this.modal == this.modals.custom && document.activeElement == this.modals.custom.input) {
              this.modals.custom.input.select();
            }
          }
        }
      }
      let ctrlSkip = ['c', 'x', 'v', 'z'].includes(key);
      if (ctrlSkip || !ev.ctrlKey && isInput) {
        return;
      }
    }

    // Board things
    if (ev.key == 'Alt' || ev.key == 'Meta') {
      if (ev.type == 'keydown') {
        this.toggleAltView(true);
      }
      else if (ev.type == 'keyup') {
        this.toggleAltView(false);
      }
    }
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
        else if (!ev.shiftKey && !ev.altKey) {
          if (key == 's') {
            this.save();
          }
          else if (key == 'o') {
            this.load();
          }
          else if (key == 'b') {
            this.toggleModal('srb');
          }
          else if (key == 'c') {
            this.clear();
          }
          else if (key == 'd') {
            this.toggleModal('draw');
          }
          else if (key == 'e') {
            this.toggleModal('theme');
          }
          else if (key == 'f') {
            this.toggleModal('custom');
          }
          else if (key == 'i') {
            this.toggleImageCapture();
          }
          else if (key == 'g') {
            this.toggleModal('config');
          }
          else if (key == 'h') {
            this.toggleModal('trb');
          }
          else if (key == 'r') {
            this.toggleModal('resize');
          }
          else if (key == 'y') {
            this.toggleModal('plugin');
          }
          else if (key == 'x') {
            this.handleClearStorage();
          }
          else if (key == 'a') {
            // preventDefault
          }
          else {
            return;
          }
        }
        else if (ev.shiftKey) {
          if (key == 's') {
            this.promptSaveImage();
          }
          else {
            return;
          }
        }
        else if (ev.altKey) {
          if (key == 'c') {
            // Secret shortcut
            this.clear();
            this.autodot();
          }
          if (key == 's') {
            this.saveData();
          }
          else if (key == 'o') {
            this.loadData();
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
        this.toggleToolHidden();
        this.toggleMenu(false);
      }

      // TAB to start/stop
      else if (ev.key == 'Tab' && !this.modal) {
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
      else if (key == 'g') {
        this.config.setTool('fill');
      }
      else if (key == 'b') {
        this.config.setTool('brush');
      }
      else if (key == 'f') {
        this.config.setTool('hexfilled');
      }
      else if (key == 'h') {
        this.config.setTool('hexoutline');
      }
      else if (key == 'l') {
        this.config.setTool('line');
      }
      else if (key == '/') {
        this.config.setTool('lockline');
      }
      else if (key == 'm') {
        this.config.setTool('move');
      }
      else if (key == 'n') {
        this.config.setTool('none');
      }
      else if (key == '1') {
        this.config.setToolSize(1);
      }
      else if (key == '2') {
        this.config.setToolSize(2);
      }
      else if (key == '3') {
        this.config.setToolSize(3);
      }
      else if (key == 'r') {
        this.resetTransform();
      }
      else if (key == 'c') {
        this.config.setPaintColorMode();
      }
      else if (key == 'q') {
        this.saveSnapshot();
      }
      else if (key == 'a') {
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
      // Close config menu if applicable;
      if (this.configMenu) {
        let target =  ev.target;
        while (target != this.buttons.toggleMenu && target.parentNode && (target = target.parentNode));
        if (target != this.buttons.toggleMenu) {
          this.toggleMenu(false);
        }
      }
      if (this.altView) {
        this.toggleAltView(false);
      }
      if (ev.target == this.fgCanvas) {
        if (this.modal) {
          this.toggleModal();
        }
        if (this.selected && !this.action) {
          if (ev.buttons & 1) {
            this.startAction(ev);
          }
          else if (ev.buttons & 2) {
            let setState = this.config.getPaintColor(1);
            this.startAction(ev, {setState});
          }
          else if ((ev.buttons & 4) && this.selected) {
            this.debugSelect();
          }
        }
      }
      this.clickTarget = ev.target;
    }
    else if (ev.type == 'mouseup') {
      if (this.action)
        this.endAction(ev);
      else if (this.modalTranslate) {
        this.translateModal();
      }
      else if (this.clickTarget == ev.target) {
        if (ev.target == this.message) {
          this.clearMessage()
        }
        this.clickTarget = null;
      }
    }
    else if (ev.type == 'mousemove') {
      let cell;
      if (ev.target == this.fgCanvas && !this.modal) {
        this.selectCell([ev.pageX, ev.pageY]);
        this.moveAction(ev);
      }
      else if (this.modalTranslate) {
        this.translateModal([ev.pageX, ev.pageY]);
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
    // Close config menu if applicable;
    if (this.configMenu && ev.target != this.buttons.toggleMenu) {
      setTimeout(() => this.toggleMenu(false), 500);
    }

    if (ev.target == this.fgCanvas) {
      if (this.modal) {
        this.toggleModal();
      }
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

  autodot() {
    let oldSelected = this.selected;
    this.selected = this.model.cells[0];
    let action = new BrushAction(this);
    action.start();
    action.end();
    this.selected = oldSelected;
  }

  // Cell selection and setting

  selectCell(coord) {
    let lastCell = this.selected;
    this.selected = coord && this.cellAt(coord);
    this.drawFg();
    if (lastCell != this.selected)
      this.runHooks('select', this.selected);
  }

  drawFg() {
    let cell = this.selected;
    if (!this.action) {
      this.clearFg();
      if (this.altView) {
        this.fgAdapter.drawBackground();
        this.fgAdapter.drawDefaultCells();
      }
      else if (cell) {
        let color = this.config.selectColor;
        let width = this.config.selectWidth;
        width = (width + width / this.scale) / 2;
        let size = this.sizableTools.includes(this.config.tool) ? this.config.toolSize : 1;
        let opts = {stroke: true, lineWidth: width, strokeStyle: color};
        let radius = this.config.cellRadius;
        if (size == 1) {
          opts.type = Hexular.enums.TYPE_POINTY;
        }
        else {
          opts.type = Hexular.enums.TYPE_FLAT;
          radius = radius * (size * 2 - 1) * Hexular.math.apothem;
        }
        this.fgAdapter.drawShape(cell, radius, opts);
      }
    }
  }

  cellAt([x, y]) {
    [x, y] = this.windowToModel([x, y]);
    return this.model.cellAt([x, y]);
  }

  debugSelect() {
    let cell = this.selected;
      this.debugSelected = window.cell = cell;
    if (cell) {
      this.setMessage(`Cell at ${cell}: ${cell.state}`);
      this.runHooks('debugSelect', cell);
    }
  }

  // TODO: Use Hexular.math.matrixMult
  windowToModel([x, y]) {
    x -= this.translateX;
    y -= this.translateY;
    x -= this.offsetX;
    x -= this.offsetY;
    x = x / this.scale;
    y = y / this.scale;
    return [x, y];
  }

  modelToWindow([x, y]) {
    x = x * this.scale;
    y = y * this.scale;
    x += this.offsetX;
    y += this.offsetY;
    x += this.translateX;
    y += this.translateY;
    return [x, y];
  }

  defaultTimingFn(i, n) {
    let t = i / n;
    let s = t * t;
    return s / (2 * (s - t) + 1);
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
Board.plugins = {};
