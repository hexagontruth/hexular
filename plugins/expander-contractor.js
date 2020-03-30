class ExpanderContractor extends Plugin {

  defaultSettings() {
    return `
      {
        hexType: 1,
        minRadius: 0,
        baseRadius: 0.5,
        maxRadius: 1,
        pivot: 0.5,
        fill: true,
        stroke: false,
      }
    `;
  }
  activate() {
    const tau = Math.PI * 2;
    let deltaRadius, q, startR, contR, endR, opts;
    this.drawFn = (adapter) => {
      let min = this.settings.minRadius;
      let base = this.settings.baseRadius;
      let max = this.settings.maxRadius;
      let p = this.settings.pivot;
      let r = adapter.innerRadius;
      deltaRadius = this.settings.maxRadius - this.settings.minRadius;
      q = this.board.drawStepQ;
      contR = r * (base + (max - base) * (q > p ?  (1 - q) / (1 - p) : q / p));
      startR = r * Math.min(base, (base - min) * q / p + min);
      endR = r * Math.max(0, base - (base - min) * q / p);
      opts = {
        type: this.settings.hexType,
        fill: this.settings.fill,
        stroke: this.settings.stroke,
      };
    };
    this.drawCellFn = (cell, adapter) => {
      let color, r;
      if (cell.state) {
        color = adapter.fillColors[cell.state];
        r = cell.lastState ? contR : startR;
      }
      else if (cell.lastState) {
        color = adapter.fillColors[cell.lastState];
        r = endR;
      }
      else {
        return;
      }
      opts.fillStyle = color;
      opts.strokeStyle = color;
      adapter.drawHexagon(cell, r, opts);
    }
    this.bgAdapter.onDraw.push(this.drawFn);
    this.bgAdapter.onDrawCell.push(this.drawCellFn);
  }

  deactivate() {
    this.bgAdapter.onDraw.keep((e) => e != this.drawFn);
    this.bgAdapter.onDrawCell.keep((e) => e != this.drawCellFn);
  }
};
Board.registerPlugin(ExpanderContractor);
