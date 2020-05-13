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

  _init() {
    this.t = [127, 127, 127, 0];
  }

  _activate() {
    this.updateColors();
    this.registerBoardHook('updateTheme', () => this.updateColors());
    this.registerAdapterHook(this.bgAdapter.onDraw, (adapter) => this.onDraw(adapter));
  }

  updateColors() {
    this.fillColors = this.bgAdapter.fillColors.map((e) => Util.styleToVcolor(e));
    this.strokeColors = this.bgAdapter.strokeColors.map((e) => Util.styleToVcolor(e));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let {
      hexType, fadeIndex, fill, stroke, lineWidth, minRadius,
      maxRadius, minAlpha, maxAlpha, pivot
    } = this.settings;
    let q = this.board.drawStepQInc;
    let fadeQ = q >= fadeIndex ? 1 : q / fadeIndex;
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
      if (opts.fill) {
        let cur = this.fillColors[cell.state] || this.t;
        let last = this.fillColors[cell.lastState] || this.t;
        opts.fillStyle = Util.vcolorToHex(Util.mergeVcolors(cur, last, fadeQ));
      }
      if (opts.stroke) {
        let cur = this.strokeColors[cell.state] || this.t;
        let last = this.strokeColors[cell.lastState] || this.t;
        opts.strokeStyle = Util.vcolorToHex(Util.mergeVcolors(cur, last, fadeQ));
      }
      adapter.drawHexagon(cell, radius, opts);
    });
  }
}
Board.registerPlugin(FaderExpander);
