class Action {
  constructor(board, ...args) {
    Object.assign(this, {board}, ...args);
    this.coords = [];
    this.lastSet = null;
    this.board.fgAdapter.clear();
  }

  start() {}
  move() {}
  end() {}

  _setCell(cell) {
    if (cell) {
      this.lastSet = cell;
      this.board.fgAdapter.stateBuffer.set(cell, this.setState)
      this.board.fgAdapter.defaultDrawBuffer(cell);
    }
  }

  _applyBuffer() {
    this.board.fgAdapter.stateBuffer.forEach((state, cell) => {
      cell.state = state;
    });
    this.board.fgAdapter.stateBuffer.clear();
    this.board.fgAdapter.clear();
    this.board.bgAdapter.draw();
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
    return this.hypot(t0, t1);
  }
}

class PaintAction extends Action {
  constructor(...args) {
    super(...args);
    if (!this.setState)
      this.setState = (this.board.selected.state + 1) % this.board.numStates;
    if (this.ctrl)
      this.setState = this.board.model.groundState;
  }

  end() {
    this._applyBuffer();
    this.board.storeState();
  }
}

class BrushAction extends PaintAction {
  start(evs) {
    this._setCell(this.board.selected);
  }

  move(ev) {
    this._setCell(this.board.selected);
  }
}

class LineAction extends PaintAction {
  start(ev) {
    this.a = this.b = this._getPointerCoord(ev);
    this.originCell = this.board.selected;
    this._calculateCells();
  }

  move(ev) {
    this.b = this._getPointerCoord(ev);
    this._calculateCells();
  }

  _calculateCells() {
    let samples = this._getHypot(this.a, this.b) / (this.board.model.cellRadius);
    let [x, y] = this.a.slice();
    let xSample = (this.b[0] - this.a[0]) / samples;
    let ySample = (this.b[1] - this.a[1]) / samples;
    let cells = [this.originCell];
    for (let i = 1; i < samples; i++) {
      x += xSample;
      y += ySample;
      let cell = this.board.cellAt([x, y]);
      // We don't actually care about dups
      cells.push(cell);
    }
    this._bufferCells(cells);
  }

  _bufferCells(cells) {
    this.board.fgAdapter.clear();
    this.board.fgAdapter.stateBuffer.clear();
    cells.forEach((cell) => {
      this._setCell(cell);
    })
  }
}

class HexAction extends LineAction {
  _calculateCells() {
    let pixRad = this._getHypot(this.a, this.b);
    this.radius = Math.ceil(pixRad / (this.board.model.apothem * 2) + 0.5);
    let cells = Hexular.util.hexWrap(this.originCell, this.radius);
    this._hexToBuffer(cells);
  }
}

class HexFilledAction extends HexAction {
  _hexToBuffer(cells) {
    this._bufferCells(cells);
  }
}

class HexOutlineAction extends HexAction {
  _hexToBuffer(cells) {
    this._bufferCells(cells.slice((-this.radius + 1) * 6));
  }
}