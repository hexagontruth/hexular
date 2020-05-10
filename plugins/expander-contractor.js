class ExpanderContractor extends Plugin {
  defaultSettings() {
    return `
      {
        hexType: 1, // 0|1|2
        minRadius: 0,
        baseRadius: 0.5,
        maxRadius: 1,
        fill: true,
        stroke: false,
        color: null,
        lineWidth: null,
        pivot: 0.5,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {
    this.drawFn = (adapter) => {
      // Setup
      let ctx = adapter.context;
      let min = this.settings.minRadius;
      let base = this.settings.baseRadius;
      let max = this.settings.maxRadius;
      let q = this.board.drawStepQInc;
      let pivot = this._getPivot(q, this.settings.pivot);
      let r = adapter.innerRadius;
      let deltaRadius = this.settings.maxRadius - this.settings.minRadius;
      let contR = r * (base + (max - base) * pivot);
      let startR = r * (min + (base - min) * q);
      let endR = r * (base - (base - min) * q);
      let opts = {
        type: this.settings.hexType,
        fill: this.settings.fill,
        stroke: this.settings.stroke,
        lineWidth: this.settings.lineWidth != null ? this.settings.lineWidth : adapter.cellBorderWidth,
      };
      let fillColors = adapter.fillColors.slice();
      let strokeColors = adapter.strokeColors.slice();
      if (this.settings.color) {
        fillColors.fill(this.settings.color);
        strokeColors.fill(this.settings.color);
      }

      // Draw
      this.drawEachCell((cell) => {
        let r;
        let allowed = this._isAllowedState(cell.state);
        let lastAllowed = this._isAllowedState(cell.lastState);
        if (allowed) {
          opts.fillStyle = fillColors[cell.state];
          opts.strokeStyle = strokeColors[cell.state];
          r = lastAllowed ? contR : startR;
        }
        else if (lastAllowed) {
          opts.fillStyle = fillColors[cell.lastState];
          opts.strokeStyle = strokeColors[cell.lastState];
          r = endR;
        }
        else {
          return;
        }
        adapter.drawHexagon(cell, r, opts);
      });
    };
    this.registerAdapterHook(this.bgAdapter.onDraw, this.drawFn);
  }
};
Board.registerPlugin(ExpanderContractor);
