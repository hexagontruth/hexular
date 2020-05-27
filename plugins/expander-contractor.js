class ExpanderContractor extends Plugin {
  defaultSettings() {
    return `
      {
        hexType: 1, // 0|1|2
        fadeIndex: 0, // 0-1
        fadeInclusive: false,
        minRadius: 0,
        baseRadius: 0.5,
        maxRadius: 1,
        fill: true,
        stroke: false,
        color: null,
        lineWidth: null,
        lineJoin: null,
        pivot: 0.5,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {

    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let min = this.settings.minRadius;
    let base = this.settings.baseRadius;
    let max = this.settings.maxRadius;
    let q = this.board.drawStepQInc;
    let pivot = this.getPivot(q, this.settings.pivot);
    let fadeQ = this.getFade(q);
    let r = this.config.innerRadius;
    let deltaRadius = this.settings.maxRadius - this.settings.minRadius;
    let contR = r * (base + (max - base) * pivot);
    let startR = r * (min + (base - min) * q);
    let endR = r * (base - (base - min) * q);
    let opts = {
      type: this.settings.hexType,
      fill: this.settings.fill,
      stroke: this.settings.stroke,
      lineWidth: this.settings.lineWidth != null ? this.settings.lineWidth : this.config.cellBorderWidth,
      lineJoin: this.settings.lineJoin || this.config.defaultJoin,
    };

    let fillColors = this.config.fillColors.slice();
    let strokeColors = this.config.strokeColors.slice();
    if (this.settings.color) {
      fillColors.fill(Color(this.settings.color));
      strokeColors.fill(Color(this.settings.color));
    }

    // Draw
    this.drawEachCell((cell) => {
      let r;
      let allowed = this.isAllowedState(cell.state);
      let lastAllowed = this.isAllowedState(cell.lastState);
      if (allowed) {
        opts.fillStyle = fillColors[cell.state] || Color.t;
        opts.strokeStyle = strokeColors[cell.state] || Color.t;
        r = lastAllowed ? contR : startR;
        if (fadeQ < 1 && (lastAllowed || this.settings.fadeInclusive)) {
          opts.fillStyle = opts.fillStyle.blend(fillColors[cell.lastState], fadeQ);
          opts.strokeStyle = opts.strokeStyle.blend(strokeColors[cell.lastState], fadeQ);
        }
      }
      else if (lastAllowed) {
        r = endR;
        if (this.settings.fadeInclusive) {
          opts.fillStyle = fillColors[cell.state] || Color.t;
          opts.strokeStyle = strokeColors[cell.state] || Color.t;
          if (fadeQ < 1) {
            opts.fillStyle = opts.fillStyle.blend(fillColors[cell.lastState], fadeQ);
            opts.strokeStyle = opts.strokeStyle.blend(strokeColors[cell.lastState], fadeQ);
          }
        }
        else {
          opts.fillStyle = fillColors[cell.lastState] || Color.t;
          opts.strokeStyle = strokeColors[cell.lastState] || Color.t;
        }
      }
      else {
        return;
      }
      adapter.drawShape(cell, r, opts);
    });
  }
}
Board.registerPlugin(ExpanderContractor);
