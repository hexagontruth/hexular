class SimpleLines extends Plugin {
  defaultSettings() {
    return `
      {
        color: 'max', // max|min|blend|[custom]
        minAlpha: 0,
        maxAlpha: 1,
        minWidth: null,
        maxWidth: null,
        lineCap: null,
        enableGround: false,
        pivot: 0.5,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: null,
      }
    `;
  }

  _activate() {
    const tau = Math.PI * 2;
    let model = this.model;
    let pivotQ, alpha, width, colors, lineCap;
    let t = [127, 127, 127, 0];
    this.updateColors = () => {
      colors = this.bgAdapter.fillColors.map((e) => Util.styleToVcolor(e));
    };
    this.drawFn = (adapter) => {
      this.setStateLists();
      let settings = this.settings;
      let minWidth = this.settings.minWidth != null ? this.settings.minWidth : this.config.cellBorderWidth;
      let maxWidth = this.settings.maxWidth != null ? this.settings.maxWidth : this.config.cellBorderWidth;
      let q = this.board.drawStepQInc;
      pivotQ = this._getPivot(q, this.settings.pivot);
      alpha = settings.minAlpha + pivotQ * (settings.maxAlpha - settings.minAlpha);
      width = minWidth + pivotQ * (maxWidth - minWidth);
      lineCap = this.settings.lineCap || 'round';
    };
    this.drawCellFn = (cell, adapter) => {
      if (
        width == 0 || (!cell.state && !this.settings.enableGround) ||
        cell.edge || !this._isAllowedState(cell.state)
      ) return;
      let ctx = adapter.context;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = this.settings.blendMode;
      let [x, y] = model.cellMap.get(cell);
      for (let i = 0; i < 6; i += 2) {
        let nbr = cell.nbrs[i + 1];
        if ((nbr.state || this.settings.enableGround) && this._isAllowedState(nbr.state)) {
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
      ctx.restore();
    };
    this.updateColors();
    this.registerBoardHook('updateTheme', this.updateColors);
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
    this.registerAdapterHook(this.bgAdapter.onDrawCell, this.drawCellFn);
  }
};
Board.registerPlugin(SimpleLines);
