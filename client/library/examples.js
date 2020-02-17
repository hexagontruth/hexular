const Examples = (() => {
  function triangleFactory(cb) {
    return () => {
      Board.instance.bgAdapter.onDrawCell.push(function(cell) {
        if (!cell.state)
          return;
        let slice = cell.with[6].nbrSlice;
        for (let i = 0; i < 5; i++) {
          let n1 = slice[i];
          let n2 = slice[(i + 1) % 6];
          if (n1.state && n2.state && !n1.edge && !n2.edge) {
            this.context.beginPath();
            this.context.moveTo(...this.model.cellMap.get(cell));
            this.context.lineTo(...this.model.cellMap.get(n1));
            this.context.lineTo(...this.model.cellMap.get(n2));
            this.context.closePath();
            cb(this.context, cell, n1, n2);
          }
        }
      });
      Board.instance.draw();
    }
  }

  let examples = {
    triangleFactory,

    maxFilledTriangle: triangleFactory((ctx, cell, n1, n2) => {
      let state = Math.max(cell.state, n1.state, n2.state);
      ctx.fillStyle = Board.instance.bgAdapter.colors[state];
      ctx.fill();
    }),

    minFilledTriangle: triangleFactory((ctx, cell, n1, n2) => {
      let state = Math.min(cell.state, n1.state, n2.state);
      ctx.fillStyle = Board.instance.bgAdapter.colors[state];
      ctx.fill();
    }),

    maxOutlineTriangle: triangleFactory((ctx, cell, n1, n2) => {
      let state = Math.max(cell.state, n1.state, n2.state);
      ctx.strokeStyle = Board.instance.bgAdapter.colors[state];
      ctx.lineWidth = Board.config.cellBorderWidth;
      ctx.lineJoin = "round";
      ctx.stroke();
    }),

    minOutlineTriangle: triangleFactory((ctx, cell, n1, n2) => {
      let state = Math.min(cell.state, n1.state, n2.state);
      ctx.strokeStyle = Board.instance.bgAdapter.colors[state];
      ctx.lineWidth = Board.config.cellBorderWidth;
      ctx.lineJoin = "round";
      ctx.stroke();
    }),
  }

  return examples;
})();