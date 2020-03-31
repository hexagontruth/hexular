class TanhRotator extends Plugin {
  defaultSettings() {
    return `
      {
        hexType: 1,
        rotationFactor: 1,
        fill: true,
        stroke: false,
        lineWidth: null,
      }
    `;
  }

  activate() {
    let board = this.board;
    let model = board.model;
    let config = board.config;
    let opts, q;

    let mult = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    let polar = ([i, j]) => [Math.sqrt(i * i + j * j), Math.atan2(j, i)];
    let cart = ([m, p]) => [Math.cos(p) * m, Math.sin(p) * m];
    let hsl = ([i, j]) => {
      let [r, p] = polar([i, j]);
      p = p * 180 / Math.PI;
      r = (100 - r * 50).toFixed(3);
      return `hsl(${p}, 100%, ${r}%)`;
    }

    this.convertFn = (cell) => {
      if (typeof cell.state == 'number')
        cell.state = [cell.state, 0];
    };
    this.paintFn = (cells) => {
      cells.forEach(this.convertFn);
    };
    this.paintMap = (idx) => {
      if (idx == 0)
        return [1, 0];
      else
        return [0, 0];
    };
    this.ruleFn = (cell) => {
      let [i, j] = [cell.state[0], cell.state[1]];
      for (let n = 0; n < 6; n++) {
        let nbr = cell.nbrs[n + 1];
        let dir = [0, (n + 1) / 6 * 4 * this.settings.rotationFactor];
        let [ni, nj] = mult(nbr.state, dir);
        i += ni;
        j += nj;
      }
      let [m, p] = polar([i, j]);
      return cart([Math.tanh(m), p]);
    };

    this.drawFn = (adapter) => {
      opts = {
        type: this.settings.hexType,
        fill: this.settings.fill,
        stroke: this.settings.stroke,
        lineWidth: this.settings.lineWidth != null ? this.settings.lineWidth : adapter.cellBorderWidth,
      };
      q = config.drawStepInterval == 1 ? 1 : board.drawStep / config.drawStepInterval;
    };
    this.drawCellFn = (cell, adapter) => {
      let r = adapter.innerRadius;
      let [i, j] = cell.state;
      if (q < 1) {
        let [m, p] = polar([i, j]);
        let [lm, lp] = polar(cell.lastState || cell.state);
        m = m * q + lm * (1 - q);
        p = p * q + lp * (1 - q);
        [i, j] = cart([m, p]);
      }
      let color = hsl([i, j]);
      opts.fillStyle = opts.strokeStyle = hsl([i, j]);
      adapter.drawHexagon(cell, r, opts);
    };
    model.eachCell(this.convertFn);
    Object.keys(config.filters).forEach((e) => config.filters[e] = false);
    config.setFilters();
    model.groundState = [0, 0];
    config.setNumStates(2);
    config.addRule('tanhRotator', this.ruleFn);
    config.setRule(null, 'tanhRotator');
    this.drawFn(this.bgAdapter);
    this.board.addHook('paint', this.paintFn);
    this.config.customPaintMap = this.paintMap;
    this.bgAdapter.onDraw.push(this.drawFn);
    this.bgAdapter.onDrawCell.push(this.drawCellFn);
  }

  deactivate() {
    this.board.removeHook('paint', this.paintFn);
    if (this.config.customPaintMap == this.paintMap)
      this.config.customPaintMap = null;
    this.bgAdapter.onDraw.keep((e) => e != this.drawFn);
    this.bgAdapter.onDrawCell.keep((e) => e != this.drawCellFn);
  }
};
Board.registerPlugin(TanhRotator);
