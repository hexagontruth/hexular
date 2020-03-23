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
      let newLines = cell.newLines = [0, 0, 0, 0, 0, 0];
      let state = cell.state;
      for (let i = 0; i < 6; i++) {
        let nbr = cell.nbrs[i + 1];
        newLines[i] = cell.lines[i] ^ nbr.lines[i];
      }
      return fromLines(newLines);
    };
    let onDrawFn = () => {
    }
    onDrawFn.demo = true;
    model.eachCell((cell) => {
      cell.lines = cell.newLines = toLines(cell.state);
      cell.hDist = Array(6).fill(0);
    });
    config.addRule('hexagrams', ruleFn);
    config.setNumStates(64);
    for (let i = 0; i < 64; i++) {
      config.setRule(i, 'hexagrams');
    }
    adapter.onDraw.push(onDrawFn);
    adapter.onDrawCell.replace([
      (cell) => {
        if (board.drawStep == 0) {
          cell.lastLines = cell.lines;
          cell.lines = toLines(cell.state);
        }
        for (let i = 0; i < 6; i += 2) {
          let nbr = cell.nbrs[i + 1];
          let m = cell.lines;
          let n = nbr.lines;
          let dist =
            m[0] == n[0] +
            m[1] == n[1] +
            m[2] == n[2] +
            m[3] == n[3] +
            m[4] == n[4] +
            m[5] == n[5];
          cell.hDist[i] = nbr.hDist[(i + 3) % 6] = dist;
        }
      },
      (cell) => {
        let r = adapter.innerRadius;
        let q = board.drawStepQ;
        let step = board.drawStep;
        let color, cur, next = 1;
        for (let i = 5; i >= 0; i--) {
          cur = next;
          next = i / 6;
          if (q <= cur) {
            color = cell.lastLines[i] ? adapter.fillColors[i + 1] : adapter.fillColors[0];
            adapter.drawHexagon(cell, r * cur, {fill: true, fillStyle: color});
          }
          if (q > next) {
            color = cell.lines[i] ? adapter.fillColors[i + 1] : adapter.fillColors[0];
            adapter.drawHexagon(cell, Math.min(r * q, r * cur), {fill: true, fillStyle: color});
          }
        }
      },
    ]);
  };
  Board.instance.addHook('resize', fn);
  fn();
})();