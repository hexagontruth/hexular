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
        pivot: 0.5,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: null,
      }
    `;
  }

  _activate() {
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
      fillColors = adapter.fillColors.map((e) => Util.styleToVcolor(e));
      strokeColors = adapter.strokeColors.map((e) => Util.styleToVcolor(e));
    };
    this.drawFn = (adapter) => {
      if (!this.enabled) return;
      this.setStateLists();
      let settings = this.settings;
      let minRadius = settings.minRadius;
      let maxRadius = settings.maxRadius;
      let minAlpha = settings.minAlpha;
      let maxAlpha = settings.maxAlpha;
      q = board.drawStepQInc;
      pivotQ = this._getPivot(q, this.settings.pivot);
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
      if (!this.enabled) return;
      if (!cell.state || !this._isAllowedState(cell.state)) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = this.settings.blendMode;
      if (opts.fill) {
        let cur = fillColors[cell.state] || t;
        let last = fillColors[cell.lastState] || t;
        opts.fillStyle = Util.vcolorToHex(Util.mergeVcolors(cur, last, q));
      }
      if (opts.stroke) {
        let cur = strokeColors[cell.state] || t;
        let last = strokeColors[cell.lastState] || t;
        opts.strokeStyle = Util.vcolorToHex(Util.mergeVcolors(cur, last, q));
      }
      adapter.drawHexagon(cell, radius, opts);
      ctx.restore();
    };
    this.updateColors();
    this.registerBoardHook('updateTheme', this.updateColors);
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
    this.registerAdapterHook(this.bgAdapter.onDrawCell, this.drawCellFn);
  }
};
Board.registerPlugin(FaderExpander);
