class FaderExpander extends Plugin {
  defaultSettings() {
    return `
      {
        hexType: 1,
        minAlpha: 0,
        maxAlpha: 1,
        minRadius: 0,
        maxRadius: 1,
        fill: true,
        stroke: false,
      }
    `;
  }

  activate() {
    const tau = Math.PI * 2;
    let model = this.model;
    let board = this.board;
    let adapter = this.bgAdapter;
    let ctx = adapter.context;
    let q, pivotQ, radius, alpha, verts, opts;
    let fillColors = adapter.fillColors.map((e) => adapter.styleToVcolor(e));
    let strokeColors = adapter.strokeColors.map((e) => adapter.styleToVcolor(e));
    let t = [127, 127, 127, 0];
    this.drawFn = (adapter) => {
      let minRadius = this.settings.minRadius;
      let maxRadius = this.settings.maxRadius;
      let minAlpha = this.settings.minAlpha;
      let maxAlpha = this.settings.maxAlpha;

      q = this.board.drawStepQ;
      pivotQ = (q > 0.5 ? 1 - q : q) * 2;
      radius = adapter.innerRadius * ((maxRadius - minRadius) * pivotQ + minRadius);
      alpha = (maxAlpha - minAlpha) * pivotQ + minAlpha;
      verts = this.settings.hexType ? Hexular.math.pointyVertices : Hexular.math.flatVertices;
      opts = {
        type: this.settings.hexType,
        fill: this.settings.fill,
        stroke: this.settings.stroke,
      };
    };
    this.drawCellFn = (cell, adapter) => {
      if (cell.state) {
        ctx.save();
        ctx.globalAlpha = alpha;
        if (opts.fill) {
          let cur = fillColors[cell.state] || t;
          let last = fillColors[cell.lastState] || t;
          opts.fillStyle = adapter.vcolorToHex(adapter.mergeVcolors(cur, last, q));
        }
        if (opts.stroke) {
          let cur = strokeColors[cell.state] || t;
          let last = strokeColors[cell.lastState] || t;
          opts.strokeStyle = adapter.vcolorToHex(adapter.mergeVcolors(cur, last, q));
        }
        adapter.drawHexagon(cell, radius, opts);
        ctx.restore();
      }
    };
    this.bgAdapter.onDraw.push(this.drawFn);
    this.bgAdapter.onDrawCell.push(this.drawCellFn);
  }

  deactivate() {
    this.bgAdapter.onDraw.keep((e) => e != this.drawFn);
    this.bgAdapter.onDrawCell.keep((e) => e != this.drawCellFn);
  }
};
Board.registerPlugin(FaderExpander);
