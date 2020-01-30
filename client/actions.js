class Action {
  constructor(board) {
    this.board = board;
    this.coords = [];
    this.lastSet = null;
  }

  setCell(cell) {
    if (cell && cell != this.lastSet) {
      cell.state = this.shift ? 0 : this.setState;
      this.lastSet = cell;
      adapter.selectCell();
      adapter.drawCell(cell);
    }
  }

  end() {}

  _getCoord(ev) {
    let x, y;
    if (ev.pageX)
      [x, y] = [ev.pageX, ev.pageY];
    else if (ev.touches && ev.touches[0])
      [x, y] = [ev.touches[0].pageX , ev.touches[0].pageY];
    return [x, y];
  }
}

class PaintAction extends Action {
  start(ev, ...args) {
    this.setState = (this.board.selected.state + 1) % this.board.numStates;
    Object.assign(this, ...args);
    if (ev.ctrlKey) this.setState = this.board.groundState;
    this.setCell(this.board.selected);
  }

  move() {
    this.setCell(this.board.selected);
  }

  end() {
    this.board.storeState();
  }
}

class MoveAction extends Action {
  start(ev, ...args) {
    this.startEv = ev;
    this.coords = [this._getCoord(ev)];
  }
  move(ev) {
    this.coords.push(this._getCoord(ev));
    let [last, cur] = this.coords.slice(-2);
    let diffX = cur[0] - last[0];
    let diffY = cur[1] - last[1];
    this.board.translate([diffX, diffY]);
  }
}