class SimpleLines extends Plugin {
  defaultSettings() {
    return `
      {
        color: 'max', // max|min|blend|[custom]
        fadeIndex: 0, // 0-1
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
        isolate: false,
        edges: false,
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let colors = this.config.strokeColors;
    let settings = this.settings;
    let minWidth = this.settings.minWidth != null ? this.settings.minWidth : this.config.cellBorderWidth;
    let maxWidth = this.settings.maxWidth != null ? this.settings.maxWidth : this.config.cellBorderWidth;
    let q = this.board.drawStepQInc;
    let fadeQ = this.getFade(q);
    let alphaPivotQ = this.getPivot(q, this.settings.alphaPivot);
    let widthPivotQ = this.getPivot(q, this.settings.widthPivot);
    this.globalAlpha = settings.minAlpha + alphaPivotQ * (settings.maxAlpha - settings.minAlpha);
    let width = minWidth + widthPivotQ * (maxWidth - minWidth);
    let lineCap = this.settings.lineCap || 'round';
    let verts = Hexular.math.scalarOp(Hexular.math.flatVertices, this.config.cellRadius * 2 * Hexular.math.apothem);

    // Draw
    if (width) {
      this.drawEachCell((cell) => {
        let allowed = this.isAllowedState(cell.state);
        let allowedInclusive = allowed && this.settings.inclusive;
        if (!allowed && !this.settings.inclusive) return;
        let [x, y] = this.model.cellMap.get(cell);
        for (let i = 0; i < 6; i += 2) {
          let nbr = cell.nbrs[i + 1];
          let nbrAllowed = this.isAllowedState(nbr.state);
          let cond = this.settings.isolate ? nbr.state == cell.state : allowedInclusive || nbrAllowed;
          if (cond && (this.settings.edges || cell.edge + nbr.edge < 2)) {
            let color;
            if (this.settings.color == 'max')
              color = colors[Math.max(cell.state, nbr.state)] || Color.t;
            else if (this.settings.color == 'min')
              color = colors[Math.min(cell.state, nbr.state)] || Color.t;
            else if (this.settings.color == 'blend')
              color = Color.blend(colors[cell.state], colors[nbr.state]);
            if (!color)
              ctx.strokeStyle = this.settings.color;
            else if (fadeQ < 1) {
              let lastColor;
              if (this.settings.color == 'max')
                lastColor = colors[Math.max(cell.lastState, nbr.lastState)] || Color.t;
              else if (this.settings.color == 'min')
                lastColor = colors[Math.min(cell.lastState, nbr.lastState)] || Color.t;
              else if (this.settings.color == 'blend')
                lastColor = Color.blend(colors[cell.lastState], colors[nbr.lastState]);
              adapter.strokeColor = color.blend(lastColor, fadeQ);
            }
            else
              adapter.strokeColor = color;
            ctx.lineWidth = width;
            ctx.lineCap = lineCap;
            let xn = x + verts[i][0];
            let yn = y + verts[i][1];
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
