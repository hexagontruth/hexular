class CubicExpander extends Plugin {
  defaultSettings() {
    return `
      {
        drawCurrent: true,
        drawLast: true,
        drawTerminal: true,
        minRadius: 0,
        maxRadius: 1,
        flip: false,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {
    let adapter = this.bgAdapter;
    let ctx = adapter.context;
    let flipOffset = 1;
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
      this.board.draw();
    };
    this.drawFn = (adapter) => {
      // Setup
      let min = this.settings.minRadius;
      let max = this.settings.maxRadius;
      let r = adapter.innerRadius;  
      let q = this.board.drawStepQInc;
      let radius = r * ((max - min) * q + min);
      let invRadius = r * ((max - min) * (1 - q) + min);
      let flipOffset = 1 + this.settings.flip;

      // Draw
      this.drawEachCell((cell) => {
        let allowed = this._isAllowedState(cell.state);
        let lastAllowed = this._isAllowedState(cell.lastState);
        if (lastAllowed) {
          if (!allowed && this.settings.drawTerminal) {
            drawCube(cell, invRadius, 'lastState');
          }
          else if (allowed && this.settings.drawLast) {
            drawCube(cell,  adapter.innerRadius, 'lastState');
          }
        }
        if (allowed && this.settings.drawCurrent) {
          drawCube(cell, radius);
        }
      });
    };

    this.updateColors();
    this.registerBoardHook('updateTheme', this.updateColors);
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
  }
};
Board.registerPlugin(CubicExpander);
