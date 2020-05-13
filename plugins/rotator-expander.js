class RotatorExpander extends Plugin {
  defaultSettings() {
    return `
      {
        angleOffset: 0,
        angleDelta: Math.PI / 3,
        minRadius: 0.5,
        baseRadius: 1,
        maxRadius: 1.5,
        fill: true,
        stroke: false,
        lineWidth: null,
        lineJoin: null,
        color: null,
        upQ: 1,
        downQ: 1,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {
    this.registerAdapterHook(this.bgAdapter.onDraw, (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let q = this.board.drawStepQInc;
    let {
      angleOffset, angleDelta, fadeIndex, minRadius, baseRadius, maxRadius,
      fill, stroke, lineWidth, lineJoin, color, upQ, downQ
    } = this.settings;
    upQ = this.getPivot(q, upQ);
    downQ = this.getPivot(q, downQ);
    let angle = angleOffset + angleDelta * q;
    let upRadius = adapter.innerRadius * ((maxRadius - baseRadius) * upQ + baseRadius);
    let downRadius = adapter.innerRadius * ((baseRadius - minRadius) * (1 - downQ) + minRadius);
    lineWidth = lineWidth != null ? lineWidth : this.config.cellBorderWidth;
    lineJoin = lineJoin || this.config.defaultJoin;
    let fillColors = adapter.fillColors.slice();
    let strokeColors = adapter.strokeColors.slice();
    if (this.settings.color) {
      fillColors.fill(this.settings.color);
      strokeColors.fill(this.settings.color);
    }

    // Draw
    this.drawEachCell((cell) => {
      if (!this.isAllowedState(cell.state)) return;
      let r = cell.state - cell.lastState > 0 ? upRadius : downRadius;
      let p = [];
      for (let i = 0; i < 6; i++) {
        let x = r * Math.cos(angle + Hexular.math.tau / 6 * i);
        let y = r * Math.sin(angle + Hexular.math.tau / 6 * i);
        p.push([x, y]);
      }
      adapter.drawPath(cell, p);
      if (this.settings.fill) {
        ctx.fillStyle = fillColors[cell.state];
        ctx.fill();
      }
      if (this.settings.stroke && lineWidth) {
        ctx.strokeStyle = strokeColors[cell.state];
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = lineJoin;
        ctx.stroke();
      }
    });
  }
}
Board.registerPlugin(RotatorExpander);
