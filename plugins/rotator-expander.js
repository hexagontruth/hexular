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
      fill, stroke, lineWidth, lineJoin, color, upQ, downQ
    } = this.settings;
    let q = this.board.drawStepQInc;
    upQ = this.getPivot(q, upQ);
    downQ = this.getPivot(q, downQ);
    let fadeQ = this.getFade(q);
    let angle = angleOffset + angleDelta * q;
    let upRadius = adapter.innerRadius * ((maxRadius - baseRadius) * upQ + baseRadius);
    let downRadius = adapter.innerRadius * ((baseRadius - minRadius) * (1 - downQ) + minRadius);
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
      let r = cell.state - cell.lastState > 0 ? upRadius : downRadius;
      let p = [];
      for (let i = 0; i < 6; i++) {
        let x = r * Math.cos(angle + Hexular.math.tau / 6 * i);
        let y = r * Math.sin(angle + Hexular.math.tau / 6 * i);
        p.push([x, y]);
      }
      let color;
      adapter.drawPath(cell, p);
      let fade = fadeQ < 1;
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
