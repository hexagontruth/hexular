// TODO: Massively refactor this and/or scatter it to the very winds

class CanvasAdapter {
  constructor(...args) {
    let defaults = {
      model: null,
      board: null,
      context: null,
    };
    Hexular.util.merge(this, defaults, ...args);
    Hexular.HexError.validateKeys(this, 'model', 'board', 'context');
    this.config = this.board.config;

    // Build cell map if not already built
    this.model.buildCellMap();

    // Common paths
    this.shapes = {};
    this.shapes[Hexular.enums.TYPE_FLAT] = Hexular.math.flatVertices.slice();
    this.shapes[Hexular.enums.TYPE_POINTY] = Hexular.math.pointyVertices.slice();
    this.shapes[Hexular.enums.TYPE_TRI_UP] = Hexular.math.pointyVertices.filter((_, i) => i % 2 == 0);
    this.shapes[Hexular.enums.TYPE_TRI_DOWN] = Hexular.math.pointyVertices.filter((_, i) => i % 2 != 0);
    this.shapes[Hexular.enums.TYPE_TRI_LEFT] = Hexular.math.flatVertices.filter((_, i) => i % 2 == 0);
    this.shapes[Hexular.enums.TYPE_TRI_RIGHT] = Hexular.math.flatVertices.filter((_, i) => i % 2 != 0);
  }

  set fillColor(color=Color.t) {
    this.context.fillStyle = color.toString();
  }

  set strokeColor(color=Color.t) {
    this.context.strokeStyle = color.toString();
  }

  draw() {
    // Provisional hack for the illusion of grid wrapping
    // This is by a wide margin now the worst function in this project
    // TODO: Rewrite
    this.board.eachHook(['draw', 'drawCell'], (hook, hookName) => {
      if (this.config.meta.repeat) {
        let rings = +this.config.meta.repeat;
        let f = this.config.meta.repeatRadius || this.config.order;
        let a = this.config.cellRadius * 2;
        let r = (f + 0.5) * 1.5 * a;
        let bigT = Hexular.math.scalarOp(Hexular.math.pointyVertices, r);
        let smolT = Hexular.math.scalarOp(Hexular.math.flatVertices, this.config.cellRadius * Hexular.math.apothem);
        let translate = (dir) => {
          this.context.translate(...bigT[dir]);
          this.context.translate(...smolT[(dir + 1) % 6]);
        };
        for (let i = 0; i < rings; i++) {
          this.context.save();
          for (let k = 0; k <= i; k++)
            translate(0);
          for (let j = 0; j < 6; j++) {
            for (let k = 0; k <= i; k++) {
              translate((j + 2) % 6);
              if (hookName == 'draw')
                this.board.runHook(hook, this);
              else
                this.board.runHookParallel(hook, this.model.getCells(), this);
            }

          }
          this.context.restore();
        }
      }
      if (hookName == 'draw')
        this.board.runHook(hook, this);
      else
        this.board.runHookParallel(hook, this.model.getCells(), this);
    });
  }

  clear() {
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
    this.context.restore();
  }

  drawDefaultCells(cells=this.model.getCells()) {
    let opts = {
      type: Hexular.enums.TYPE_POINTY,
      fill: true,
      stroke: true,
      strokeStyle: this.config.modelBackgroundColor,
      lineWidth: Config.defaults.cellBorderWidth,
    };
    cells.forEach((cell) => {
      let state = cell.state;
      opts.fillStyle = this.config.fillColors[state] || this.config.defaultColor;
      this.drawShape(cell, this.config.cellRadius, opts);
    });
  }

  drawStateMap(map) {
    map.forEach((state, cell) => {
      let color = this.config.fillColors[state] || this.config.defaultColor;
      color = color[3] == 0 ? this.config.modelBackground : Color([color[0], color[1], color[2], 0xff]);
      this.context.fillStyle = color;
      this.drawPath(cell);
      this.context.fill();
    });
  }

  drawCircle(cell, radius=this.config.innerRadius) {
    const [x, y] = this.model.cellMap.get(cell);
    let ctx = this.context;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  }

  // Draw paths as relative points, without styling &c.
  drawPath(locator, path=this.config.pointyVertices) {
    const [x, y] = locator instanceof Hexular.Cell ? this.model.cellMap.get(locator) : locator;
    let ctx = this.context;
    ctx.beginPath();
    ctx.moveTo(x + path[0][0], y + path[0][1]);
    for (let i = 1; i < path.length; i++)
      ctx.lineTo(x + path[i][0], y + path[i][1]);
    ctx.closePath();
  }

