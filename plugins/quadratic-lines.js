class QuadraticLines extends Plugin {
  defaultSettings() {
    return `
      {
        drawLines: true,
        minAlpha: 0,
        maxAlpha: 1,
        curveCoef: 0.5,
        curveDiff: 0.75,
        drawCircles: true,
        minCircleRadius: 0,
        maxCircleRadius: 0.25,
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
    let adapter = this.bgAdapter;
    let ctx = adapter.context;
    let pivotQ, alpha, curveCoef, curveCoefInv, curveDiff, curveDiffInv, circleRadius;

    this.drawFn = (adapter) => {
      this.setStateLists();
      let settings = this.settings;
      let q = board.drawStepQInc;
      pivotQ = this._getPivot(q, settings.pivot);
      alpha = pivotQ * ((settings.maxAlpha - settings.minAlpha) + settings.minAlpha);
      curveCoef = settings.curveCoef * pivotQ;
      curveCoefInv = 1 - curveCoef;
      curveDiff = settings.curveDiff;
      curveDiffInv = 1 - settings.curveDiff;
      circleRadius = pivotQ * adapter.innerRadius *
        ((settings.maxCircleRadius - settings.minCircleRadius) + settings.minCircleRadius);
    };
    this.drawCellFn = (cell, adapter) => {
      if (!cell.state || cell.edge || !this._isAllowedState(cell.state)) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = this.settings.blendMode;
      ctx.fillStyle = adapter.strokeColors[cell.state];
      let [x, y] = model.cellMap.get(cell);
      if (this.settings.drawLines) {
        for (let i = 0; i < 6; i++) {
          let n0 = cell.nbrs[i + 1];
          let n1 = cell.nbrs[(i + 1) % 6 + 1];
          if (n0.state && n0.state <= cell.state && this._isAllowedState(n0.state)) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            let [xn, yn] = model.cellMap.get(n0);
            let x0 = (x + xn) / 2;
            let y0 = (y + yn) / 2;
            let [x1, y1] = model.cellMap.get(n1);
            let xa = x1 * curveCoef + x0 * curveCoefInv;
            let ya = y1 * curveCoef + y0 * curveCoefInv;
            ctx.quadraticCurveTo(xa, ya, xn, yn);
            xa = xa * curveDiff + x0 * curveDiffInv;
            ya = ya * curveDiff + y0 * curveDiffInv;
            ctx.quadraticCurveTo(xa, ya, x, y);
            ctx.fill();
          }
        }
      }
      if (this.settings.drawCircles) {
        ctx.beginPath();
        ctx.arc(x, y, circleRadius, 0, Hexular.math.tau);
        ctx.fill();
      }
      ctx.restore();
    };
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
    this.registerAdapterHook(this.bgAdapter.onDrawCell, this.drawCellFn);
  }
};
Board.registerPlugin(QuadraticLines);
