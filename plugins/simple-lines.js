class SimpleLines extends Plugin {
  defaultSettings() {
    return `
      {
        color: 'max', // max|min|blend|[custom]
        minAlpha: 1,
        maxAlpha: 1,
        minWidth: null,
        maxWidth: null,
        lineCap: null,
        alphaPivot: 0.5,
        widthPivot: 0.5,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
        inclusive: false,
      }
    `;
  }

  _activate() {
    let colors;
    let t = [127, 127, 127, 0];
    this.updateColors = () => {
      colors = this.bgAdapter.strokeColors.map((e) => Util.styleToVcolor(e));
      this.board.draw();
    };
    this.drawFn = (adapter) => {
      // Setup
      let ctx = adapter.context;
      let settings = this.settings;
      let minWidth = this.settings.minWidth != null ? this.settings.minWidth : this.config.cellBorderWidth;
      let maxWidth = this.settings.maxWidth != null ? this.settings.maxWidth : this.config.cellBorderWidth;
      let q = this.board.drawStepQInc;
      let alphaPivotQ = this._getPivot(q, this.settings.alphaPivot);
      let widthPivotQ = this._getPivot(q, this.settings.widthPivot);
      this.globalAlpha = settings.minAlpha + alphaPivotQ * (settings.maxAlpha - settings.minAlpha);
      let width = minWidth + widthPivotQ * (maxWidth - minWidth);
      let lineCap = this.settings.lineCap || 'round';

      // Draw
      let model = this.model;

      if (width) {
        this.drawEachCell((cell) => {
          let allowed = this._isAllowedState(cell.state);
          let allowedInclusive = allowed && this.settings.inclusive;
          if (cell.edge || (!allowed && !this.settings.inclusive)) return;
          let [x, y] = model.cellMap.get(cell);
          for (let i = 0; i < 6; i += 2) {
            let nbr = cell.nbrs[i + 1];
            let nbrAllowed = this._isAllowedState(nbr.state);
            if (allowedInclusive || nbrAllowed) {
              let vcolor;
              if (this.settings.color == 'max')
                vcolor = colors[Math.max(cell.state, nbr.state)] || t;
              else if (this.settings.color == 'min')
                vcolor = colors[Math.min(cell.state, nbr.state)] || t;
              else if (this.settings.color == 'blend')
                vcolor = Util.mergeVcolors(colors[cell.state] || t, colors[nbr.state] || t);
              if (!vcolor)
                ctx.strokeStyle = this.settings.color;
              else
                ctx.strokeStyle = Util.vcolorToHex(vcolor);

              let [xn, yn] = model.cellMap.get(nbr);
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(xn, yn);
              ctx.lineWidth = width;
              ctx.lineCap = lineCap;
              ctx.stroke();
            }
          }
        });
      }
    };

    this.updateColors();
    this.registerBoardHook('updateTheme', this.updateColors);
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
  }
};
Board.registerPlugin(SimpleLines);
