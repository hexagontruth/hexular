class RotatorExpander extends Plugin {

  defaultSettings() {
    return `
      {
        direction: 1,
        hexType: 1,
        angleDelta: Math.PI / 3,
        radiusDelta: 0.25,
      }
    `;
  }
  activate() {
    const tau = Math.PI * 2;
    let direction, typeOffset, angle;
    this.drawFn = (adapter) => {
      direction = this.settings.direction;
      typeOffset = this.settings.hexType ? tau / 12 : 0;
      angle = this.settings.angleDelta * this.board.drawStepQ;
    };
    this.drawCellFn = (cell, adapter) => {
      if (!cell.state)
        return;
      let step = this.board.drawStep;
      let q = this.board.drawStepQ;
      let diff = cell.state - cell.lastState;
      let r = adapter.innerRadius;
      r = r * (1 + diff * this.settings.radiusDelta * q);
      let a = angle * Math.sign(diff * this.settings.direction);
      let p = [];
      for (let i = 0; i < 6; i++) {
        let x = r * Math.cos(a + tau / 6 * i + typeOffset);
        let y = r * Math.sin(a + tau / 6 * i + typeOffset);
        p.push([x, y]);
      }
      adapter.drawPath(cell, p);
      adapter.context.fillStyle = adapter.fillColors[cell.state];
      adapter.context.fill();
    };
    this.bgAdapter.onDraw.push(this.drawFn);
    this.bgAdapter.onDrawCell.push(this.drawCellFn);
  }

  deactivate() {
    this.bgAdapter.onDraw.keep((e) => e != this.drawFn);
    this.bgAdapter.onDrawCell.keep((e) => e != this.drawCellFn);
  }
};
Board.registerPlugin(RotatorExpander);