  // Draw enumerated shapes or paths, without saving or restoring context
  drawShape(locator, radius=this.config.innerRadius, opts={}) {
    let defaults = {
      path: null,
      type: Hexular.enums.TYPE_POINTY,
      fill: false,
      stroke: false,
      fillStyle: null,
      strokeStyle: null,
      lineWidth: this.config.cellBorderWidth,
      lineJoin: 'miter',
      alpha: null,
      clip: false,
    };
    opts = Object.assign(defaults, opts);
    let ctx = this.context;
    if (opts.path) {
      this.drawPath(locator, Hexular.math.scalarOp(opts.path, radius));
    }
    else {
      const [x, y] = locator instanceof Hexular.Cell ? this.model.cellMap.get(locator) : locator;
      if (opts.type == Hexular.enums.TYPE_CIRCLE) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Hexular.math.tau);
      }
      else {
        let path = this.shapes[opts.type] || this.shapes[Hexular.enums.TYPE_POINTY];
        path = Hexular.math.scalarOp(path, radius);
        ctx.beginPath();
        ctx.moveTo(x + path[0][0], y + path[0][1]);
        for (let i = 1; i < path.length; i++)
          ctx.lineTo(x + path[i][0], y + path[i][1]);
        ctx.closePath();
      }
    }
    if (opts.clip) {
      ctx.clip();
    }
    else {
      if (opts.alpha != null) {
        ctx.globalAlpha = opts.alpha;
      }
      if (opts.fill) {
        ctx.fillStyle = (opts.fillStyle || this.config.defaultColor).toString();
        ctx.fill();
      }
      if (opts.stroke && opts.lineWidth) {
        ctx.strokeStyle = (opts.strokeStyle || this.config.defaultColor).toString();
        ctx.lineWidth = opts.lineWidth;
        ctx.lineJoin = opts.lineJoin;
        ctx.stroke();
      }
    }
  }

  getFillFade(cell) {
    let q = this.board.drawStepQ;
    let fade = this.config.fadeIndex;
    let cur = this.config.fillColors[cell.state] || this.config.defaultColor;
    let last = this.config.fillColors[cell.lastState] || this.config.defaultColor;
    if ( fade == 0 || q >= fade)
      return cur;
    else if (q == 0)
      return last;
    return cur.blend(last, q / fade);
  }

  getStrokeFade(cell) {
    let q = this.board.drawStepQ;
    let fade = this.config.fadeIndex;
    let cur = this.config.strokeColors[cell.state] || this.config.defaultColor;
    let last = this.config.strokeColors[cell.lastState] || this.config.defaultColor;
    if ( fade == 0 || q >= fade)
      return cur;
    else if (q == 0)
      return last;
    return cur.blend(last, q / fade);
  }

  drawFilledPointyHex(cell, style) {
    this.context.fillStyle = style || this.getFillFade(cell);
    this.drawPath(cell);
    this.context.fill();
  }

  drawOutlinePointyHex(cell, style, lineWidth) {
    lineWidth = lineWidth || this.config.cellBorderWidth;
    if (lineWidth == 0)
      return;
    this.context.strokeStyle = style || this.getStrokeFade(cell);

    this.context.lineWidth = lineWidth;
    this.drawPath(cell);
    this.context.stroke();
  }

  drawFilledFlatHex(cell, style) {
    this.context.fillStyle = style || this.getFillFade(cell);
    this.drawPath(cell, this.config.flatVertices);
    this.context.fill();
  }

  drawOutlineFlatHex(cell, style, lineWidth) {
    lineWidth = lineWidth || this.config.cellBorderWidth;
    if (lineWidth == 0)
      return;
    this.context.strokeStyle = style || this.getStrokeFade(cell);
    this.context.lineWidth = lineWidth;
    this.drawPath(cell, this.config.flatVertices);
    this.context.stroke();
  }

  drawFilledCircle(cell, style) {
    this.context.fillStyle = style || this.getFillFade(cell);
    this.drawCircle(cell);
    this.context.fill();
  }

  drawOutlineCircle(cell, style, lineWidth) {
    lineWidth = lineWidth || this.config.cellBorderWidth;
    if (lineWidth == 0)
      return;
    this.context.strokeStyle = style || this.getStrokeFade(cell);
    this.context.lineWidth = lineWidth
    this.drawCircle(cell);
    this.context.stroke();
  }

  drawBackground() {
    if (this.config.order == null) return;
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.fillStyle = this.board.recordingMode ?
      this.config.modelBackgroundColor.toString() : this.config.backgroundColor.toString();
    this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height);
    this.context.restore();
    if (this.config.drawModelBackground && !this.board.recordingMode) {
      let radius = (this.config.order + 1) * this.config.cellRadius * Hexular.math.apothem * 2;
      this.context.beginPath();
      this.context.moveTo(radius, 0);
      for (let i = 0; i < 6; i++) {
        let a = Math.PI / 3 * i;
        this.context.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      }
      this.context.closePath();
      this.context.fillStyle = this.config.modelBackgroundColor;
      this.context.fill();
    }
  }
}
