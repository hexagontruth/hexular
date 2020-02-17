class TransferCanvas {
  constructor(board) {
    this.board = board;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.draw();
  }

  draw() {
    this.ctx.drawImage(
      this.board.bg,
      0, 0, this.board.bg.width, this.board.bg.height,
      0, 0, this.canvas.width, this.canvas.height
    );
  }
}