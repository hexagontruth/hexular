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
    let deltaRadius, startR, contR, endR, opts;
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
    };
    this.drawCellFn = (cell, adapter) => {
      if (!this._isAllowedState(cell.state)) return;
      this.setStateLists();
      let color, r;
      let ctx = adapter.context;
      if (cell.state) {
        color = adapter.fillColors[cell.state];
        r = cell.lastState ? contR : startR;
      }
      else if (cell.lastState) {
        color = adapter.fillColors[cell.lastState];
        r = endR;
      }
      else {
        return;
      }
      opts.fillStyle = color;
      opts.strokeStyle = color;
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
