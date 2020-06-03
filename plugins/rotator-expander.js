class RotatorExpander extends Plugin {
  defaultSettings() {
    return `
      {
        angleOffset: 0,
        angleDelta: Math.PI / 3,
        fadeIndex: 0, // 0-1
        minRadius: 0.5,
        baseRadius: 1,
        maxRadius: 1.5,
        minAlpha: 1,
        baseAlpha: 1,
        maxAlpha: 1,
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
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let {
      angleOffset, angleDelta, fadeIndex, minRadius, baseRadius, maxRadius,
      minAlpha, baseAlpha, maxAlpha, fill, stroke, lineWidth, lineJoin, color, upQ, downQ
    } = this.settings;
    let q = this.board.drawStepQInc;
    upQ = this.getPivot(q, upQ);
    downQ = 1 - this.getPivot(q, downQ);
    let fadeQ = this.getFade(q);
    let angle = angleOffset + angleDelta * q;
    let upRadius = this.config.innerRadius * ((maxRadius - baseRadius) * upQ + baseRadius);
    let downRadius = this.config.innerRadius * ((baseRadius - minRadius) * downQ + minRadius);
    let upAlpha = (maxAlpha - baseAlpha) * upQ + baseAlpha;
    let downAlpha = (baseAlpha - minAlpha) * downQ + minAlpha;
    lineWidth = lineWidth != null ? lineWidth : this.config.cellBorderWidth;
    lineJoin = lineJoin || this.config.defaultJoin;
    let fillColors = this.config.fillColors.slice();
    let strokeColors = this.config.strokeColors.slice();
    if (this.settings.color) {
      ctx.fillStyle = this.settings.color;
      ctx.strokeStyle = this.settings.color;
    }

    // Draw
    this.drawEachCell((cell) => {
      if (!this.isAllowedState(cell.state)) return;
      let [r, a] = cell.state - cell.lastState > 0 ? [upRadius, upAlpha] : [downRadius, downAlpha];
      let p = [];
      for (let i = 0; i < 6; i++) {
        let x = r * Math.cos(angle + Hexular.math.tau / 6 * i);
        let y = r * Math.sin(angle + Hexular.math.tau / 6 * i);
        p.push([x, y]);
      }
      let color;
      adapter.drawPath(cell, p);
      let fade = fadeQ < 1;
      ctx.globalAlpha = a;
      if (this.settings.fill) {
        if (!this.settings.color) {
          color = fillColors[cell.state] || Color.t;
          if (fade) color = color.blend(fillColors[cell.lastState], fadeQ);
          adapter.fillColor = color;
        }
        ctx.fill();
      }
      if (this.settings.stroke && lineWidth) {
        if (!this.settings.color) {
          color = strokeColors[cell.state] || Color.t;
          if (fade) color = color.blend(strokeColors[cell.lastState], fadeQ);
          adapter.strokeColor = color;
        }
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = lineJoin;
        ctx.stroke();
      }
    });
  }
}
Board.registerPlugin(RotatorExpander);
