class CubicExpander extends Plugin {
  defaultSettings() {
    return `
      {
        drawCubes: true,
        drawLastCubes: true,
        drawTerminalCubes: true,
        drawLines: true,
        lineAlpha: true,
        lineCurveCoef: 0.5,
        lineCurveDiff: 0.75,
        drawCircles: true,
        minRadius: 0,
        maxRadius: 1,
        maxCircleRadius: 0.5,
        fill: true,
        stroke: false,
      }
    `;
  }

  activate() {
    const tau = Math.PI * 2;
    let model = this.model;
    let board = this.board;
    let adapter = this.bgAdapter;
    let ctx = adapter.context;
    let radius, invRadius, q, pivotQ, lineAlpha;
    let fillColors = adapter.fillColors.map((e) => adapter.styleToVcolor(e));
    let strokeColors = adapter.strokeColors.map((e) => adapter.styleToVcolor(e));
    let verts = Hexular.math.pointyVertices;
    let drawCube = (cell, r, state='state') => {
      for (let i = 0; i < 6; i += 2) {
        let n0 = cell.nbrs[i + 1];
        let n1 = cell.nbrs[(i + 1) % 6 + 1];
        let v1 = Hexular.math.scalarOp(verts[(i + 3) % 6], r);
        let v2 = Hexular.math.scalarOp(verts[(i + 4) % 6], r);
        let v3 = Hexular.math.scalarOp(verts[(i + 5) % 6], r);
        adapter.drawPath(cell, [[0, 0], v1, v2, v3]);
        let cols = [fillColors[cell[state]], fillColors[n0[state]], fillColors[n1[state]]];
        if (this.settings.fill) {
          ctx.fillStyle =
            adapter.vcolorToHex(adapter.mergeVcolors(adapter.mergeVcolors(cols[0], cols[1]), cols[2], 0.67));
          ctx.fill();
        }
      }
    };
    this.drawFn = (adapter) => {
      let min = this.settings.minRadius;
      let max = this.settings.maxRadius;
      let r = adapter.innerRadius;  
      let q = this.board.drawStepQ;
      radius = r * ((max - min) * q + min);
      invRadius = r * ((max - min) * (1 - q) + min);
      pivotQ = (q > 0.5 ? 1 - q : q) * 2;
      lineAlpha = this.config.lineAlpha ? Math.min(1, q * 4) : 1;
    };
    this.drawCellLines = (cell, adapter) => {
      if (cell.state && this.settings.drawLines && !cell.edge) {
        ctx.save();
        ctx.globalAlpha = lineAlpha;
        ctx.fillStyle = adapter.strokeColors[cell.state];
        let lineCurve = this.settings.lineCurveCoef * pivotQ;
        let lineCurveDiff = this.settings.lineCurveDiff;
        let lineCurveDiffInv = (1 - this.settings.lineCurveDiff);
        let [x, y] = model.cellMap.get(cell);
        for (let i = 0; i < 6; i++) {
          let n0 = cell.nbrs[i + 1];
          let n1 = cell.nbrs[(i + 1) % 6 + 1];
          if (n0.state && n0.state <= cell.state) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            let [xn, yn] = model.cellMap.get(n0);
            let x0 = (x + xn) / 2;
            let y0 = (y + yn) / 2;
            let [x1, y1] = model.cellMap.get(n1);
            let xa = x1 * lineCurve + x0 * (1 - lineCurve);
            let ya = y1 * lineCurve + y0 * (1 - lineCurve);
            ctx.quadraticCurveTo(xa, ya, xn, yn);
            xa = xa * lineCurveDiff + x0 * lineCurveDiffInv;
            ya = ya * lineCurveDiff + y0 * lineCurveDiffInv;
            ctx.quadraticCurveTo(xa, ya, x, y);
            ctx.fill();
          }
        }
        if (this.settings.drawCircles) {
          ctx.beginPath();
          ctx.arc(x, y, adapter.innerRadius * pivotQ * this.settings.maxCircleRadius, 0, Hexular.math.tau);
          ctx.fill();
        }
        ctx.restore();
      }
    };
    this.drawCellHex = (cell, adapter) => {
      if (cell.lastState) {
        if (cell.state && this.settings.drawLastCubes) {
          drawCube(cell,  adapter.innerRadius, 'lastState');
        }
        else if (this.settings.drawTerminalCubes) {
          drawCube(cell, invRadius, 'lastState');
        }
        
      }
      if (cell.state && this.settings.drawCubes) {
        drawCube(cell, radius);
      }
    };
    this.bgAdapter.onDraw.push(this.drawFn);
    this.bgAdapter.onDrawCell.push(this.drawCellLines);
    this.bgAdapter.onDrawCell.push(this.drawCellHex);
  }

  deactivate() {
    this.bgAdapter.onDraw.keep((e) => e != this.drawFn);
    this.bgAdapter.onDrawCell.keep((e) => e != this.drawCellLines);
    this.bgAdapter.onDrawCell.keep((e) => e != this.drawCellHex);
  }
};
Board.registerPlugin(CubicExpander);
