class MidiOut extends Plugin {
  defaultSettings() {
    return `
      {
        origin: 0x3c,
        velocity: 0x7f,
        noteLength: 250,
        stopOnStep: true,
        uStride: 4,
        vStride: 7,
        channelStateMap: {
          0: [1],
        },
        showGuides: true,
        showLabels: true,
        deviceIndex: 0,
      }
    `;
  }

  activateCell(cell, channel=0) {
    let cur = this.playlists[channel].get(cell);
    let next = 1;
    if (cur) 
      next = cur + 1;
    else {
      let note = this.notemap.get(cell);
      this.device.send(0x90 + parseInt(channel), note, this.settings.velocity);
    }
    this.playlists[channel].set(cell, cur ? cur + 1 : 1);
  }

  deactivateCell(cell, channel=0) {
    let cur = this.playlists[channel].get(cell);
    if (!cur || cur <= 1) {
      this.playlist.delete(cell);
      let note = this.notemap.get(cell);
      this.device.send(0x80 + parseInt(channel), note, this.settings.velocity);
    }
    else {
      this.playlists[channel].set(cell, cur - 1);
    }
    return cur;
  }

  _onSaveSettings() {
    this.notemap = new Map();
    this.playlists = {};
    this.players = new Set();
    this.channels = Object.keys(this.settings.channelStateMap);
    this.stateChannelMap = Array(this.config.maxNumStates).fill().map(() => []);
    Object.entries(this.settings.channelStateMap).forEach(([channel, states]) => {
      this.playlists[channel] = new Set();
      states.forEach((e) => {
        this.stateChannelMap[e].push(channel);
      });
    });
    this.channelSteps = new Set();
    let origin = this.settings.origin;
    let maxDist = origin > 127 ? 127 - origin : origin;
    let minDist = 127 - maxDist;
    let uStride = this.settings.uStride;
    let vStride = this.settings.vStride;
    let uRange = Math.abs(Math.floor(minDist / uStride));
    let vRange = Math.abs(Math.floor(minDist / vStride));
    let radius = Math.min(uRange, vRange);
    let cells = Hexular.util.hexWrap(this.model.cells[0], radius);
    console.log(uRange, vRange, cells.length);
    for (let cell of cells) {
      let [u, v, w] = cell.coord;
      let note = origin + u * uStride + v * vStride;
      if (note >= 0 && note <= 127) {
        this.notemap.set(cell, note);
      }
    }
    this.cells = Array.from(this.notemap.keys());
  }

  _activate() {
    if (!navigator.requestMIDIAccess)
      throw new Hexular.classes.HexError('No MIDI support! Lame!');
    if (!(this.model instanceof Hexular.classes.models.CubicModel))
      throw new Hexular.classes.HexError('MidiOut plugin requires cubic model!');
    navigator.requestMIDIAccess().then((e) => {
      this.midiAccess = e;
      this.inputs = e.inputs;
      this.outputs = e.outputs;
      this.device = Array.from(e.outputs.entries())[this.settings.deviceIndex];
      if (!this.device)
        throw new Hexular.classes.HexError(`No device at index ${this.settings.deviceIndex}!`);
    });
    this.drawFn = (adapter) => {
      // Stop existing notes if stopOnStep enabled
      this.settings.stopOnStep && this.players.forEach((e) => e.stop());
      // Create new step players
      let players = {};
      this.channels.forEach((e) => players[e] = new MidiStepPlayer(this, e));
      // Add cell to channels - each state can activate more than one channel
      this.cells.forEach((cell) => {
        let channels = this.stateChannelMap[cell.state];
        channels.forEach((e) => players[e].add(cell));
      });
      // Start new players
      Object.values(players).forEach((e) => e.start());
    };
    this.paintFn = (cells) => {
      cells.forEach((e) => console.log(e.coord, this.notemap.get(e)));
    };
    this._onSaveSettings();
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
    this.registerBoardHook('paint', this.paintFn);
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
