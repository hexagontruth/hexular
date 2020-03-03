(() => {
  let fn = () => {
    let adapter = Board.bgAdapter;
    let board = Board.instance;
    let model = Board.model;
    let config = Board.config;
    let ctx = adapter.context;
    config.setOnDrawCell(null);
    let TAU = Math.PI * 2;
    adapter.onDrawCell.replace([(cell) => {
      if (!cell.state)
        return;
      let step = board.drawStep;
      let m = step / config.drawStepInterval;
      let diff = cell.state - cell.lastState;
      let r = adapter.innerRadius;
      r = r * (1 + diff / 4 * m);
      let a = Math.PI / 3 * m * Math.sign(diff);
      let p = [];
      for (let i = 0; i < 6; i++) {
        let x = r * Math.cos(a + TAU / 6 * i);
        let y = r * Math.sin(a + TAU / 6 * i);
        p.push([x, y]);
      }
      adapter.drawPath(cell, p);
      ctx.fillStyle = adapter.fillColors[cell.state];
      ctx.fill();
    }]);
  };
  Board.instance.addHook('resize', fn);
  fn();
})();