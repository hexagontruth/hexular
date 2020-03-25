(() => {
  let fn = () => {
    let adapter = Board.bgAdapter;
    let board = Board.instance;
    let model = Board.model;
    let config = Board.config;
    let ctx = adapter.context;
    config.setOnDrawCell(null);
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
    }
    model.eachCell((cell) => {
      cell.lines = cell.newLines = toLines(cell.state);
    });
    config.maxNumStates = 64;
    config.setNumStates(64);
    for (let i = 0; i < 64; i++) {
      config.setRule(i, 'total');
    }
    adapter.onDrawCell.replace([
      (cell) => {
        if (board.drawStep == 0) {
          cell.lastLines = cell.lines;
          cell.lines = toLines(cell.state);
        }
      },
      (cell) => {
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
      },
    ]);
  };
  Board.instance.addHook('resize', fn);
  fn();
})();