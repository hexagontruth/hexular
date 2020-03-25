(() => {
  let fn = () => {
    let adapter = Board.bgAdapter;
    let board = Board.instance;
    let model = Board.model;
    let config = Board.config;
    let ctx = adapter.context;
    config.meta.hexType = config.meta.hexType != null ? config.meta.hexType : Hexular.enums.TYPE_POINTY;
    config.meta.baseRadius = config.meta.baseRadius != null ? config.meta.baseRadius : 0.5;
    config.setOnDrawCell(null);
    let TAU = Math.PI * 2;
    adapter.onDrawCell.replace([(cell) => {
      let color;
      let step = board.drawStep;
      let q = board.drawStepQ;
      let r = adapter.innerRadius;
      if (cell.state) {
        color = adapter.fillColors[cell.state];
        if (cell.lastState) {
          if (q > 0.5)
            q = 1 - q;
          r = r * (config.meta.baseRadius + q);
        }
        else {
          r = r * Math.max(0, config.meta.baseRadius - 1 + q);
        }
      }
      else if (cell.lastState) {
        color = adapter.fillColors[cell.lastState];
        r = r * Math.max(0, config.meta.baseRadius - q);
      }
      else {
        return;
      }      
      adapter.drawHexagon(cell, r, {type: config.meta.hexType, fill: true, fillStyle: color});
    }]);
  };
  Board.instance.addHook('resize', fn);
  fn();
})();