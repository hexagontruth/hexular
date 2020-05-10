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
        pivot: 0.5,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {
    let adapter = this.bgAdapter;
    let ctx = adapter.context;
    let fillColors, strokeColors;
    let t = [127, 127, 127, 0];
    this.updateColors = () => {
      fillColors = adapter.fillColors.map((e) => Util.styleToVcolor(e));
      strokeColors = adapter.strokeColors.map((e) => Util.styleToVcolor(e));
    };
    this.drawFn = (adapter) => {
      // Setup
      let {
        hexType, fadeIndex, fill, stroke, lineWidth, minRadius,
        maxRadius, minAlpha, maxAlpha, pivot
      } = this.settings;
      let q = this.board.drawStepQInc;
      let fadeQ = q >= fadeIndex ? 1 : q / fadeIndex;
      let pivotQ = this._getPivot(q, pivot);
      let radius = adapter.innerRadius * ((maxRadius - minRadius) * pivotQ + minRadius);
      this.globalAlpha = (maxAlpha - minAlpha) * pivotQ + minAlpha;
      let opts = {
        type: hexType,
        fill: fill,
        stroke: stroke,
        lineWidth: lineWidth != null ? lineWidth : this.config.cellBorderWidth,
      };

      // Draw
      this.drawEachCell((cell) => {
        if (!this._isAllowedState(cell.state)) return;
        if (opts.fill) {
          let cur = fillColors[cell.state] || t;
          let last = fillColors[cell.lastState] || t;
          opts.fillStyle = Util.vcolorToHex(Util.mergeVcolors(cur, last, fadeQ));
        }
        if (opts.stroke) {
          let cur = strokeColors[cell.state] || t;
          let last = strokeColors[cell.lastState] || t;
          opts.strokeStyle = Util.vcolorToHex(Util.mergeVcolors(cur, last, fadeQ));
        }
        adapter.drawHexagon(cell, radius, opts);
      });
    };

    this.updateColors();
    this.registerBoardHook('updateTheme', this.updateColors);
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
  }
};
Board.registerPlugin(FaderExpander);
