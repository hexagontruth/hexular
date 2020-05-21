class TransferCanvas {
  constructor(board) {
    this.board = board;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.draw();
  }

  draw() {
    this.canvas.width = this.board.canvasWidth;
    this.canvas.height = this.board.canvasHeight;
    [this.board.bgCanvas, this.board.mainCanvas].forEach((canvas) => {
      this.ctx.drawImage(
        canvas,
        0, 0, canvas.width, canvas.height,
        0, 0, canvas.width, canvas.height
      );
    });
  }
}
