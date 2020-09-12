class VertexShapes extends Plugin {
  defaultSettings() {
    return `
      {
        shapeType: Hexular.enums.TYPE_TRI_AUTO,
        color: 'blend', // 'max'|'min'|'blend'|string|function
        fadeIndex: 0, // 0-1
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
        isolate: false,
        edges: false,
      }
    `;
  }

  _onSaveSettings() {
    this.updateMaps();
  }

  _activate() {
    this.registerHook('clear', () => this.updateMaps());
    this.registerHook('step', () => this.onStep)
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  _enable() {
    this.updateMaps();
  }

  onDraw(adapter) {
    // Setup
    let model = this.model;
    let ctx = adapter.context;
    let fillColors = this.config.fillColors;
    let strokeColors = this.config.strokeColors;
    let q = this.board.drawStepQInc;
    let {
      shapeType,
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
      isolate,
      edges,
    } = this.settings;
    minWidth = minWidth != null ? minWidth : this.config.cellBorderWidth;
    maxWidth = maxWidth != null ? maxWidth : this.config.cellBorderWidth;
    let fadeQ = this.getFade(q);
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
    let paths;
    if (shapeType != Hexular.enums.TYPE_CIRCLE) {
      let matrix = Hexular.math.scalarOp(Hexular.math.rotationMatrix(angle), radius);
      if (adapter.shapes[shapeType]) {
        let path = adapter.shapes[shapeType].map((v) => Hexular.math.matrixMult(matrix, v));
        paths = [path, path];
      }
      else {
        let path0, path1;
        if (shapeType == Hexular.enums.TYPE_TRI_ANTI_AUTO) {
          path0 = adapter.shapes[Hexular.enums.TYPE_TRI_DOWN];
          path1 = adapter.shapes[Hexular.enums.TYPE_TRI_UP];
        }
        else { // Default to Hexular.enums.TYPE_TRI_AUTO
          path0 = adapter.shapes[Hexular.enums.TYPE_TRI_UP];
          path1 = adapter.shapes[Hexular.enums.TYPE_TRI_DOWN];
        }
        paths = [path0, path1].map((p) => p.map((v) => Hexular.math.matrixMult(matrix, v)));
      }
    }

    let colorSetting = this.settings.color;
    let colorFn = (typeof colorSetting == 'function') ? colorSetting : null;

    // Draw
    this.drawEachCell((cell) => {
      let allowed = this.isAllowedState(cell.state);
      if (!allowed && !inclusive) return;
      let [xo, yo] = model.cellMap.get(cell);
      let lastFill = this.lastFill.get(cell);
      let lastStroke = this.lastStroke.get(cell);
      for (let i = 0; i < 2; i++) {
        let n0 = cell.nbrs[i * 3 + 1];
        let n1 = cell.nbrs[i * 3 + 2];
        if (!edges && cell.edge + n0.edge + n1.edge > 2)
          continue;
        if (!isolate) {
          let allowed0 = this.isAllowedState(n0.state);
          let allowed1 = this.isAllowedState(n1.state);
          let allowedInclusive = inclusive && (allowed || allowed0 || allowed1);
          let allowedExclusive = allowedInclusive || allowed && allowed0 && allowed1;
          if (!allowedInclusive && !allowedExclusive)
            continue;
        }
        else if (n0.state != cell.state || n1.state != cell.state) {
          continue;
        }
        let [x, y] = transVerts[(i * 3 + 1) % 6];
        x += xo;
        y += yo;
        // Draw shapes
        if (shapeType == Hexular.enums.TYPE_CIRCLE) {
          ctx.moveTo(x, y);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
        }
        else {
          adapter.drawPath([x, y], paths[i]);
        }
        // Fill and stroke
        let colorFill, colorStroke;
        if (colorFn) {
          colorFill = colorFn(cell, n0, n1, Hexular.enums.FILL);
          colorStroke = colorFn(cell, n0, n1, Hexular.enums.STROKE);
        }
        else if (colorSetting == 'max') {
          colorFill = fillColors[Math.max(cell.state, n0.state, n1.state)];
          colorStroke = strokeColors[Math.max(cell.state, n0.state, n1.state)];
        }
        else if (colorSetting == 'min') {
          colorFill = fillColors[Math.min(cell.state, n0.state, n1.state)];
          colorStroke = strokeColors[Math.max(cell.state, n0.state, n1.state)];
        }
        else if (colorSetting == 'blend') {
          let c, c0, c1;
          c = fillColors[cell.state];
          c0 = fillColors[n0.state];
          c1 = fillColors[n1.state];
          colorFill = Color.blend(c, c0, c1);
          c = strokeColors[cell.state];
          c0 = strokeColors[n0.state];
          c1 = strokeColors[n1.state];
          colorStroke = Color.blend(c, c0, c1);
        }
        else {
          ctx.fillStyle = colorSetting;
          ctx.strokeStyle = colorSetting;
        }
        if (colorFill) {
          if (fadeQ < 1) {
            colorFill = colorFill.blend(lastFill[i], fadeQ);
            colorStroke = colorStroke.blend(lastStroke[i], fadeQ);
          }
          adapter.fillColor = colorFill;
          adapter.strokeColor = colorStroke;
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
        this.lastFill.set(cell, Array(3).fill().map(() => Color.t));
      this.lastStroke.get(cell) ||
        this.lastStroke.set(cell, Array(3).fill().map(() => Color.t));
    });
  }
}
Board.registerPlugin(VertexShapes);
