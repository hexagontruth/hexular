 class MidiOut extends Plugin {
  static getNoteLabels() {
    let labels = {};
    let scale = 'C#D#EF#G#A#B'.split('').map((e, i, a) => (e == '#' ? a[i - 1] : '') + e);
    return Array(128).fill().map((_, i) => {
      let note = scale[i % 12];
      let octave = Math.floor(i / 12);
      return note + octave;
    });
  }

  defaultSettings() {
    return `
      {
        velocity: 0x3f,
        interval: 500,
        stopPrevious: false,
        homeCell: [0, 0, 0],
        homeNote: 0x3c,
        channelStateMap: {
          0: [1],
        },
        uStride: 4,
        vStride: 7,
        range: [0, 128],
        filterFn: (cell, note) => true,
        isotropicFrame: true,
        showNoteInfo: true,
        showFrames: true,
        deviceIndex: 0,
      }
    `;
  }

  _onSaveSettings() {
    this.cellNoteMap = new Map();
    this.playlists = {};
    this.players = new Set();
    this.channels = Object.keys(this.settings.channelStateMap);
    this.stateChannelMap = Array(this.config.maxNumStates).fill().map(() => []);
    Object.entries(this.settings.channelStateMap).forEach(([channel, states]) => {
      this.playlists[channel] = new Map();
      states.forEach((e) => {
        this.stateChannelMap[e].push(channel);
      });
    });
    this.channelSteps = new Set();
    let home = this.settings.homeNote;
    let [floor, ceil] = this.settings.range;
    let relHome = home - floor;
    let relRange = ceil - floor;
    let relMid = Math.floor(relRange / 2);
    let minDist = relHome > relMid ? ceil - home : relHome;
    let maxDist = relRange - minDist;
    let dist, minmaxFn;
    if (this.settings.isotropicFrame) {
      dist = minDist;
      minmaxFn = Math.min;
    }
    else {
      dist = maxDist;
      minmaxFn = Math.max;
    }
    let uStride = this.settings.uStride;
    let vStride = this.settings.vStride;
    let uwRange = Math.abs(Math.floor(dist / uStride));
    let vwRange = Math.abs(Math.floor(dist / vStride));
    let uvRange = Math.abs(Math.floor(dist / (uStride - vStride)));
    let radius = this.radius = minmaxFn(uwRange, vwRange, uvRange) + 1;
    this.homeCell = this.model.cellAtCubic(this.settings.homeCell) || this.model.cells[0];
    let cells = Hexular.util.hexWrap(this.homeCell, radius);
    // Assign cells from outside in so overflow cells keep innermost assignment
    cells.reverse();
    for (let cell of cells) {
      let [u, v, w] = cell.coord.map((e, i) => e - this.homeCell.coord[i]);
      let note = home + u * uStride + v * vStride;
      if (note >= floor && note < ceil) {
        this.cellNoteMap.set(cell, note);
      }
    }
    this.cells = Array.from(this.cellNoteMap.keys());
    this.board.clearFg();
  }

  _activate() {
    this.noteLabels = MidiOut.getNoteLabels();
    if (!navigator.requestMIDIAccess)
      throw new Hexular.classes.HexError('No MIDI support! Lame!');
    if (!(this.model instanceof Hexular.classes.models.CubicModel))
      throw new Hexular.classes.HexError('MidiOut plugin requires cubic model!');
    navigator.requestMIDIAccess().then((e) => {
      this.midiAccess = e;
      this.inputs = e.inputs;
      this.outputs = e.outputs;
      let deviceEntry = Array.from(e.outputs.entries())[this.settings.deviceIndex];
      if (!deviceEntry)
        throw new Hexular.classes.HexError(`No device at index ${this.settings.deviceIndex}!`);
      this.device = deviceEntry[1];
    });
    this._onSaveSettings();
    this.registerBoardHook('step', () => this.onStep());
    this.registerBoardHook('drawFg', () => this.onDrawFg());
    this.registerBoardHook('paint', (cells) => this.onPaint(cells));
    this.registerBoardHook('select', (cell) => this.onSelect(cell));
    this.registerBoardHook('debugSelect', (cell) => this.onDebugSelect(cell));
  }

  _deactivate() {
    this.device && this.device.close();
    if (!this.board.action)
      this.board.setInfoBox('tool', '');
  }

  onStep(adapter) {
    if (!this.device)
      return;
    // Stop existing notes if stopPrevious enabled
    this.settings.stopPrevious && this.players.forEach((e) => e.stop());
    // Create new step players
    this.setCells(this.cells);
  }

  onPaint(cells) {
    this.setCells(cells);
  }

  onDrawFg() {
    if (this.settings.showFrames) {
      let opts = {
        stroke: true,
        strokeStyle: this.config.selectColor,
        lineWidth: this.config.selectWidth,
      };
      if (this.settings.isotropicFrame) {
        opts.type = Hexular.enums.TYPE_FLAT;
        let radius = this.radius * this.config.cellRadius * Hexular.math.apothem * 2;
        this.board.fgAdapter.drawHexagon(this.homeCell, radius, opts);
      }
      else {
        opts.type = Hexular.enums.TYPE_POINTY;
        this.cells.forEach((cell) => {
          this.board.fgAdapter.drawHexagon(cell, this.config.cellRadius, opts);
        });
      }
    }
  }

  onSelect(cell) {
    if (this.board.action || !this.settings.showNoteInfo)
      return;
    let note = this.cellNoteMap.get(cell);
    this.board.setInfoBox('tool', note ? this.noteLabels[note] : '');
  }

  onDebugSelect(cell) {
    if (this.cells.includes(cell))
      console.log(`Cell ${cell}: ${this.cellNoteMap.get(cell)}`);
  }

  activateCell(cell, channel=0) {
    if (!this.device)
      return;
    let cur = this.playlists[channel].get(cell);
    let next = 1;
    if (cur)
      next = cur + 1;
    else {
      let note = this.cellNoteMap.get(cell);
      this.device.send([0x90 + parseInt(channel), note, this.settings.velocity]);
    }
    this.playlists[channel].set(cell, cur ? cur + 1 : 1);
  }

  deactivateCell(cell, channel=0) {
    if (!this.device)
      return;
    let cur = this.playlists[channel].get(cell);
    if (!cur || cur <= 1) {
      this.playlists[channel].delete(cell);
      let note = this.cellNoteMap.get(cell);
      this.device.send([0x80 + parseInt(channel), note, this.settings.velocity]);
    }
    else {
      this.playlists[channel].set(cell, cur - 1);
    }
    return cur;
  }

  killAll() {
    if (!this.device)
      return;
    for (let channel of this.channels) {
      this.cellNoteMap.forEach((note) => this.device.send([0x80 + parseInt(channel), note, this.settings.velocity]));
    }
  }

  setCells(cells) {
    let players = {};
    this.channels.forEach((e) => players[e] = new MidiStepPlayer(this, e));
    // Add cell to channels - each state can activate more than one channel
    let fn = this.settings.filterFn;
    cells.filter((cell) => fn(cell, this.cellNoteMap.get(cell))).forEach((cell) => {
      let channels = this.stateChannelMap[cell.state] || [];
      channels.forEach((e) => players[e].add(cell));
    });
    // Start new players
    Object.values(players).forEach((e) => e.start());
  }
}
Board.registerPlugin(MidiOut);

class MidiStepPlayer {
  constructor(plugin, channel) {
    this.active = false;
    this.plugin = plugin;
    this.channel = channel;
    this.interval = this.plugin.settings.interval;
    this.cells = [];
    this.timer = null;
  }

  add(cell) {
    this.cells.push(cell);
  }

  start() {
    if (this.active)
      return;
    this.active = true;
    this.cells.forEach((e) => this.plugin.activateCell(e, this.channel));
    this.timer = setTimeout(() => this.stop(), this.interval);
    this.plugin.players.add(this);
  }

  stop() {
    this.activate = false;
    this.cells.forEach((e) => this.plugin.deactivateCell(e, this.channel));
    clearInterval(this.timer);
    this.plugin.players.delete(this);
  }
}
