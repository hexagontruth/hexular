class Hexagrams extends Plugin {
  defaultSettings() {
    return `
      {
        drawRings: true,
        blendMode: null,
      }
    `;
  }

  _activate() {
    let setLines = (cell) => cell.lines = cell.newLines = this.toLines(cell.state);
    let clearLines = () => {
      if (!this.enabled) return;
      this.model.eachCell(setLines);
    };
    let paintLines = (cells) => {
      if (!this.enabled) return;
      cells.forEach(setLines);
    };

    this.initializeLines();
    this.registerBoardHook('clear', clearLines);
    this.registerBoardHook('paint', paintLines);
    this.registerAdapterHook(this.bgAdapter.onDraw, (adapter) => this.onDraw(adapter));
  }

  _enable() {
    this.oldNumStates = this.config.maxNumStates;
    this.config.setMaxNumStates(64);
  }

  _disable() {
    // This is problematic for obvious reasons and was only included when changing maxNumStates was still, to my mind,
    // sort of esoteric functionality. But it's now become more "mainstreamed" in my usage so whatever.
    // this.oldNumStates && this.config.setMaxNumStates(this.oldNumStates);
  }

  initializeLines() {
    this.model.eachCell((cell) => {
      let lastLines = cell.lines;
      cell.lines = this.toLines(cell.state);
      cell.lastLines = lastLines || cell.lines;
    });
  }

  toLines(state) {
    return [
      state % 2,
      (state >> 1) % 2,
      (state >> 2) % 2,
      (state >> 3) % 2,
      (state >> 4) % 2,
      (state >> 5) % 2,
    ];
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let q = this.board.drawStepQInc;
    if (this.board.drawStep == 0)
      this.initializeLines();
    let colors = this.config.fillColors;

    // Draw
    if (this.settings.drawRings) {
      this.drawEachCell((cell) => {
        if (!this.isAllowedState(cell.state)) return;
        let r = adapter.innerRadius;
        let color, cur, next = 1;
        for (let i = 5; i >= 0; i--) {
          cur = next;
          next = i / 6;
          if (this.config.drawStepInterval == 1) {
            color = cell.lines[i] ? colors[i + 1] : colors[0];
            adapter.drawHexagon(cell, r * cur, {fill: true, fillStyle: color});
          }
          else {
            if (q <= cur) {
              color = cell.lastLines[i] ? colors[i + 1] : colors[0];
              adapter.drawHexagon(cell, r * cur, {fill: true, fillStyle: color});
            }
            if (q > next) {
              color = cell.lines[i] ? colors[i + 1] : colors[0];
              adapter.drawHexagon(cell, Math.min(r * q, r * cur), {fill: true, fillStyle: color});
            }
          }
        }
      });
    }
  }
}
Board.registerPlugin(Hexagrams);
