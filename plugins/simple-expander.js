class SimpleExpander extends Plugin {
  defaultSettings() {
    return `
      {
        hexType: 1,
        drawLast: true,
        drawTerminal: true,
        minRadius: 0,
        maxRadius: 1,
        fill: true,
        stroke: false,
        lineWidth: null,
        color: null,
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
    let radius, invRadius, q, opts, fillColors, strokeColors;
    this.drawFn = (adapter) => {
      this.setStateLists();
      let min = this.settings.minRadius;
      let max = this.settings.maxRadius;
      let r = adapter.innerRadius;
      let q = this.board.drawStepQInc;
      radius = r * ((max - min) * q + min);
      invRadius = r * ((max - min) * (1 - q) + min);
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
      let fill, stroke;
      ctx.save();
      ctx.globalCompositeOperation = this.settings.blendMode;
      if (cell.lastState) {
        opts.fillStyle = fillColors[cell.lastState];
        opts.strokeStyle = strokeColors[cell.lastState];
        if (cell.state && this.settings.drawLast) {
          adapter.drawHexagon(cell,  adapter.innerRadius, opts);
        }
        else if (this.settings.drawTerminal) {
          adapter.drawHexagon(cell, invRadius, opts);
        }
        
      }
      if (cell.state) {
        opts.fillStyle = fillColors[cell.state];
        opts.strokeStyle = strokeColors[cell.state];
        adapter.drawHexagon(cell, radius, opts);
      }
      ctx.restore();
    };
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
    this.registerAdapterHook(this.bgAdapter.onDrawCell, this.drawCellFn);
  }
};
Board.registerPlugin(SimpleExpander);
