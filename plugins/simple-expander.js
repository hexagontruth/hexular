class SimpleExpander extends Plugin {
  defaultSettings() {
    return `
      {
        hexType: 1,
        drawLast: true,
        drawTerminal: true,
        minRadius: 0,
        maxRadius: 1,
        fill: true,
        stroke: false,
        lineWidth: null,
      }
    `;
  }

  activate() {
    const tau = Math.PI * 2;
    let model = this.model;
    let board = this.board;
    let adapter = this.bgAdapter;
    let ctx = adapter.context;
    let radius, invRadius, q, opts;
    let fillColors = adapter.fillColors.map((e) => adapter.styleToVcolor(e));
    let strokeColors = adapter.strokeColors.map((e) => adapter.styleToVcolor(e));
    this.drawFn = (adapter) => {
      let min = this.settings.minRadius;
      let max = this.settings.maxRadius;
      let r = adapter.innerRadius;  
      let q = this.board.drawStepQ;
      radius = r * ((max - min) * q + min);
      invRadius = r * ((max - min) * (1 - q) + min);
      opts = {
        type: this.settings.hexType,
        fill: this.settings.fill,
        stroke: this.settings.stroke,
        lineWidth: this.settings.lineWidth != null ? this.settings.lineWidth : adapter.cellBorderWidth,
      };
    };
    this.drawCellFn = (cell, adapter) => {
      let fill, stroke;
      if (cell.lastState) {
        opts.fillStyle = adapter.fillColors[cell.lastState];
        opts.strokeStyle = adapter.strokeColors[cell.lastState];
        if (cell.state && this.settings.drawLast) {
          adapter.drawHexagon(cell,  adapter.innerRadius, opts);
        }
        else if (this.settings.drawTerminal) {
          adapter.drawHexagon(cell, invRadius, opts);
        }
        
      }
      if (cell.state) {
        opts.fillStyle = adapter.fillColors[cell.state];
        opts.strokeStyle = adapter.strokeColors[cell.state];
        adapter.drawHexagon(cell, radius, opts);
      }
    };
    this.bgAdapter.onDraw.push(this.drawFn);
    this.bgAdapter.onDrawCell.push(this.drawCellFn);
  }

  deactivate() {
    this.bgAdapter.onDraw.keep((e) => e != this.drawFn);
    this.bgAdapter.onDrawCell.keep((e) => e != this.drawCellFn);
  }
};
Board.registerPlugin(SimpleExpander);
