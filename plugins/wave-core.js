class WaveCore extends Plugin {
  defaultSettings() {
    return `
      {
        // Requires custom drawing functionality provided by e.g. WaveDraw plugin
        c: (cell) => 0.5,
        decay: (cell) => 1,
        friction: (cell) => 1,
        initialState: (cell) => 0,
        initialV: (cell) => 0,
        initialA: (cell) => 0,
        beforeStep: (plugin) => {
          return; // Remove to enable
          let period = 60;
          let amp = 120;
          let add = false;
          let step = plugin.config.steps % period;
          let cell = plugin.model.cells[0];
          let lastS = plugin.sMap.get(cell);
          let lastV = plugin.vMap.get(cell);
          let newS = Math.sin(step / period * Math.PI * 2) * amp;
          newS += add ? lastS : 0;
          let newV = newS - lastS;
          let newA = newV - lastV;
          plugin.sMap.set(cell, newS);
          plugin.vMap.set(cell, newV);
          plugin.aMap.set(cell, newA);
        }
      }
    `;
  }

  _activate() {
    this.registerHook('beforeStep', () => this.onBeforeStep());
    this.registerHook('autopauseStep', () => this.onAutopauseStep());
    this.registerHook('clear', () => this.onClear());
    this.registerHook('debugSelect', (cell) => {
      let s = this.sMap.get(cell);
      let v = this.vMap.get(cell);
      let a = this.aMap.get(cell);
      console.log(cell.coord, s, v, a);
    });
  }

  _enable() {
    this.sMap = this.shared.get(this, 'sMap', new Map());
    this.vMap = this.shared.get(this, 'vMap', new Map());
    this.aMap = this.shared.get(this, 'aMap', new Map());
    let setS = this.sMap.size == 0;
    let setV = this.vMap.size == 0;
    let setA = this.aMap.size == 0;
    this.initCells(setS, setV, setA);
  }

  _disable() {
    this.shared.delete(this, 'sMap');
    this.shared.delete(this, 'vMap');
    this.shared.delete(this, 'aMap');
  }

  initCells(setS, setV, setA) {
    this.model.eachCell((cell) => {
      setS && this.sMap.set(cell, this.settings.initialState(cell));
      setV && this.vMap.set(cell, this.settings.initialV(cell));
      setA && this.aMap.set(cell, this.settings.initialA(cell));
    });
  }

  onClear() {
    this.initCells(true, true, true);
  }

  onBeforeStep() {
    this.settings.beforeStep && this.settings.beforeStep(this);
  } 

  onAutopauseStep() {
    let curMap = new Map(this.sMap);
    let minIdx = this.model.cells[0].minIdx;
    let maxIdx = this.model.cells[0].maxIdx;
    for (let cell of this.model.cells) {
      let sTotal = 0;
      for (let i = minIdx; i < maxIdx; i++) {
        sTotal += curMap.get(cell.nbrs[i]);
      }
      let a = (sTotal - this.sMap.get(cell) * cell.neighborhood) * this.settings.c(cell) ** 2;
      let v = (this.vMap.get(cell) + a) * this.settings.friction(cell);
      let s = (curMap.get(cell) + v) * this.settings.decay(cell);
      this.sMap.set(cell, s);
      this.vMap.set(cell, v);
      this.aMap.set(cell, a);
    }
    this.sArray = Float64Array.from(this.sMap.values());
    this.vArray = Float64Array.from(this.vMap.values());
    this.aArray = Float64Array.from(this.aMap.values());
    // TODO: Save this to meta
    this.model.changed = true;
  }
}
Board.registerPlugin(WaveCore);
