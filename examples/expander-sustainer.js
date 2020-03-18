(() => {
  let fn = () => {
    let adapter = Board.bgAdapter;
    let board = Board.instance;
    let model = Board.model;
    let config = Board.config;
    let ctx = adapter.context;
    config.meta.hexType = config.meta.hexType != null ? config.meta.hexType : Hexular.enums.TYPE_POINTY;
    config.meta.lines = config.meta.lines != null ? config.meta.lines : true;
    config.setOnDrawCell(null);
    let TAU = Math.PI * 2;
    // This system made sense once but is now dumb
    model.eachCell((cell) => {
      [cell.x, cell.y] = model.cellMap.get(cell);
    });
    adapter.onDrawCell.replace([
      (cell) => {
        if (cell.state && config.meta.lines && !cell.edge) {
          ctx.save();
          let q = board.drawStepQ * 1;
          q = q > 0.5 ? 1 - q : q;
          ctx.globalAlpha = Math.min(1, q * 4);
          ctx.fillStyle = adapter.strokeColors[cell.state];
          let [x, y] = model.cellMap.get(cell);
          for (let i = 0; i < 6; i++) {
            let n0 = cell.nbrs[i + 1];
            let n1 = cell.nbrs[(i + 1) % 6 + 1];
            if (n0.state && n0.state <= cell.state) {
              ctx.beginPath();
              ctx.moveTo(x, y);
              let xn = n0.x;
              let yn = n0.y;
              let x0 = (x + xn) / 2;
              let y0 = (y + yn) / 2;
              let x1 = n1.x;
              let y1 = n1.y;
              let xa = x1 * q + x0 * (1 - q);
              let ya = y1 * q + y0 * (1 - q);
              ctx.quadraticCurveTo(xa, ya, xn, yn);
              xa = (xa + x0) / 2;
              ya = (ya + y0) / 2;
              ctx.quadraticCurveTo(xa, ya, x, y);
              ctx.fill();
            }
          }
          ctx.restore();
        }
      },
      (cell) => {
        let step = board.drawStep;
        let q = board.drawStepQ;
        if (cell.lastState) {
          let color = adapter.fillColors[cell.lastState];
          let r = cell.state ? adapter.innerRadius : adapter.innerRadius * (1 - q);
          adapter.drawHexagon(cell, r, {type: config.meta.hexType, fill: true, fillStyle: color});
        }
        if (cell.state) {
          let color = adapter.fillColors[cell.state];
          let r = adapter.innerRadius * q;
          adapter.drawHexagon(cell, r, {type: config.meta.hexType, fill: true, fillStyle: color});
        }
      },
    ]);
  };
  Board.instance.addHook('resize', fn);
  fn();
})();