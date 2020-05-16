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
    this.registerAdapterHook(this.bgAdapter.onDraw, (adapter) => this.onDraw(adapter));
  }

  updateColors() {
    this.fillColors = this.bgAdapter.fillColors.map((e) => Util.styleToVcolor(e));
    this.board.draw();
  }

  drawCube(cell, r, flipOffset=1, state='state') {
    let adapter = this.bgAdapter;
    let ctx = adapter.context;
    let colors = this.config.fillColors;
    let verts = Hexular.math.pointyVertices;
    for (let i = 0; i < 6; i += 2) {
      let n0 = cell.nbrs[(i + flipOffset - 1) % 6 + 1];
      let n1 = cell.nbrs[(i + flipOffset) % 6 + 1];
      let v1 = Hexular.math.scalarOp(verts[(i + 2 + flipOffset) % 6], r);
      let v2 = Hexular.math.scalarOp(verts[(i + 3 + flipOffset) % 6], r);
      let v3 = Hexular.math.scalarOp(verts[(i + 4 + flipOffset) % 6], r);
      adapter.drawPath(cell, [[0, 0], v1, v2, v3]);
      let stateColors = [
        colors[cell[state]] || Color.t,
        colors[n0[state]] || Color.t,
        colors[n1[state]] || Color.t,
      ];
      adapter.fillColor = Color.blend(...stateColors);
      ctx.fill();
    }
  }

  onDraw(adapter) {
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
      let allowed = this.isAllowedState(cell.state);
      let lastAllowed = this.isAllowedState(cell.lastState);
      if (lastAllowed) {
        if (!allowed && this.settings.drawTerminal) {
          this.drawCube(cell, invRadius, flipOffset, 'lastState');
        }
        else if (allowed && this.settings.drawLast) {
          this.drawCube(cell,  adapter.innerRadius, flipOffset, 'lastState');
        }
      }
      if (allowed && this.settings.drawCurrent) {
        this.drawCube(cell, radius, flipOffset);
      }
    });
  }
}
Board.registerPlugin(CubicExpander);
