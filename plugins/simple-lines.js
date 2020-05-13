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

  _init() {
    this.t = [127, 127, 127, 0];
  }

  _activate() {
    this.updateColors();
    this.registerBoardHook('updateTheme', () => this.updateColors());
    this.registerAdapterHook(this.bgAdapter.onDraw, (adapter) => this.onDraw(adapter));
  }

  updateColors() {
    this.colors = this.bgAdapter.strokeColors.map((e) => Util.styleToVcolor(e));
    this.board.draw();
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let settings = this.settings;
    let minWidth = this.settings.minWidth != null ? this.settings.minWidth : this.config.cellBorderWidth;
    let maxWidth = this.settings.maxWidth != null ? this.settings.maxWidth : this.config.cellBorderWidth;
    let q = this.board.drawStepQInc;
    let alphaPivotQ = this.getPivot(q, this.settings.alphaPivot);
    let widthPivotQ = this.getPivot(q, this.settings.widthPivot);
    this.globalAlpha = settings.minAlpha + alphaPivotQ * (settings.maxAlpha - settings.minAlpha);
    let width = minWidth + widthPivotQ * (maxWidth - minWidth);
    let lineCap = this.settings.lineCap || 'round';

    // Draw
    if (width) {
      this.drawEachCell((cell) => {
        let allowed = this.isAllowedState(cell.state);
        let allowedInclusive = allowed && this.settings.inclusive;
        if (cell.edge || (!allowed && !this.settings.inclusive)) return;
        let [x, y] = this.model.cellMap.get(cell);
        for (let i = 0; i < 6; i += 2) {
          let nbr = cell.nbrs[i + 1];
          let nbrAllowed = this.isAllowedState(nbr.state);
          if (allowedInclusive || nbrAllowed) {
            let vcolor;
            if (this.settings.color == 'max')
              vcolor = this.colors[Math.max(cell.state, nbr.state)] || this.t;
            else if (this.settings.color == 'min')
              vcolor = this.colors[Math.min(cell.state, nbr.state)] || this.t;
            else if (this.settings.color == 'blend')
              vcolor = Util.mergeVcolors(this.colors[cell.state] || this.t, this.colors[nbr.state] || this.t);
            if (!vcolor)
              ctx.strokeStyle = this.settings.color;
            else
              ctx.strokeStyle = Util.vcolorToHex(vcolor);
            ctx.lineWidth = width;
            ctx.lineCap = lineCap;
            let [xn, yn] = this.model.cellMap.get(nbr);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(xn, yn);
            ctx.stroke();
          }
        }
      });
    }
  }
}
Board.registerPlugin(SimpleLines);
