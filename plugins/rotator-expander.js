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
        pivotUp: 1,
        pivotDown: 1,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: null,
      }
    `;
  }

  _activate() {
    const tau = Math.PI * 2;
    let angle, upRadius, downRadius, lineWidth;
    this.drawFn = (adapter) => {
      this.setStateLists();
      let min = this.settings.minRadius;
      let base = this.settings.baseRadius;
      let max = this.settings.maxRadius;
      let pivotUp = this._getPivot(this.board.drawStepQInc, this.settings.pivotUp);
      let pivotDown = this._getPivot(this.board.drawStepQInc, this.settings.pivotDown);
      angle = this.settings.angleOffset + this.settings.angleDelta * this.board.drawStepQInc;
      upRadius = adapter.innerRadius * ((max - base) * pivotUp + base);
      downRadius = adapter.innerRadius * ((base - min) * (1 - pivotDown) + min);
      lineWidth = this.settings.lineWidth != null ? this.settings.lineWidth : this.config.cellBorderWidth;
    };
    this.drawCellFn = (cell, adapter) => {
      if (!cell.state || !this._isAllowedState(cell.state)) return;
      let ctx = adapter.context;
      ctx.save();
      ctx.globalCompositeOperation = this.settings.blendMode;
      let r = cell.state - cell.lastState > 0 ? upRadius : downRadius;
      let p = [];
      for (let i = 0; i < 6; i++) {
        let x = r * Math.cos(angle + tau / 6 * i);
        let y = r * Math.sin(angle + tau / 6 * i);
        p.push([x, y]);
      }
      adapter.drawPath(cell, p);
      if (this.settings.fill) {
        adapter.context.fillStyle = adapter.fillColors[cell.state];
        this.settings.fill && adapter.context.fill();
      }
      if (this.settings.stroke) {
        adapter.context.strokeStyle = adapter.strokeColors[cell.state];
        adapter.context.lineWidth = lineWidth;
        this.settings.stroke && adapter.context.stroke();
      }
      ctx.restore();
    };
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
    this.registerAdapterHook(this.bgAdapter.onDrawCell, this.drawCellFn);
  }
};
Board.registerPlugin(RotatorExpander);
