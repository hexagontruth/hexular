class FaderExpander extends Plugin {
  defaultSettings() {
    return `
      {
        hexType: 1, // 0|1|2
        fadeIndex: 0, // 0-1
        minAlpha: 0,
        maxAlpha: 1,
        minRadius: 0,
        maxRadius: 1,
        fill: true,
        stroke: false,
        lineWidth: null,
        lineJoin: null,
        pivot: 0.5,
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
    let fillColors = this.config.fillColors;
    let strokeColors = this.config.strokeColors;
    let {
      hexType, fill, stroke, lineWidth, minRadius,
      maxRadius, minAlpha, maxAlpha, pivot
    } = this.settings;
    let q = this.board.drawStepQInc;
    let fadeQ = this.getFade(q);
    let pivotQ = this.getPivot(q, pivot);
    let radius = adapter.innerRadius * ((maxRadius - minRadius) * pivotQ + minRadius);
    this.globalAlpha = (maxAlpha - minAlpha) * pivotQ + minAlpha;
    let opts = {
      type: hexType,
      fill: fill,
      stroke: stroke,
      lineWidth: lineWidth != null ? lineWidth : this.config.cellBorderWidth,
      lineJoin: this.settings.lineJoin || this.config.defaultJoin,
    };

    // Draw
    this.drawEachCell((cell) => {
      if (!this.isAllowedState(cell.state)) return;
      let fade = fadeQ < 1;
      if (opts.fill) {
        opts.fillStyle = fillColors[cell.state] || Color.t;
        if (fade) opts.fillStyle = opts.fillStyle.blend(fillColors[cell.lastState], fadeQ)
      }
      if (opts.stroke) {
        opts.strokeStyle = strokeColors[cell.state] || Color.t;
        if (fade) opts.strokeStyle = opts.strokeStyle.blend(strokeColors[cell.lastState], fadeQ);
      }
      adapter.drawHexagon(cell, radius, opts);
    });
  }
}
Board.registerPlugin(FaderExpander);
