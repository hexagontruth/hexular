class FaderExpander extends Plugin {
  defaultSettings() {
    return `
      {
        shapeType: Hexular.enums.TYPE_POINTY,
        fadeIndex: 0, // 0-1
        minAlpha: 0,
        maxAlpha: 1,
        minRadius: 0,
        maxRadius: 1,
        fill: true,
        stroke: false,
        color: null,
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
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let {
      shapeType, fill, stroke, color, lineWidth, minRadius,
      maxRadius, minAlpha, maxAlpha, pivot
    } = this.settings;
    let q = this.board.drawStepQInc;
    let fadeQ = this.getFade(q);
    let pivotQ = this.getPivot(q, pivot);
    let radius = this.config.innerRadius * ((maxRadius - minRadius) * pivotQ + minRadius);
    this.globalAlpha = (maxAlpha - minAlpha) * pivotQ + minAlpha;
    let opts = {
      type: shapeType,
      fill: fill,
      stroke: stroke,
      lineWidth: lineWidth != null ? lineWidth : this.config.cellBorderWidth,
      lineJoin: this.settings.lineJoin || this.config.defaultJoin,
    };
    let fillColors = this.config.fillColors.slice();
    let strokeColors = this.config.strokeColors.slice();
    if (color) {
      fillColors.fill(Color(this.settings.color));
      strokeColors.fill(Color(this.settings.color));
    }

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
      adapter.drawShape(cell, radius, opts);
    });
  }
}
Board.registerPlugin(FaderExpander);
