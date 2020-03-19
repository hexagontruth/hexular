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
    let drawCube = (cell, r, state='state') => {
      for (let i = 0; i < 6; i += 2) {
        let n0 = cell.nbrs[i + 1];
        let n1 = cell.nbrs[(i + 1) % 6 + 1];
        let v1 = Hexular.math.scalarOp(verts[(i + 3) % 6], r);
        let v2 = Hexular.math.scalarOp(verts[(i + 4) % 6], r);
        let v3 = Hexular.math.scalarOp(verts[(i + 5) % 6], r);
        adapter.drawPath(cell, [[0, 0], v1, v2, v3]);
        let cols = [colors[cell[state]], colors[n0[state]], colors[n1[state]]];
        ctx.fillStyle = getHex(mergeColor(mergeColor(cols[0], cols[1]), cols[2], 0.67));
        ctx.fill();
      }
    };
    // This system made sense once but is now dumb
    model.eachCell((cell) => {
      [cell.x, cell.y] = model.cellMap.get(cell);
    });
    let verts = Hexular.math.pointyVertices;
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
              xa = xa  * 0.75 + x0 * 0.25;
              ya = ya * 0.75 + y0 * 0.25;
              ctx.quadraticCurveTo(xa, ya, x, y);
              ctx.arc(x, y, adapter.innerRadius * q / 2, 0, Hexular.math.tau);
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
          let r = cell.state ? adapter.innerRadius : adapter.innerRadius * (1 - q);
          drawCube(cell, r, 'lastState');
        }
        if (cell.state) {
          let color = adapter.fillColors[cell.state];
          let r = adapter.innerRadius * q;
          drawCube(cell, r);
        }
      },
    ]);
  };
  Board.instance.addHook('resize', fn);
  fn();
})();