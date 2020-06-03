class ExpanderContractor extends Plugin {
  defaultSettings() {
    return `
      {
        shapeType: Hexular.enums.TYPE_POINTY,
        fadeIndex: 0, // 0-1
        fadeInclusive: false,
        minRadius: 0,
        baseRadius: 0.5,
        maxRadius: 1,
        radiusPivot: 0.5,
        minAlpha: 1,
        baseAlpha: 1,
        maxAlpha: 1,
        alphaPivot: 0.5,
        minAngle: 0,
        baseAngle: 0,
        maxAngle: 0,
        anglePivot: 0.5,
        fill: true,
        stroke: false,
        color: null,
        lineWidth: null,
        lineJoin: null,
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
    let {
      shapeType, fadeInclusive, minRadius, baseRadius, maxRadius, radiusPivot,
      minAlpha, baseAlpha, maxAlpha, alphaPivot, minAngle, baseAngle, maxAngle, anglePivot,
      fill, stroke, color, lineWidth, lineJoin, blendMode
    } = this.settings;
    let q = this.board.drawStepQInc;
    let radiusQ = this.getPivot(q, radiusPivot);
    let alphaQ = this.getPivot(q, alphaPivot);
    let angleQ = this.getPivot(q, anglePivot);
    let fadeQ = this.getFade(q);
    let r = this.config.innerRadius;
    let deltaRadius = this.settings.maxRadius - this.settings.minRadius;
    let contR = r * (baseRadius + (maxRadius - baseRadius) * radiusQ);
    let startR = r * (minRadius + (baseRadius - minRadius) * q);
    let endR = r * (baseRadius - (baseRadius - minRadius) * q);
    let contA = baseAlpha + (maxAlpha - baseAlpha) * alphaQ;
    let startA = minAlpha + (baseAlpha - minAlpha) * q;
    let endA = baseAlpha - (baseAlpha - minAlpha) * q;
    let contP, startP, endP;
    if (this.settings.shapeType != Hexular.enums.TYPE_CIRCLE) {
      let {cos, sin} = Math;
      let path = adapter.shapes[this.settings.shapeType];
      path = path != null ? path : adapter.shapes[Hexular.enums.TYPE_POINTY];
      let contT = baseAngle + (maxAngle - baseAngle) * angleQ;
      let startT = minAngle + (baseAngle - minAngle) * q;
      let endT = baseAngle - (baseAngle - minAngle) * q;
      [contP, startP, endP] = [contT, startT, endT].map((t) => {
        let matrix = Hexular.math.rotationMatrix(t);
        return path.map((e) => Hexular.math.matrixMult(matrix, e));
      });
    }
    let opts = {
      path: null,
      type: this.settings.shapeType,
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
        if (lastAllowed) {
          r = contR;
          opts.path = contP;
          opts.alpha = contA;
        }
        else {
          r = startR;
          opts.path = startP;
          opts.alpha = startA;
        }
        if (fadeQ < 1 && (lastAllowed || this.settings.fadeInclusive)) {
          opts.fillStyle = opts.fillStyle.blend(fillColors[cell.lastState], fadeQ);
          opts.strokeStyle = opts.strokeStyle.blend(strokeColors[cell.lastState], fadeQ);
        }
      }
      else if (lastAllowed) {
        r = endR;
        opts.path = endP;
        opts.alpha = endA;
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
