class Action {
  constructor(board, ...args) {
    let config = board.config;
    let model = board.model;
    Object.assign(this, {board, config, model}, ...args);
    this.model = board.model;
    this.coords = [];
    this.board.fgAdapter.clear();
  }

  start() {}
  move() {}
  end() {}

  _setCells(...cells) {
    for (let cell of cells) {
      if (this.board.fgAdapter.stateBuffer.get(cell) == this.setState)
        continue;
      this.board.fgAdapter.stateBuffer.set(cell, this.setState)
      this.board.fgAdapter.defaultDrawBuffer(cell);
    }
  }

  _selectWithSize(arg) {
    if (Array.isArray(arg))
      return [].concat(...arg.map((e) => this._selectWithSize(e)));
    return arg ? Hexular.util.hexWrap(arg, this.config.toolSize) : [];
  }

  _applyBuffer() {
    if (this.board.fgAdapter.stateBuffer.size > 0) {
      this.board.newHistoryState();
      this.board.fgAdapter.stateBuffer.forEach((state, cell) => {
        cell.state = state;
      });
      this.board.fgAdapter.stateBuffer.clear();
      this.board.fgAdapter.clear();
      this.board.draw();
    }
  }

  _getCoord(pointerEv) {
    return [pointerEv.pageX, pointerEv.pageY];
  }

  _getPointerCoord(ev) {
    let x, y;
    if (ev.pageX)
      [x, y] = this._getCoord(ev);
    else if (ev.touches && ev.touches[0])
      [x, y] = this._getCoord(ev.touches[0]);
    return [x, y];
  }

  _getAllCoords(ev) {
    if (ev.pageX)
      return [this._getCoord(ev)];
    else if (ev.touches)
      return Array.from(ev.touches).map((e) => this._getCoord(e));
  }

  _getHypot(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  _hypotToModel(h) {
    return h / this.model.cellApothem / this.board.scaleZoom;
  }
}


class MoveAction extends Action {
  start(ev) {
    this.startEv = ev;
    this.coords = [this._getPointerCoord(ev)];
  }
  move(ev) {
    this.coords.push(this._getPointerCoord(ev));
    let [last, cur] = this.coords.slice(-2);
    let diffX = cur[0] - last[0];
    let diffY = cur[1] - last[1];
    this.board.translate([diffX, diffY]);
  }
}

class PinchAction extends Action {
  start(ev) {
    this.hypot = this._getHypotFromTouch(ev);
  }
  move(ev) {
    let newHypot = this._getHypotFromTouch(ev);
    this.board.scale(newHypot / this.hypot);
    this.hypot = newHypot;
  }
  _getHypotFromTouch(ev) {
    let t0 = this._getCoord(ev.touches[0]);
    let t1 = this._getCoord(ev.touches[1]);
    return this._getHypot(t0, t1);
  }
}

class PaintAction extends Action {
  constructor(...args) {
    super(...args);
    if (this.setState == null)
      this.setState = this.config.getPaintColor(0);
    if (this.ctrl)
      this.setState = this.model.groundState;
  }

  end() {
    this._applyBuffer();
    this.board.storeModelState();
  }
}

class FillAction extends PaintAction {
  start() {
    let homeCell = this.board.selected;
    let fillState = homeCell.state;
    let cellSet = new Set();
    cellSet.add(homeCell);
    let queue = homeCell.nbrs.slice(1, 7);
    let cur;
    while (cur = queue.shift()) {
      if (cur.state != fillState || cellSet.has(cur))
        continue;
      cellSet.add(cur);
      for (let i = 1; i < 7; i++)
        queue.push(cur.nbrs[i]);
    }
    let cells = Array.from(cellSet);
    this._setCells(...cells);
  }
}

class BrushAction extends PaintAction {
  start() {
    this._setCells(...this._selectWithSize(this.board.selected));
  }

  move() {
    this._setCells(...this._selectWithSize(this.board.selected));
  }
}

class LineAction extends PaintAction {
  start(ev) {
    this.originCell = this.board.selected;
    this.a = this.board.modelToWindow(this.model.getCoord(this.originCell));
    this.move(ev);
  }

  move(ev) {
    this.b = this._getPointerCoord(ev);
    this.length = this._getHypot(this.a, this.b);
    this.info = (this._hypotToModel(this.length) / 2).toFixed(2);
    this._calculateCells();
  }

  _calculateCells() {
    let samples = this._hypotToModel(this.length);
    let [x, y] = this.a.slice();
    let xSample = (this.b[0] - this.a[0]) / samples;
    let ySample = (this.b[1] - this.a[1]) / samples;
    let cells = this._selectWithSize(this.originCell);
    for (let i = 1; i < samples; i++) {
      x += xSample;
      y += ySample;
      let cell = this.board.cellAt([x, y]);
      // We don't actually care about dups tho this probably could be tightened up a bit
      cells = cells.concat(this._selectWithSize(cell));
    }
    this._bufferCells(cells);
  }

  _bufferCells(cells) {
    this.board.fgAdapter.clear();
    this.board.fgAdapter.stateBuffer.clear();
    cells.forEach((cell) => {
      this._setCells(cell);
    })
  }
}

class LocklineAction extends LineAction {
  move(ev) {
    this.b = this._getPointerCoord(ev);
    let x = this.b[0] - this.a[0];
    let y = this.b[1] - this.a[1];
    let h = this.length = this._getHypot(this.a, this.b);
    let a = Math.acos(x / h) / Hexular.math.hextant;
    if (Math.sin(y / h) < 0)
      a = 6 - a;
    let aRound = Math.round(a) % 6;
    let xRound = Math.cos(aRound * Hexular.math.hextant) * h;
    let yRound = Math.sin(aRound * Hexular.math.hextant) * h;
    this.b = [this.a[0] + xRound, this.a[1] + yRound];
    this.info = (this._hypotToModel(this.length) / 2).toFixed(2);
    this._calculateCells();
  }
}

class HexAction extends LineAction {
  _calculateCells() {
    let pixRad = this.length / this.board.scaleZoom;
    this.radius = Math.ceil(pixRad / (this.board.model.cellApothem * 2) + 0.5);
    let cells = Hexular.util.hexWrap(this.originCell, this.radius);
    let outline = cells.slice((-this.radius + 1) * 6);
    let expandedOutline = this._selectWithSize(outline);
    this._hexToBuffer(cells, expandedOutline);
  }
}

class HexFilledAction extends HexAction {
  _hexToBuffer(cells, expandedOutline) {
    this._bufferCells(cells.concat(expandedOutline));
  }
}

class HexOutlineAction extends HexAction {
  _hexToBuffer(cells, expandedOutline) {
    this._bufferCells(expandedOutline);
  }
}