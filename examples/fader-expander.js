(() => {
  let fn = () => {
    let adapter = Board.bgAdapter;
    let board = Board.instance;
    let model = Board.model;
    let config = Board.config;
    let ctx = adapter.context;
    config.meta.hexType = config.meta.hexType != null ? config.meta.hexType : Hexular.enums.TYPE_POINTY;
    config.setOnDrawCell(null);
    let TAU = Math.PI * 2;
    // Preprocess colors - only works with RGB hex values
    let transparent = [127, 127, 127, 0];
    let colors = adapter.fillColors.map((str) => {
      let color = transparent.slice();
      if (str[0] == '#') {
        let hex = str.slice(1);
        if (hex.length == 3 || hex.length == 4) {
          hex = hex.split('').map((e) => e.repeat(2)).join('');
        }
        if (hex.length == 6) {
          hex += 'ff';
        }
        if (hex.length == 8) {
          for (let i = 0; i < 4; i++) {
            color[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
          }
        }
      }
      return color;
    });
    let mergeColor = (c0, c1, q=0.5) => {
      let color = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++) {
        color[i] = Math.round(c0[i] * q + c1[i] * (1 - q));
      }
      return color;
    };

    let getHex = (color) => '#' + color.map((e) => ('0' + e.toString(16)).slice(-2)).join('');
    adapter.onDrawCell.replace([
      (cell) => {
        let step = board.drawStep;
        let q = board.drawStep / (config.drawStepInterval - 1 || board.drawStep || 1);
        let diff = cell.state - cell.lastState;
        let curColor = colors[cell.state];
        let lastColor = colors[cell.lastState];
        let color;
        cell.r = adapter.innerRadius;
        cell.q = q;
        if (cell.state) {
          cell.r *= (0.5 + q / 2);
          color = mergeColor(curColor, lastColor, q);
        }
        else if (cell.lastState) {
          cell.r *= (1 - q);
          color = mergeColor(transparent, lastColor, q);
        }
        else {
          return;
        }
        cell.color = getHex(color);
      },
      (cell) => {
        if (cell.color) {
          let step = board.drawStep;
          let diff = cell.state - cell.lastState;
          let r = cell.r;
          adapter.drawHexagon(cell, r, {type: config.meta.hexType, fill: true, fillStyle: cell.color});
        }
        cell.color = null;
      },
    ]);
  };
  Board.instance.addHook('resize', fn);
  fn();
})();