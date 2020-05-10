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
    let board = this.board;
    let model = board.model;
    let config = board.config;

    let toLines = (state) => {
      return [
        state % 2,
        (state >> 1) % 2,
        (state >> 2) % 2,
        (state >> 3) % 2,
        (state >> 4) % 2,
        (state >> 5) % 2,
      ];
    };
    let fromLines = (lines) => {
      return lines[0] + lines[1] * 2 + lines[2] * 4 + lines[3] * 8 + lines[4] * 16 + lines[5] * 32;
    };
    let setLines = (cell) => cell.lines = cell.newLines = toLines(cell.state);
    let initializeLines = () => {
      model.eachCell((cell) => {
        let lastLines = cell.lines;
        cell.lines = toLines(cell.state);
        cell.lastLines = lastLines || cell.lines;
      });
    };
    let clearLines = () => {
      if (!this.enabled) return;
      Board.model.eachCell(setLines);
    };
    let paintLines = (cells) => {
      if (!this.enabled) return;
      cells.forEach(setLines);
    };
    let drawFn = (adapter) => {
      // Setup
      let ctx = adapter.context;
        let q = this.board.drawStepQInc;
      if (board.drawStep == 0)
        initializeLines();

      // Draw
      if (this.settings.drawRings) {
        this.drawEachCell((cell) => {
          if (!this._isAllowedState(cell.state)) return;
          let r = adapter.innerRadius;
          let color, cur, next = 1;
          for (let i = 5; i >= 0; i--) {
            cur = next;
            next = i / 6;
            if (config.drawStepInterval == 1) {
              color = cell.lines[i] ? adapter.fillColors[i + 1] : adapter.fillColors[0];
              adapter.drawHexagon(cell, r * cur, {fill: true, fillStyle: color});
            }
            else {
              if (q <= cur) {
                color = cell.lastLines[i] ? adapter.fillColors[i + 1] : adapter.fillColors[0];
                adapter.drawHexagon(cell, r * cur, {fill: true, fillStyle: color});
              }
              if (q > next) {
                color = cell.lines[i] ? adapter.fillColors[i + 1] : adapter.fillColors[0];
                adapter.drawHexagon(cell, Math.min(r * q, r * cur), {fill: true, fillStyle: color});
              }
            }
          }
        });
      }
    };

    initializeLines();
    this.registerBoardHook('clear', clearLines);
    this.registerBoardHook('paint', paintLines);
    this.registerAdapterHook(this.bgAdapter.onDraw, drawFn);
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
};
Board.registerPlugin(Hexagrams);
