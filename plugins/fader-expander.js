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
        lineWidth: null,
      }
    `;
  }

  activate() {
    const tau = Math.PI * 2;
    let model = this.model;
    let board = this.board;
    let config = this.config;
    let adapter = this.bgAdapter;
    let ctx = adapter.context;
    let q, pivotQ, radius, alpha, verts, opts;
    let fillColors, strokeColors;
    let t = [127, 127, 127, 0];
    this.updateColors = () => {
      fillColors = adapter.fillColors.map((e) => adapter.styleToVcolor(e));
      strokeColors = adapter.strokeColors.map((e) => adapter.styleToVcolor(e));
    };
    this.drawFn = (adapter) => {
      let settings = this.settings;
      let minRadius = settings.minRadius;
      let maxRadius = settings.maxRadius;
      let minAlpha = settings.minAlpha;
      let maxAlpha = settings.maxAlpha;
      q = board.drawStepQ;
      pivotQ = (q > 0.5 ? 1 - q : q) * 2;
      radius = adapter.innerRadius * ((maxRadius - minRadius) * pivotQ + minRadius);
      alpha = (maxAlpha - minAlpha) * pivotQ + minAlpha;
      verts = settings.hexType ? Hexular.math.pointyVertices : Hexular.math.flatVertices;
      opts = {
        type: settings.hexType,
        fill: settings.fill,
        stroke: settings.stroke,
        lineWidth: settings.lineWidth != null ? settings.lineWidth : config.cellBorderWidth,
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
    this.updateColors();
    this.board.addHook('updateTheme', this.updateColors);
    this.bgAdapter.onDraw.push(this.drawFn);
    this.bgAdapter.onDrawCell.push(this.drawCellFn);
  }

  deactivate() {
    this.board.removeHook('updateTheme', this.updateColors);
    this.bgAdapter.onDraw.keep((e) => e != this.drawFn);
    this.bgAdapter.onDrawCell.keep((e) => e != this.drawCellFn);
  }
};
Board.registerPlugin(FaderExpander);
