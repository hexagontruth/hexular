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
        interval: 250,
        stopPrevious: true,
        origin: 0x3c,
        channelStateMap: {
          0: [1],
        },
        uStride: 4,
        vStride: 7,
        range: [0, 128],
        isotropicFrame: true,
        showNoteInfo: true,
        showFrames: true,
        deviceIndex: 0,
      }
    `;
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
    cells.forEach((cell) => {
      let channels = this.stateChannelMap[cell.state] || [];
      channels.forEach((e) => players[e].add(cell));
    });
    // Start new players
    Object.values(players).forEach((e) => e.start());
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
    let origin = this.settings.origin;
    let [floor, ceil] = this.settings.range;
    let relOrigin = origin - floor;
    let relRange = ceil - floor;
    let relMid = Math.floor(relRange / 2);
    let minDist = relOrigin > relMid ? ceil - origin : relOrigin;
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
    let cells = Hexular.util.hexWrap(this.model.cells[0], radius);
    this.originCell = cells[0];
    // Assign cells from outside in so overflow cells keep innermost assignment
    cells.reverse();
    for (let cell of cells) {
      let [u, v, w] = cell.coord;
      let note = origin + u * uStride + v * vStride;
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
    this.stepFn = (adapter) => {
      if (!this.device)
        return;
      // Stop existing notes if stopPrevious enabled
      this.settings.stopPrevious && this.players.forEach((e) => e.stop());
      // Create new step players
      this.setCells(this.cells);
    };
    this.paintFn = (cells) => {
      this.setCells(cells);
    };
    this.frameFn = () => {
      if (this.settings.showFrames) {
        let opts = {
          stroke: true,
          strokeStyle: this.config.selectColor,
          lineWidth: this.config.selectWidth,
        };
        if (this.settings.isotropicFrame) {
          opts.type = Hexular.enums.TYPE_FLAT;
          let radius = this.radius * this.config.cellRadius * Hexular.math.apothem * 2;
          this.board.fgAdapter.drawHexagon([0, 0], radius, opts);
        }
        else {
          opts.type = Hexular.enums.TYPE_POINTY;
          this.cells.forEach((cell) => {
            this.board.fgAdapter.drawHexagon(cell, this.config.cellRadius, opts);
          });
        }
      }
    }
    this.infoFn = (cell) => {
      if (this.board.action || !this.settings.showNoteInfo)
        return;
      let note = this.cellNoteMap.get(cell);
      this.board.setInfoBox('tool', note ? this.noteLabels[note] : '');
    }
    this.debugFn = (cell) => {
      if (this.cells.includes(cell))
        console.log(`Cell ${cell}: ${this.cellNoteMap.get(cell)}`);
    }
    this._onSaveSettings();
    this.registerBoardHook('step', this.stepFn);
    this.registerBoardHook('paint', this.paintFn);
    this.registerBoardHook('drawFg', this.frameFn);
    this.registerBoardHook('select', this.infoFn);
    this.registerBoardHook('debugSelect', this.debugFn);
  }

  _deactivate() {
    this.device && this.device.close();
    if (!this.board.action)
      this.board.setInfoBox('tool', '');
  }
};
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
