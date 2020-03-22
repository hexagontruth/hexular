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
    let ruleFn = (cell) => {
      let newLines = cell.newLines = cell.lines.slice();
      for (let i = 0; i < 6; i++) {
        let nbr = cell.nbrs[i + 1];
        if (cell.lines[i]) {
          for (let j = 0; j < 6; j++) {
            newLines[j] = newLines[j] ^ nbr.lines[j];
          }
        }
        else {
          for (let j = 0; j < 6; j++) {
            newLines[j] = newLines[j] ^ (1 - nbr.lines[j]);
          }
        }
      }
      return fromLines(newLines);
    };
    model.eachCell((cell) => {
      cell.newLines = toLines(cell.state);
    });
    config.addRule('hexagrams', ruleFn);
    config.setNumStates(64);
    for (let i = 0; i < 64; i++) {
      config.setRule(i, 'hexagrams');
    }
    adapter.onDrawCell.replace([
      (cell) => {
        cell.lastLines = cell.lines;
        cell.lines = cell.newLines;
        cell.lines = toLines(cell.state);
      },
      (cell) => {
        let r = adapter.cellRadius;
        // adapter.drawHexagon(cell, r, {fill: true, fillStyle: '#000000' + ('0' + (cell.state * 4).toString(16)).slice(-2)});
        let q = board.drawStepQ;
        let step = board.drawStep;
                  if (cell == board.debugSelected)
            console.log(cell.state, cell.lines);
        for (let i = 5; i >= 0; i--) {
          let color = cell.lines[i] ? adapter.fillColors[1] : adapter.backgroundColor;
          adapter.drawHexagon(cell, r * (i + 1) / 6, {fill: true, fillStyle: color});
        }
      },
    ]);
  };
  Board.instance.addHook('resize', fn);
  fn();
})();