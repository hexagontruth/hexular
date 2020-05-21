// TODO: Massively refactor this and/or scatter it to the very winds

class CanvasAdapter {
  constructor(...args) {
    let defaults = {
      model: null,
      board: null,
      context: null,
      stateBuffer: new Map(),
    };
    Hexular.util.merge(this, defaults, ...args);
    Hexular.HexError.validateKeys(this, 'model', 'board', 'context');
    this.config = this.board.config;

    // Build cell map if not already built
    this.model.buildCellMap();
    // Compute math stuff
    this.updateMathPresets();
  }

  updateMathPresets() {
    this.cellRadius = this.model.cellRadius;
    this.radius = this.config.radius;
    this.innerRadius = this.config.cellRadius - this.config.cellGap / (2 * Hexular.math.apothem);
    this.flatVertices = Hexular.math.scalarOp(Hexular.math.vertices, this.innerRadius);
    this.pointyVertices = Hexular.math.scalarOp(Hexular.math.vertices.map(([x, y]) => [y, x]), this.innerRadius);
  }

  set fillColor(color=Color.t) {
    this.context.fillStyle = color.toString();
  }

  set strokeColor(color=Color.t) {
    this.context.strokeStyle = color.toString();
  }

  draw() {
    this.clear();
    this.board.runHooks('draw', this);
    this.board.runHooksParallel('drawCell', this.model.getCells(), this);
  }

  clear() {
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
    this.context.restore();
  }

  drawBuffer(cell) {
    let state = this.stateBuffer.get(cell);
    let color = this.config.fillColors[state] || this.config.defaultColor;
    color = color == Color.t ? this.config.modelBackground : Color([color[0], color[1], color[2], 0xff]);
    this.context.fillStyle = color;
    this.drawPath(cell);
    this.context.fill();
  }

  drawCircle(cell, radius=this.innerRadius) {
    const [x, y] = this.model.cellMap.get(cell);
    let ctx = this.context;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  }

  drawPath(cell, path=this.pointyVertices) {
    const [x, y] = this.model.cellMap.get(cell);
    let ctx = this.context;
    ctx.beginPath();
    ctx.moveTo(x + path[0][0], y + path[0][1]);
    for (let i = 1; i < path.length; i++)
      ctx.lineTo(x + path[i][0], y + path[i][1]);
    ctx.closePath();
  }

  drawHexagon(locator, radius, opts={}) {
    let defaults = {
      type: Hexular.enums.TYPE_POINTY,
      stroke: false,
      fill: false,
      strokeStyle: null,
      lineWidth: 0,
      lineJoin: 'miter',
      fillStyle: null,
    };
    opts = Object.assign(defaults, opts);
    const [x, y] = locator instanceof Hexular.Cell ? this.model.cellMap.get(locator) : locator;
    let ctx = this.context;
    if (opts.type == 2) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Hexular.math.tau);
      ctx.fill();
    }
    else {
      let path = opts.type == Hexular.enums.TYPE_POINTY ? Hexular.math.pointyVertices : Hexular.math.flatVertices;
      path = Hexular.math.scalarOp(path, radius);
      ctx.beginPath();
      ctx.moveTo(x + path[0][0], y + path[0][1]);
      for (let i = 1; i < path.length; i++)
        ctx.lineTo(x + path[i][0], y + path[i][1]);
      ctx.closePath();
    }
    if (opts.fill) {
      ctx.fillStyle = opts.fillStyle.toString();
      ctx.fill();
    }
    if (opts.stroke && opts.lineWidth > 0) {
      ctx.strokeStyle = opts.strokeStyle.toString();
      ctx.lineWidth = opts.lineWidth;
      ctx.lineJoin = opts.lineJoin;
      ctx.stroke();
    }
  }

  drawFilledPointyHex(cell, adapter, style) {
    this.context.fillStyle = style || this.config.fillColors[cell.state] || this.config.defaultColor;
    this.drawPath(cell);
    this.context.fill();
  }

  drawOutlinePointyHex(cell, adapter, style, lineWidth) {
    lineWidth = lineWidth || this.cellBorderWidth;
    if (lineWidth == 0)
      return;
    this.context.strokeStyle = style || this.config.strokeColors[cell.state] || this.config.defaultColor;
    this.context.lineWidth = lineWidth;
    this.drawPath(cell);
    this.context.stroke();
  }

  drawFilledFlatHex(cell, adapter, style) {
    this.context.fillStyle = style || this.config.fillColors[cell.state] || this.config.defaultColor;
    this.drawPath(cell, this.flatVertices);
    this.context.fill();
  }

  drawOutlineFlatHex(cell, adapter, style, lineWidth) {
    lineWidth = lineWidth || this.cellBorderWidth;
    if (lineWidth == 0)
      return;
    this.context.strokeStyle = style || this.config.strokeColors[cell.state] || this.config.defaultColor;
    this.context.lineWidth = lineWidth;
    this.drawPath(cell, this.flatVertices);
    this.context.stroke();
  }

  drawFilledCircle(cell, adapter, style) {
    this.context.fillStyle = style || this.config.fillColors[cell.state] || this.config.defaultColor;
    this.drawCircle(cell);
    this.context.fill();
  }

  drawOutlineCircle(cell, adapter, style, lineWidth) {
    lineWidth = lineWidth || this.cellBorderWidth;
    if (lineWidth == 0)
      return;
    this.context.strokeStyle = style || this.config.fillColors[cell.state] || this.config.defaultColor;
    this.context.lineWidth = lineWidth
    this.drawCircle(cell);
    this.context.stroke();
  }

  drawSolidBackground() {
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.fillStyle = this.backgroundColor;
    this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height);
    this.context.restore();
  }

  drawModelBackground() {
    if (!this.model.radius) return;
    let radius = this.model.radius * this.cellRadius * Hexular.math.apothem * 2;
    this.context.beginPath();
    this.context.moveTo(radius, 0);
    for (let i = 0; i < 6; i++) {
      let a = Math.PI / 3 * i;
      this.context.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    this.context.closePath();
    this.context.fillStyle = this.backgroundColor;
    this.context.fill();
  }
}
