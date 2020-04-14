class ExpanderContractor extends Plugin {
  defaultSettings() {
    return `
      {
        hexType: 1,
        minRadius: 0,
        baseRadius: 0.5,
        maxRadius: 1,
        fill: true,
        stroke: false,
        color: null,
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
    let deltaRadius, startR, contR, endR, opts, fillColors, strokeColors;
    this.drawFn = (adapter) => {
      let min = this.settings.minRadius;
      let base = this.settings.baseRadius;
      let max = this.settings.maxRadius;
      let q = this.board.drawStepQInc;
      let pivot = this._getPivot(q, this.settings.pivot);
      let r = adapter.innerRadius;
      deltaRadius = this.settings.maxRadius - this.settings.minRadius;
      contR = r * (base + (max - base) * pivot);
      startR = r * (min + (base - min) * q);
      endR = r * (base - (base - min) * q);
      opts = {
        type: this.settings.hexType,
        fill: this.settings.fill,
        stroke: this.settings.stroke,
        lineWidth: this.settings.lineWidth != null ? this.settings.lineWidth : adapter.cellBorderWidth,
      };
      fillColors = adapter.fillColors.slice();
      strokeColors = adapter.strokeColors.slice();
      if (this.settings.color) {
        fillColors.fill(this.settings.color);
        strokeColors.fill(this.settings.color);
      }
    };
    this.drawCellFn = (cell, adapter) => {
      if (!this._isAllowedState(cell.state)) return;
      this.setStateLists();
      let r;
      let ctx = adapter.context;
      if (cell.state) {
        opts.fillStyle = fillColors[cell.state];
        opts.strokeStyle = strokeColors[cell.state];
        r = cell.lastState ? contR : startR;
      }
      else if (cell.lastState) {
        opts.fillStyle = fillColors[cell.lastState];
        opts.strokeStyle = strokeColors[cell.lastState];
        r = endR;
      }
      else {
        return;
      }
      ctx.save();
      ctx.globalCompositeOperation = this.settings.blendMode;
      adapter.drawHexagon(cell, r, opts);
      ctx.restore();
    };
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
    this.registerAdapterHook(this.bgAdapter.onDrawCell, this.drawCellFn);
  }
};
Board.registerPlugin(ExpanderContractor);
