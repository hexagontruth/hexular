class VertexShapes extends Plugin {
  defaultSettings() {
    return `
      {
        shape: 'triangle', // hex|circle|triangle,
        color: 'blend', // max|min|blend|[custom]
        angleOffset: 0,
        angleDelta: 0,
        anglePivot: 0.5,
        minOpacity: 0,
        maxOpacity: 1,
        opacityPivot: 0.5,
        minRadius: 0,
        maxRadius: 1,
        radiusPivot: 0.5,
        fill: true,
        stroke: false,
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
    let angle, opacity, radius, angleQ, opacityQ, radiusQ, transVerts, hexVerts;
    let fillColors, strokeColors;
    let t = [127, 127, 127, 0];
    this.updateColors = () => {
      fillColors = adapter.fillColors.map((e) => Util.styleToVcolor(e));
      strokeColors = adapter.strokeColors.map((e) => Util.styleToVcolor(e));
    };
    this.drawFn = (adapter) => {
      this.setStateLists();
      let {
        angleOffset,
        angleDelta,
        anglePivot,
        minOpacity,
        maxOpacity,
        opacityPivot,
        minRadius,
        maxRadius,
        radiusPivot
      } = this.settings;
      let angleQ = this._getPivot(board.drawStepQInc, anglePivot);
      let opacityQ = this._getPivot(board.drawStepQInc, opacityPivot);
      let radiusQ = this._getPivot(board.drawStepQInc, radiusPivot);
      angle = angleQ * angleDelta + angleOffset;
      opacity = opacityQ * (maxOpacity - minOpacity) + minOpacity;
      radius = model.cellRadius * (radiusQ * (maxRadius - minRadius) + minRadius);
      transVerts = Hexular.math.scalarOp(Hexular.math.pointyVertices, model.cellRadius);
      hexVerts = new Array(6).fill(null).map((_, i) => {
        return [
          Math.sin(i * Math.PI / 3 + angleOffset + angleQ * angleDelta) * radius,
          Math.cos(i * Math.PI / 3 + angleOffset + angleQ * angleDelta) * radius
        ];
      });
    };
    this.drawCellFn = (cell, adapter) => {
      if (!this._isAllowedState(cell.state) || cell.edge) return;
      ctx.save();
      ctx.globalCompositeOperation = this.settings.blendMode;
      ctx.globalAlpha = opacity;
      let [xo, yo] = model.cellMap.get(cell);
      for (let i = 0; i < 2; i++) {
        let n0 = cell.nbrs[i * 3 + 1];
        let n1 = cell.nbrs[i * 3 + 2];
        if (!this._isAllowedState(n0.state) || !this._isAllowedState(n1.state))
          continue;
        let [x, y] = transVerts[(i * 3 + 4) % 6];
        x += xo;
        y += yo;
        // Draw shapes
        ctx.beginPath();
        if (this.settings.shape == 'hex') {
          ctx.moveTo(x + hexVerts[0][0], y + hexVerts[0][1]);
          for (let j = 0; j < 6; j++)
            ctx.lineTo(x + hexVerts[j][0], y + hexVerts[j][1]);
          ctx.closePath();
        }
        else if (this.settings.shape == 'circle') {
          ctx.moveTo(x, y);
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.closePath();
        }
        else if (this.settings.shape == 'triangle') {
          ctx.moveTo(x + hexVerts[i][0], y + hexVerts[i][1]);
          for (let j = 2 + i; j < 6; j += 2)
            ctx.lineTo(x + hexVerts[j][0], y + hexVerts[j][1]);
          ctx.closePath();
        }
        // Fill and stroke
        let color;
        if (this.settings.fill) {
          if (this.settings.color == 'max') {
            color = adapter.fillColors[Math.max(cell.state, n0.state, n1.state)];
          }
          else if (this.settings.color == 'min') {
            color = adapter.fillColors[Math.min(cell.state, n0.state, n1.state)];
          }
          else if (this.settings.color == 'blend') {
            let c = fillColors[cell.state] || t;
            let c0 = fillColors[n0.state] || t;
            let c1 = fillColors[n1.state] || t;
            color = Util.vcolorToHex(Util.mergeVcolors(Util.mergeVcolors(c0, c1), c, 2 / 3));
          }
          else {
            color = this.settings.color;
          }
          ctx.fillStyle = color;
          ctx.fill();
        }
        if (this.settings.stroke) {
          if (this.settings.color == 'max') {
            color = adapter.strokeColors[Math.max(cell.state, n0.state, n1.state)];
          }
          else if (this.settings.color == 'min') {
            color = adapter.strokeColors[Math.min(cell.state, n0.state, n1.state)];
          }
          else if (this.settings.color == 'blend') {
            let c = strokeColors[cell.state] || t;
            let c0 = strokeColors[n0.state] || t;
            let c1 = strokeColors[n1.state] || t;
            color = Util.vcolorToHex(Util.mergeVcolors(Util.mergeVcolors(c0, c1), c, 2 / 3));
          }
          else {
            color = this.settings.color;
          }
          ctx.strokeStyle = color;
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
Board.registerPlugin(VertexShapes);
