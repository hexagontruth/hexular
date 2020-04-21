class MidiOut extends Plugin {
  defaultSettings() {
    return `
      {
        origin: 0x3c,
        velocity: 0x7f,
        noteLength: 250,
        uStep: 4,
        vStep: 7,
        playWhitelist: null,
        playBlacklist: [0],
        showGuides: true,
        showLabels: true,
        deviceIndex: 0,
      }
    `;
  }

  _onSaveSettings() {
    // This is somewhat more inefficient than it strictly has to be
    this.notemap = new Map();
    let origin = this.settings.origin;
    let maxDist = origin > 127 ? 127 - origin : origin;
    let minDist = 127 - maxDist;
    let uStep = this.settings.uStep;
    let vStep = this.settings.vStep;
    let uRange = Math.abs(Math.floor(minDist / uStep));
    let vRange = Math.abs(Math.floor(minDist / vStep));
    let radius = Math.min(uRange, vRange);
    let cells = Hexular.util.hexWrap(this.model.cells[0], radius);
    console.log(uRange, vRange, cells.length);
    for (let cell of cells) {
      let [u, v, w] = cell.coord;
      let note = origin + u * uStep + v * vStep;
      if (note >= 0 && note <= 127) {
        this.notemap.set(cell, note);
      }
    }
  }

  _activate() {
    if (!navigator.requestMIDIAccess)
      throw new Hexular.classes.HexError('No MIDI support! Lame!');
    if (!(this.model instanceof Hexular.classes.models.CubicModel))
      throw new Hexular.classes.HexError('MidiOut plugin requires cubic model!');
    this.test = navigator.requestMIDIAccess().then((e) => {
      this.midiAccess = e;
      this.inputs = e.inputs;
      this.outputs = e.outputs;
      this.device = Array.from(e.outputs.entries())[this.settings.deviceIndex];
      if (!this.device)
        throw new Hexular.classes.HexError(`No device at index ${this.settings.deviceIndex}!`);
    });
    this.playlist = [];
    this.timer = null;
    this.start = () => {
      for (let note of this.playlist)
        this.device.send(0x90, note, this.settings.velocity);
    }
    this.stop = () => {
      for (let note of this.playlist)
        this.device.send(0x80, note, this.settings.velocity);
    }
    this.drawFn = (adapter) => {
      this.timer && clearTimeout(this.timer);
      this.timer = setTimeout(() => this.stop(), this.settings.noteLength);

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
