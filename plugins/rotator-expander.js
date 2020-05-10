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
        color: null,
        pivotUp: 1,
        pivotDown: 1,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {
    this.drawFn = (adapter) => {
      // Setup
      let {
        angleOffset, angleDelta, minRadius, baseRadius, maxRadius, fill,
        stroke, lineWidth, color, pivotUp, pivotDown
      } = this.settings;
      let ctx = adapter.context;
      pivotUp = this._getPivot(this.board.drawStepQInc, pivotUp);
      pivotDown = this._getPivot(this.board.drawStepQInc, pivotDown);
      let angle = angleOffset + angleDelta * this.board.drawStepQInc;
      let upRadius = adapter.innerRadius * ((maxRadius - baseRadius) * pivotUp + baseRadius);
      let downRadius = adapter.innerRadius * ((baseRadius - minRadius) * (1 - pivotDown) + minRadius);
      lineWidth = lineWidth != null ? lineWidth : this.config.cellBorderWidth;
      let fillColors = adapter.fillColors.slice();
      let strokeColors = adapter.strokeColors.slice();
      if (this.settings.color) {
        fillColors.fill(this.settings.color);
        strokeColors.fill(this.settings.color);
      }

      // Draw
      this.drawEachCell((cell) => {
        if (!this._isAllowedState(cell.state)) return;
        let r = cell.state - cell.lastState > 0 ? upRadius : downRadius;
        let p = [];
        for (let i = 0; i < 6; i++) {
          let x = r * Math.cos(angle + Hexular.math.tau / 6 * i);
          let y = r * Math.sin(angle + Hexular.math.tau / 6 * i);
          p.push([x, y]);
        }
        adapter.drawPath(cell, p);
        if (this.settings.fill) {
          adapter.context.fillStyle = fillColors[cell.state];
          this.settings.fill && adapter.context.fill();
        }
        if (this.settings.stroke) {
          adapter.context.strokeStyle = strokeColors[cell.state];
          adapter.context.lineWidth = lineWidth;
          this.settings.stroke && adapter.context.stroke();
        }
      });
    };
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
  }
};
Board.registerPlugin(RotatorExpander);
