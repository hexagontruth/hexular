// This will break undo/redo, model saving, and god knows what else, and is also sort of pointless
(() => {
  let fn = () => {
    let adapter = Board.bgAdapter;
    let board = Board.instance;
    let model = Board.model;
    let config = Board.config;
    let ctx = adapter.context;
    config.setOnDrawCell(null);
    config.meta.hexType = config.meta.hexType != null ? config.meta.hexType : Hexular.enums.TYPE_POINTY;
    config.meta.rotationFactor = config.meta.rotationFactor || 1;
    let sigmoid = ([i, j]) => [1 / (1 + Math.E ** -i), 1 / (1 + Math.E ** -j)];
    let mult = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    let polar = ([i, j]) => [Math.sqrt(i * i + j * j), Math.atan2(j, i)];
    let cart = ([m, p]) => [Math.cos(p) * m, Math.sin(p) * m];
    let dirs = Array(6).fill(null).map((_, i) => [0, (i + 1) / 6 * 4 * config.meta.rotationFactor]);
    model.eachCell((cell) => {
      if (typeof cell.state == 'number')
        cell.state = [cell.state, 0];
    });
    let hsl = ([i, j]) => {
      let [r, p] = polar([i, j]);
      p = p * 180 / Math.PI;
      r = (100 - r * 50).toFixed(3);
      return `hsl(${p}, 100%, ${r}%)`;
    }
    let fn = (cell) => {
      let [i, j] = [cell.state[0], cell.state[1]];
      for (let n = 0; n < 6; n++) {
        let nbr = cell.nbrs[n + 1];
        let dir = [0, (n + 1) / 6 * 4 * config.meta.rotationFactor];
        let [ni, nj] = mult(nbr.state, dir);
        i += ni;
        j += nj;
      }
      let [m, p] = polar([i, j]);
      return cart([Math.tanh(m), p]);
    };
    board.addHook('paint', (cells) => {
      cells.forEach((cell) => {
        if (typeof cell.state == 'number') {
          cell.state = [cell.state, 0];
        }
      });
    });
    config.customPaintMap = (idx) => {
      if (idx == 0)
        return [1, 0];
      else
        return [0, 0];
    };
    Object.keys(config.filters).forEach((e) => config.filters[e] = false);
    config.setFilters();
    model.groundState = [0, 0];
    config.setNumStates(2);
    config.addRule('tanhRotator', fn);
    config.setRule(null, 'tanhRotator');
    adapter.onDrawCell.replace([
      (cell) => {
        let r = adapter.innerRadius;
        let q = config.drawStepInterval == 1 ? 1 : board.drawStep / config.drawStepInterval;
        let step = board.drawStep;
        let color;
        let [i, j] = cell.state;
        if (q < 1) {
          let [m, p] = polar([i, j]);
          let [lm, lp] = polar(cell.lastState || cell.state);
          m = m * q + lm * (1 - q);
          p = p * q + lp * (1 - q);
          [i, j] = cart([m, p]);
        }
        color = hsl([i, j]);
        adapter.drawHexagon(cell, r, {type: config.meta.hexType, fill: true, fillStyle: color});
      },
    ]);
  };
  Board.instance.addHook('resize', fn);
  fn();
})();