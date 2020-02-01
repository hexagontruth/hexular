class Action {
  constructor(board) {
    this.board = board;
    this.coords = [];
    this.lastSet = null;
    this.board.fgAdapter.clear();
  }

  start() {}
  move() {}
  end() {}

  _setCell(cell) {
    if (cell && cell != this.lastSet) {
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
}

class PaintAction extends Action {
  start(ev, ...args) {
    this.setState = (this.board.selected.state + 1) % this.board.numStates;
    Object.assign(this, ...args);
    if (ev.ctrlKey) this.setState = this.board.groundState;
    this._setCell(this.board.selected);
  }

  move(ev) {
    this._setCell(this.board.selected);
  }

  end() {
    this._applyBuffer();
    this.board.storeState();
  }
}

class MoveAction extends Action {
  start(ev, ...args) {
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
    this.hypot = this._getHypot(ev);
  }
  move(ev) {
    let newHypot = this._getHypot(ev);
    this.board.scale(newHypot / this.hypot);
    this.hypot = newHypot;
  }
  _getHypot(ev) {
    let t0 = this._getCoord(ev.touches[0]);
    let t1 = this._getCoord(ev.touches[1]);
    return Math.hypot(t1[0] - t0[0], t1[1] - t0[1]);
  }
}