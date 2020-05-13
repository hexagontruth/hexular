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
        minWidth: null,
        maxWidth: null,
        widthPivot: 0.5,
        fill: true,
        stroke: false,
        lineJoin: null,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
        inclusive: true,
      }
    `;
  }

  _init() {
    this.t = [127, 127, 127, 0];
  }

  _onSaveSettings() {
    this.updateMaps();
  }

  _activate() {
    this.updateColors();
    this.updateMaps();
    this.registerBoardHook('updateTheme', () => this.updateColors());
    this.registerBoardHook('clear', () => this.updateMaps());
    this.registerAdapterHook(this.bgAdapter.onDraw, (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let model = this.model;
    let ctx = adapter.context;
    let fillColors = this.fillColors;
    let strokeColors = this.strokeColors;
    let q = this.board.drawStepQInc;
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
      minWidth,
      maxWidth,
      widthPivot,
      inclusive,
    } = this.settings;
    minWidth = minWidth != null ? minWidth : this.config.cellBorderWidth;
    maxWidth = maxWidth != null ? maxWidth : this.config.cellBorderWidth;
    let fadeQ = q >= fadeIndex ? 1 : q / fadeIndex;
    let angleQ = this.getPivot(q, anglePivot);
    let opacityQ = this.getPivot(q, opacityPivot);
    let radiusQ = this.getPivot(q, radiusPivot);
    let widthQ = this.getPivot(q, widthPivot);
    let angle = angleQ * angleDelta + angleOffset;
    this.globalAlpha = opacityQ * (maxOpacity - minOpacity) + minOpacity;
    let radius = model.cellRadius * (radiusQ * (maxRadius - minRadius) + minRadius);
    let lineWidth = minWidth + widthQ * (maxWidth - minWidth);
    let lineJoin = this.settings.lineJoin || 'miter';
    let transVerts = Hexular.math.scalarOp(Hexular.math.pointyVertices, model.cellRadius);
    let hexVerts = new Array(6).fill(null).map((_, i) => {
      return [
        Math.sin(i * Math.PI / 3 + angleOffset + angleQ * angleDelta) * radius,
        Math.cos(i * Math.PI / 3 + angleOffset + angleQ * angleDelta) * radius
      ];
    });

    // Draw
    this.drawEachCell((cell) => {
      let allowed = this.isAllowedState(cell.state);
      if (cell.edge || (!allowed && !inclusive)) return;
      let [xo, yo] = model.cellMap.get(cell);
      let lastFill = this.lastFill.get(cell);
      let lastStroke = this.lastStroke.get(cell);
      for (let i = 0; i < 2; i++) {
        let n0 = cell.nbrs[i * 3 + 1];
        let n1 = cell.nbrs[i * 3 + 2];
        let allowed0 = this.isAllowedState(n0.state);
        let allowed1 = this.isAllowedState(n1.state);
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
          c = fillColors[cell.state] || this.t;
          c0 = fillColors[n0.state] || this.t;
          c1 = fillColors[n1.state] || this.t;
          colorFill = Util.mergeVcolors(Util.mergeVcolors(c0, c1), c, 2 / 3);
          c = strokeColors[cell.state] || this.t;
          c0 = strokeColors[n0.state] || this.t;
          c1 = strokeColors[n1.state] || this.t;
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
        if (this.settings.stroke && lineWidth) {
          ctx.lineJoin = lineJoin;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }
        lastFill[i] = colorFill;
        lastStroke[i] = colorStroke;
      }
    });
  }

  updateMaps() {
    this.lastFill = new Map();
    this.lastStroke = new Map();
    this.model.eachCell((cell) => {
      this.lastFill.get(cell) ||
        this.lastFill.set(cell, Array(3).fill().map(() => this.t.slice()));
      this.lastStroke.get(cell) ||
        this.lastStroke.set(cell, Array(3).fill().map(() => this.t.slice()));
    });
  }

  updateColors() {
    this.fillColors = this.bgAdapter.fillColors.map((e) => Util.styleToVcolor(e));
    this.strokeColors = this.bgAdapter.strokeColors.map((e) => Util.styleToVcolor(e));
    this.board.draw();
  }
}
Board.registerPlugin(VertexShapes);
