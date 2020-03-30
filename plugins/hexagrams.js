class Hexagrams extends Plugin {
  defaultSettings() {
    return `
      {
        drawRings: true,
      }
    `;
  }

  activate() {
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
    this.clearLines = () => {
      Board.model.eachCell(setLines);
    };
    this.paintLines = (cells) => cells.forEach(setLines);

    this.drawFn = (adapter) => {
      if (board.drawStep == 0) {
        model.eachCell((cell) => {
          cell.lastLines = cell.lines;
          cell.lines = toLines(cell.state);
        });
      }
    };
    this.drawCellFn = (cell, adapter) => {
      if (!this.settings.drawRings)
        return;
      let r = adapter.innerRadius;
      let q = board.drawStep / config.drawStepInterval;
      let step = board.drawStep;
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
    };
    this.drawFn();
    this.board.addHook('clear', this.clearLines);
    this.board.addHook('paint', this.paintLines);
    this.bgAdapter.onDraw.push(this.drawFn);
    this.bgAdapter.onDrawCell.push(this.drawCellFn);
  }

  deactivate() {
    this.board.removeHook('clear', this.clearLines);
    this.board.removeHook('paint', this.paintLines);
    this.bgAdapter.onDraw.keep((e) => e != this.drawFn);
    this.bgAdapter.onDrawCell.keep((e) => e != this.drawCellFn);
  }
};
Board.registerPlugin(Hexagrams);
