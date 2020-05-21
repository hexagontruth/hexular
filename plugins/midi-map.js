 class MidiMap extends Plugin {
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
        defaultInterval: 500,
        stopPrevious: false,
        homeCell: [0, 0, 0],
        homeNote: 0x3c,
        channelsIn: {
          // (vel, note, cell) => state
          1: (v, n, c) => 1,
        },
        channelsOut: {
          // (state, note, cell) => vel || [vel, interval]
          1: (s, n, c) => s == 1 ? 0x3f : 0,
        },
        uStride: 4,
        vStride: 7,
        range: [0, 128],
        showNoteInfo: true,
        showFrames: true,
        constrainFrameToHex: true,
        deviceInIndex: null,
        deviceOutIndex: 0,
      }
    `;
  }

  _onSaveSettings() {
    this.noteCellMap = new Map();
    this.cellNoteMap = new Map();
    this.playlists = {};
    this.players = new Set();
    this.stuckCells = new Map();
    this.inFn = {};
    this.outFn = {};
    Object.entries(this.settings.channelsIn).forEach(([k, v]) => this.inFn[parseInt(k) - 1] = v);
    Object.entries(this.settings.channelsOut).forEach(([k, v]) => this.outFn[parseInt(k) - 1] = v);
    this.channelsIn = Object.keys(this.inFn).map((e) => parseInt(e));
    this.channelsOut = Object.keys(this.outFn).map((e) => parseInt(e));
    let home = this.settings.homeNote;
    let [floor, ceil] = this.settings.range;
    let relHome = home - floor;
    let relRange = ceil - floor;
    let relMid = Math.floor(relRange / 2);
    let minDist = relHome > relMid ? ceil - home : relHome;
    let maxDist = relRange - minDist;
    let dist, minmaxFn;
    if (this.settings.constrainFrameToHex) {
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
        // Each cell has one note
        this.cellNoteMap.set(cell, note);
        // But each note potentially has more than one cell
        let noteCells = this.noteCellMap.get(note) || [];
        this.noteCellMap.set(note, noteCells);
        noteCells.push(cell);
      }
    }
    this.cells = Array.from(this.cellNoteMap.keys());
    this.notes = Array.from(new Set(this.noteCellMap.keys()));
    this.notes.sort();
    this.channelsOut.forEach((channel) => {
      let notelist = {};
      this.playlists[channel] = notelist;
      this.notes.forEach((note) => notelist[note] = []);
    });
    this.setDevices();
    this.board.clearFg();
  }

  _activate() {
    this.registerHook('clear', () => this.killAll());
    this.registerHook('step', () => this.onStep());
    this.registerHook('drawFg', () => this.onDrawFg());
    this.registerHook('paint', (cells) => this.onPaint(cells));
    this.registerHook('select', (cell) => this.onSelect(cell));
    this.registerHook('debugSelect', (cell) => this.onDebugSelect(cell));
  }

  _enable() {
    this._onSaveSettings();
    this.board.hooks.midiMessage = this.board.hooks.midiMessage || [];
  }

  _disable() {
    this.unsetDevices();
    if (!this.board.action)
      this.board.setInfoBox('tool', '');
    this.board.clearFg();
  }

  setDevices() {
    this.unsetDevices();
    this.noteLabels = MidiMap.getNoteLabels();
    if (!navigator.requestMIDIAccess)
      throw new Hexular.HexError('No MIDI support! Lame!');
    if (!(this.model instanceof Hexular.CubicModel))
      throw new Hexular.HexError('MidiMap plugin requires cubic model!');
    navigator.requestMIDIAccess().then((e) => {
      this.midiAccess = e;
      this.inputs = Array.from(e.inputs);
      this.outputs = Array.from(e.outputs);
      let deviceInEntry = this.inputs[this.settings.deviceInIndex];
      let deviceOutEntry = this.outputs[this.settings.deviceOutIndex];
      this.in = deviceInEntry && deviceInEntry[1];
      this.out = deviceOutEntry && deviceOutEntry[1];
      if (this.in)
        this.in.onmidimessage = (msg) => this.handleMessage(msg);
    });
  }

  unsetDevices() {
    this.killAll();
    if (this.in) {
      this.in.onmidimessage = null;
      this.in.close();
      this.in = null;
    }
    if (this.out) {
      this.out.onmidimessage = null;
      this.out.close();
      this.out = null;
    }
    this.midiAccess = this.inputs = this.outputs = null;
  }

  onStep(adapter) {
    if (!this.out)
      return;
    this.stuckCells.forEach((state, cell) => cell.state = state);
    // Stop existing notes if stopPrevious enabled
    this.settings.stopPrevious && this.players.forEach((e) => e.stop());
    // Start new players
    this.startCells(this.cells.filter((e) => !this.stuckCells.has(e)));
  }

  onPaint(cells) {
    this.startCells(cells.filter((e) => this.cells.includes(e)));
  }

  onDrawFg() {
    if (this.settings.showFrames) {
      let opts = {
        stroke: true,
        strokeStyle: this.config.selectColor,
        lineWidth: this.config.selectWidth,
      };
      if (this.settings.constrainFrameToHex) {
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

  killAll() {
    // TODO: Is this working?
    if (!this.out)
      return;
    this.players.forEach((player) => player.stop());
    for (let channel of this.channelsOut) {
      this.notes.forEach((note) => this.out.send([0x90 + channel, note, 0]));
    }
  }

  startNote(player) {
    if (!this.out)
      return;
    this.players.add(player);
    let {channel, note, vel} = player;
    let list = this.playlists[channel][note];
    list.push(player);
    this.out.send([0x90 + channel, note, vel]);
  }

  stopNote(player) {
    this.players.delete(player);
    if (!this.out)
      return;
    let {channel, note} = player;
    let list = this.playlists[channel][note];
    let idx = list.indexOf(player);
    if (idx != -1) {
      let player = list.splice(idx, 1);
      let nextPlayer = list.slice(-1)[0];
      let nextVel = nextPlayer ? nextPlayer.vel : 0;
      this.out.send([0x90 + channel, note, nextVel]);
    }
  }

  startCells(cells) {
    cells.forEach((cell) => this.startCell(cell));
  }

  startCell(cell, stuck=false) {
    let note = this.cellNoteMap.get(cell);
    this.channelsOut.forEach((channel) => {
      let value = this.outFn[channel](cell.state, note, cell);
      let [vel, interval] = value.length ? value : [value, this.settings.defaultInterval];
      vel && new MidiPlayer(this, channel, note, vel, stuck ? null : interval);
      stuck && this.stuckCells.set(cell, cell.state);
    });
  }

  handleMessage(msg) {
    let [cmd, note, vel] = msg.data;
    if (cmd >= 0x80 && cmd < 0xa0) {
      let cmdChan = 0x80 ^ cmd;
      let cells = this.noteCellMap.get(note) || [];
      for (let cell of cells) {
        if (cmdChan < 16 || !vel) {
          this.stuckCells.delete(cell);
          let player = Array.from(this.players).find((e) => !e.interval);
          player && player.stop();

        }
        else if (this.inFn[cmdChan - 16]){
          let state = this.inFn[cmdChan - 16](vel, note, cell);
          if (state !== undefined) {
            cell.setState(state);
            this.startCell(cell, true);
            this.board.draw();
          }
        }
      }
    }
    this.board.runHooks('midiMessage', msg);
  }
}
Board.registerPlugin(MidiMap);

class MidiPlayer {
  constructor(plugin, channel, note, vel, interval) {
    this.plugin = plugin;
    this.channel = channel;
    this.note = note;
    this.vel = vel;
    this.interval = interval;
    this.active = true;
    this.plugin.startNote(this);
    this.timer = this.interval && window.setTimeout(() => this.stop(), this.interval);
  }

  stop() {
    clearInterval(this.timer);
    this.plugin.stopNote(this);
  }
}
