class CubicExpander extends Plugin {
  defaultSettings() {
    return `
      {
        drawCubes: true,
        drawLastCubes: true,
        drawTerminalCubes: true,
        minRadius: 0,
        maxRadius: 1,
        flip: false,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: null,
      }
    `;
  }

  _activate() {
    const tau = Math.PI * 2;
    let model = this.model;
    let board = this.board;
    let adapter = this.bgAdapter;
    let ctx = adapter.context;
    let radius, invRadius, q, flipOffset;
    let fillColors, strokeColors;
    let t = [127, 127, 127, 0];
    let verts = Hexular.math.pointyVertices;

    let drawCube = (cell, r, state='state') => {
      for (let i = 0; i < 6; i += 2) {
        let n0 = cell.nbrs[(i + flipOffset - 1) % 6 + 1];
        let n1 = cell.nbrs[(i + flipOffset) % 6 + 1];
        let v1 = Hexular.math.scalarOp(verts[(i + 2 + flipOffset) % 6], r);
        let v2 = Hexular.math.scalarOp(verts[(i + 3 + flipOffset) % 6], r);
        let v3 = Hexular.math.scalarOp(verts[(i + 4 + flipOffset) % 6], r);
        adapter.drawPath(cell, [[0, 0], v1, v2, v3]);
        let cols = [
          fillColors[cell[state]] || t,
          fillColors[n0[state]] || t,
          fillColors[n1[state]] || t,
        ];
        ctx.fillStyle =
          Util.vcolorToHex(Util.mergeVcolors(Util.mergeVcolors(cols[0], cols[1]), cols[2], 0.67));
        ctx.fill();
      }
    };
    this.updateColors = () => {
      fillColors = adapter.fillColors.map((e) => Util.styleToVcolor(e));
      strokeColors = adapter.strokeColors.map((e) => Util.styleToVcolor(e));
    };
    this.drawFn = (adapter) => {
      this.setStateLists();
      let min = this.settings.minRadius;
      let max = this.settings.maxRadius;
      let r = adapter.innerRadius;  
      let q = this.board.drawStepQInc;
      radius = r * ((max - min) * q + min);
      invRadius = r * ((max - min) * (1 - q) + min);
      flipOffset = 1 + this.settings.flip;
    };
    this.drawCellFn = (cell, adapter) => {
      if (!this._isAllowedState(cell.state)) return;
      ctx.save();
      ctx.globalCompositeOperation = this.settings.blendMode;
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
      ctx.restore();
    };
    this.updateColors();
    this.registerBoardHook('updateTheme', this.updateColors);
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
    this.registerAdapterHook(this.bgAdapter.onDrawCell, this.drawCellFn);
  }
};
Board.registerPlugin(CubicExpander);
