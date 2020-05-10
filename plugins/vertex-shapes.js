class VertexShapes extends Plugin {
  defaultSettings() {
    return `
      {
        shape: 'tri', // hex|circle|tri,
        color: 'blend', // max|min|blend|[custom]
        fadeIndex: 0, // 0-1 - only works with max, min, or blend color mode
        angleOffset: 0,
        angleDelta: 0,
        anglePivot: 0.5,
        minOpacity: 1,
        maxOpacity: 1,
        opacityPivot: 0.5,
        minRadius: 1,
        maxRadius: 1,
        radiusPivot: 0.5,
        fill: true,
        stroke: false,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
        inclusive: true,
      }
    `;
  }

  _activate() {
    let model = this.model;
    let board = this.board;
    let adapter = this.bgAdapter;
    let ctx = adapter.context;
    let fillColors, strokeColors;
    let t = [127, 127, 127, 0];

    this.updateMaps = () => {
      this.lastFill = new Map();
      this.lastStroke = new Map();
      model.eachCell((cell) => {
        this.lastFill.set(cell, Array(3).fill().map(() => t.slice()));
        this.lastStroke.set(cell, Array(3).fill().map(() => t.slice()));
      });
    };
    this.updateColors = () => {
      fillColors = adapter.fillColors.map((e) => Util.styleToVcolor(e));
      strokeColors = adapter.strokeColors.map((e) => Util.styleToVcolor(e));
      board.draw();
    };
    this.drawFn = (adapter) => {
      // Setup
      let {
        fadeIndex,
        angleOffset,
        angleDelta,
        anglePivot,
        minOpacity,
        maxOpacity,
        opacityPivot,
        minRadius,
        maxRadius,
        radiusPivot,
        inclusive,
      } = this.settings;
      let angleQ = this._getPivot(board.drawStepQInc, anglePivot);
      let opacityQ = this._getPivot(board.drawStepQInc, opacityPivot);
      let radiusQ = this._getPivot(board.drawStepQInc, radiusPivot);
      let fadeQ = board.drawStepQInc >= fadeIndex ? 1 : board.drawStepQInc / fadeIndex;
      let angle = angleQ * angleDelta + angleOffset;
      this.globalAlpha = opacityQ * (maxOpacity - minOpacity) + minOpacity;
      let radius = model.cellRadius * (radiusQ * (maxRadius - minRadius) + minRadius);
      let transVerts = Hexular.math.scalarOp(Hexular.math.pointyVertices, model.cellRadius);
      let hexVerts = new Array(6).fill(null).map((_, i) => {
        return [
          Math.sin(i * Math.PI / 3 + angleOffset + angleQ * angleDelta) * radius,
          Math.cos(i * Math.PI / 3 + angleOffset + angleQ * angleDelta) * radius
        ];
      });

      // Draw
      this.drawEachCell((cell) => {
        let allowed = this._isAllowedState(cell.state);
        if (cell.edge || (!allowed && !inclusive)) return;
        let [xo, yo] = model.cellMap.get(cell);
        let lastFill = this.lastFill.get(cell);
        let lastStroke = this.lastStroke.get(cell);
        for (let i = 0; i < 2; i++) {
          let n0 = cell.nbrs[i * 3 + 1];
          let n1 = cell.nbrs[i * 3 + 2];
          let allowed0 = this._isAllowedState(n0.state);
          let allowed1 = this._isAllowedState(n1.state);
          let allowedInclusive = inclusive && (allowed || allowed0 || allowed1);
          let allowedExclusive = allowedInclusive || allowed && allowed0 && allowed1;
          if (!allowedInclusive && !allowedExclusive)
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
          else if (this.settings.shape == 'tri') {
            ctx.moveTo(x + hexVerts[i][0], y + hexVerts[i][1]);
            for (let j = 2 + i; j < 6; j += 2)
              ctx.lineTo(x + hexVerts[j][0], y + hexVerts[j][1]);
            ctx.closePath();
          }
          // Fill and stroke
          let colorFill, colorStroke;
          if (this.settings.color == 'max') {
            colorFill = fillColors[Math.max(cell.state, n0.state, n1.state)];
            colorStroke = strokeColors[Math.max(cell.state, n0.state, n1.state)];
          }
          else if (this.settings.color == 'min') {
            colorFill = fillColors[Math.min(cell.state, n0.state, n1.state)];
            colorStroke = strokeColors[Math.max(cell.state, n0.state, n1.state)];
          }
          else if (this.settings.color == 'blend') {
            let c, c0, c1;
            c = fillColors[cell.state] || t;
            c0 = fillColors[n0.state] || t;
            c1 = fillColors[n1.state] || t;
            colorFill = Util.mergeVcolors(Util.mergeVcolors(c0, c1), c, 2 / 3);
            c = strokeColors[cell.state] || t;
            c0 = strokeColors[n0.state] || t;
            c1 = strokeColors[n1.state] || t;
            colorStroke = Util.mergeVcolors(Util.mergeVcolors(c0, c1), c, 2 / 3);
          }
          else {
            ctx.fillStyle = this.settings.color;
            ctx.strokeStyle = this.settings.color;
          }
          if (colorFill) {
            if (fadeQ < 1) {
              colorFill = Util.mergeVcolors(colorFill, lastFill[i], fadeQ);
              colorStroke = Util.mergeVcolors(colorStroke, lastStroke[i], fadeQ);
            }
            ctx.fillStyle = Util.vcolorToHex(colorFill);
            ctx.strokeStyle = Util.vcolorToHex(colorStroke)
          }
          this.settings.fill && ctx.fill();
          this.settings.stroke && ctx.stroke();
          lastFill[i] = colorFill;
          lastStroke[i] = colorStroke;
        }
      });
    };
    this.updateColors();
    this.updateMaps();
    this.registerBoardHook('updateTheme', this.updateColors);
    this.registerBoardHook('clear', this.updateMaps);
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
  }
};
Board.registerPlugin(VertexShapes);
