class QuadraticLines extends Plugin {
  defaultSettings() {
    return `
      {
        minAlpha: 1,
        maxAlpha: 1,
        curveCoef: 0.5,
        curveDiff: 0.75,
        drawOn: (a, b) => b <= a,
        pivot: 0.5,
        color: null,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
        inclusive: false,
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let model = this.model;
    let ctx = adapter.context;
    let settings = this.settings;
    let q = this.board.drawStepQInc;
    let pivotQ = this.getPivot(q, settings.pivot);
    this.globalAlpha = pivotQ * (settings.maxAlpha - settings.minAlpha) + settings.minAlpha;
    let curveCoef = settings.curveCoef * pivotQ;
    let curveCoefInv = 1 - curveCoef;
    let curveDiff = settings.curveDiff;
    let curveDiffInv = 1 - settings.curveDiff;
    let drawOn = this.settings.drawOn || (() => true);
    if (this.settings.color)
      ctx.fillStyle = this.settings.color;

    // Draw
    this.drawEachCell((cell) => {
      let allowed = this.isAllowedState(cell.state);
      let allowedInclusive = allowed && this.settings.inclusive;
      if (cell.edge || (!allowed && !this.settings.inclusive)) return;
      if (!this.settings.color)
        adapter.fillColor = this.config.strokeColors[cell.state];
      let [x, y] = model.cellMap.get(cell);
      for (let i = 0; i < 6; i++) {
        let n0 = cell.nbrs[i + 1];
        let n1 = cell.nbrs[(i + 1) % 6 + 1];
        let nbrAllowed = this.isAllowedState(n0.state) && drawOn(cell.state, n0.state);
        if (allowedInclusive || nbrAllowed) {
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
    });
  }
}
Board.registerPlugin(QuadraticLines);
