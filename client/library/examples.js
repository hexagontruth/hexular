const Examples = (() => {
  let fnCount = 0;

  let customCodeDemos = {
    addRule: `Board.config.addRule('newRule', (cell) => cell.max > 2 ? cell.state + 1 : 0)`,
    maxFilledTriangle: `Examples.maxFilledTriangle()`,
    minOutlineCircle: `Examples.minOutlineCircle(3)`,
    drawCellImage: `
Examples.drawCellImage(null, {scale: 2, type: Hexular.enums.TYPE_FLAT, states: [1, 2], clip: true})
`,
    drawBackgroundImage: `Examples.drawBackgroundImage(null, {scale: 1})`,
    remove: `Examples.remove(/* index of example callback to remove */)`,
    scaleTo: `Board.instance.scaleTo(Board.instance.scale * 2, 5000)`,
  };

  Object.entries(customCodeDemos).forEach(([k, v]) => {
    customCodeDemos[k] = v.trim();
  });

  function hexagonFactory(opts, cb) {
    let defaults = {
      type: Hexular.enums.TYPE_POINTY,
      stroke: false,
      fill: false,
    };
    if (!cb)
      cb = (a, b, c) => Math.max(a.state, b.state, c.state);
    opts = Object.assign(defaults, opts);
    return (radius, optOverrides) => {
      opts = Object.assign(opts, optOverrides);
      let adapter = Board.bgAdapter;
      let model = Board.model;
      let fn = function(cell) {
        if (!cell.state)
          return;
        let slice = cell.with[6].nbrSlice;
        for (let i = 0; i < 5; i++) {
          let n1 = slice[i];
          let n2 = slice[(i + 1) % 6];
          if (n1.state && n2.state && !n1.edge && !n2.edge) {
            let state = cb(cell, n1, n2);
            let [x0, y0] = model.cellMap.get(cell);
            let [x1, y1] = model.cellMap.get(n1);
            let [x2, y2] = model.cellMap.get(n2);
            let x = (x0 + x1 + x2) / 3;
            let y = (y0 + y1 + y2) / 3;
            let r = radius || adapter.innerRadius;
            if (opts.stroke)
              opts.strokeStyle = adapter.strokeColors[state];
            if (opts.fill)
              opts.fillStyle = adapter.fillColors[state];
            adapter.drawHexagon([x, y], r, opts);
          }
        }
      }
      fn.idx = ++fnCount;
      Board.bgAdapter.onDrawCell.push(fn);
      Board.instance.draw();
      return fn.idx;
    };
  }

  function circleFactory(cb) {
    return (radius) => {
      let adapter = Board.bgAdapter;
      let model = Board.model;
      let fn = function(cell) {
        if (!cell.state)
          return;
        let slice = cell.with[6].nbrSlice;
        for (let i = 0; i < 5; i++) {
          let n1 = slice[i];
          let n2 = slice[(i + 1) % 6];
          if (n1.state && n2.state && !n1.edge && !n2.edge) {
            let [x0, y0] = model.cellMap.get(cell);
            let [x1, y1] = model.cellMap.get(n1);
            let [x2, y2] = model.cellMap.get(n2);
            let x = (x0 + x1 + x2) / 3;
            let y = (y0 + y1 + y2) / 3;
            let r = radius || adapter.innerRadius;
            adapter.context.beginPath();
            adapter.context.arc(x, y, r, 0, Math.PI * 2);
            cb(adapter.context, cell, n1, n2);
          }
        }
      }
      fn.idx = ++fnCount;
      Board.bgAdapter.onDrawCell.push(fn);
      Board.instance.draw();
      return fn.idx;
    };
  }

  function triangleFactory(cb) {
    return (radius) => {
      let adapter = Board.bgAdapter;
      let model = Board.model;
      let vertices = Hexular.math.vertices.map(([x, y]) => [y, x]);
      let fn = function(cell) {
        if (!cell.state)
          return;
        let slice = cell.with[6].nbrSlice;
        for (let i = 0; i < 5; i++) {
          let n1 = slice[i];
          let n2 = slice[(i + 1) % 6];
          if (n1.state && n2.state && !n1.edge && !n2.edge) {
            let [x0, y0] = model.cellMap.get(cell);
            let [x1, y1] = model.cellMap.get(n1);
            let [x2, y2] = model.cellMap.get(n2);
            let x = (x0 + x1 + x2) / 3;
            let y = (y0 + y1 + y2) / 3;
            let r = radius || adapter.innerRadius;
            adapter.context.beginPath();
            adapter.context.moveTo(x + vertices[1][0] * r, y + vertices[1][1] * r);
            adapter.context.lineTo(x + vertices[3][0] * r, y + vertices[3][1] * r);
            adapter.context.lineTo(x + vertices[5][0] * r, y + vertices[5][1] * r);
            adapter.context.closePath();
            cb(adapter.context, cell, n1, n2);
          }
        }
      };
      fn.idx = ++fnCount;
      Board.bgAdapter.onDrawCell.push(fn);
      Board.instance.draw();
      return fn.idx;
    };
  }

  function lineFactory(cb) {
    return (radius) => {
      let adapter = Board.bgAdapter;
      let model = Board.model;
      let fn = function(cell) {
        if (cell.edge)
          return;
        let slice = cell.with[6].nbrSlice;
        for (let i = 0; i < 5; i += 2) {
          let nbr = slice[i];
          if (!nbr.state || !cell.state || nbr.edge)
            continue;
          let [x0, y0] = model.cellMap.get(cell);
          let [x1, y1] = model.cellMap.get(nbr);
          adapter.context.beginPath();
          adapter.context.moveTo(x0, y0);
          adapter.context.lineTo(x1, y1);
          cb(adapter.context, cell, nbr);
        }
      };
      fn.idx = ++fnCount;
      Board.bgAdapter.onDrawCell.unshift(fn);
      Board.instance.draw();
      return fn.idx;
    };
  }

  function fillMax(ctx, ...cells) {
    let state = Math.max(...cells.map((e) => e.state));
    ctx.fillStyle = Board.bgAdapter.fillColors[state];
    ctx.fill();
  }

  function fillMin(ctx, ...cells) {
    let state = Math.min(...cells.map((e) => e.state));
    ctx.fillStyle = Board.bgAdapter.fillColors[state];
    ctx.fill();
  }

  function outlineMax(ctx, ...cells) {
    let state = Math.max(...cells.map((e) => e.state));
    ctx.strokeStyle = Board.bgAdapter.strokeColors[state];
    ctx.lineWidth = Board.config.cellBorderWidth;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function outlineMin(ctx, ...cells) {
    let state = Math.min(...cells.map((e) => e.state));
    ctx.strokeStyle = Board.bgAdapter.strokeColors[state];
    ctx.lineWidth = Board.config.cellBorderWidth;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function loadImageAsUrl() {
    return new Promise((resolve, reject) => {
      let board = Board.instance;
      let fileLoader = new FileLoader('.jpg,.jpeg,.gif,.png,.svg,.bmp', {reader: 'readAsArrayBuffer'});
      fileLoader.onload = (result) => {
        if (result) {
          let blob = new Blob([result], {type: fileLoader.fileTypes[0]});
          resolve(window.URL.createObjectURL(blob));
        }
      };
      fileLoader.prompt();
    });
  }

  function remove(...idxs) {
    let adapter = Board.bgAdapter;
    let onDraw = Board.bgAdapter.onDraw;
    let onDrawCell = Board.bgAdapter.onDrawCell;
    idxs[0] || idxs.push(
      adapter.onDraw.concat(adapter.onDrawCell)
      .filter((e) => e.idx).map((e) => e.idx).sort().slice(-1)[0]
    );
    for (let idx of idxs) {
      onDraw.replace(onDraw.filter((e) => !e.idx || e.idx != idx));
      onDrawCell.replace(onDrawCell.filter((e) => !e.idx || e.idx != idx));
      Board.instance.draw();
    }
  }

  function removeAll() {
    let adapter = Board.bgAdapter;
    let idxs = adapter.onDraw.concat(adapter.onDrawCell).filter((e) => e.idx).map((e) => e.idx);
    remove(...idxs);
  }

  let examples = {
    customCodeDemos,
    hexagonFactory,
    circleFactory,
    triangleFactory,
    lineFactory,
    fillMax,
    fillMin,
    outlineMax,
    outlineMin,
    loadImageAsUrl,
    remove,
    removeAll,

    maxFilledCircle: circleFactory(fillMax),
    minFilledCircle: circleFactory(fillMin),
    maxOutlineCircle: circleFactory(outlineMax),
    minOutlineCircle: circleFactory(outlineMin),
    maxFilledTriangle: triangleFactory(fillMax),
    minFilledTriangle: triangleFactory(fillMin),
    maxOutlineTriangle: triangleFactory(outlineMax),
    minOutlineTriangle: triangleFactory(outlineMin),

    maxLine: lineFactory(outlineMax),
    minLine: lineFactory(outlineMin),

    maxFilledHexagon: hexagonFactory({fill: true}, (a, b, c) => Math.max(a.state, b.state, c.state)),
    minFilledHexagon: hexagonFactory({fill: true}, (a, b, c) => Math.min(a.state, b.state, c.state)),
    maxOutlineHexagon: hexagonFactory({stroke: true}, (a, b, c) => Math.max(a.state, b.state, c.state)),
    minOutlineHexagon: hexagonFactory({stroke: true}, (a, b, c) => Math.min(a.state, b.state, c.state)),

    drawNoise: (styles=[], fnName='drawFilledPointyHex') => {
      let model = Board.model;
      let adapter = Board.bgAdapter;
      let drawFn = adapter[fnName].bind(adapter);
      let fn = () => {
        model.cells.forEach((cell) => {
          let style = styles[Math.floor(Math.random() * styles.length)];
          drawFn(cell, style);
        });
      };
      fn.idx = ++fnCount;
      adapter.onDraw.push(fn);
      return fn.idx;
    },

    drawBackgroundImage: (url, opts={}) => {
      let fnIdx = ++fnCount;
      let adapter = Board.bgAdapter;
      (async () => {
        let defaults = {
          scale: 1,
        }
        url = url || await loadImageAsUrl();
        opts = Object.assign(defaults, opts);
        let img = new Image();
        img.src = url;
        img.onload = () => {
          let adapter = Board.bgAdapter;
          let fn = () => {
            let w = img.width;
            let h = img.height;
            let viewW = Board.instance.bg.width;
            let viewH = Board.instance.bg.height;
            let scaleAspect = Board.instance.scaleX / Board.instance.scaleY;
            if (opts.scale) {
              if (viewH < viewW) {
                w = viewW * +opts.scale;
                h = w * img.height / img.width / scaleAspect;;
              }
              else {
                h = viewH * +opts.scale;
                w = h * img.width / img.height * scaleAspect;
              }
            }
            else {
              w = w * Board.instance.scaleX;
              h = h * Board.instance.scaleY;
            }
            let x = (viewW - w) / 2;
            let y = (viewH - h) / 2;
            adapter.context.save();
            adapter.context.setTransform(1, 0, 0, 1, 0, 0);
            adapter.context.drawImage(img, x, y, w, h);
            adapter.context.restore();
          };
          fn.idx = fnIdx;
          adapter.onDraw.push(fn);
          Board.instance.draw();
        };
      })();
      return fnIdx;
    },

    drawSubtriangles: (opts) => {
      let defaults = {
        stroke: false,
        fill: false,
        skipGround: true,
        radius: null,
        offset: null,
      };
      opts = Object.assign(defaults, opts);
      let fn = function(cell) {
        if (!cell.state && opts.skipGround)
          return;
        let slice = cell.with[6].nbrSlice;
        let r = opts.radius || this.innerRadius;
        let offset = opts.offset != null ? opts.offset : this.cellBorderWidth / 2;
        for (let i = 0; i < 6; i++) {
          let state = slice[i].state;
          let j = (i + 1) % 6;
          let x = !offset ? 0 : Math.cos(Math.PI * (1 - i) / 3) * offset;
          let y = !offset ? 0 : Math.sin(Math.PI * (1 - i) / 3) * offset;
          let path = [
            [x, y],
            [x + Math.sin(Math.PI * i / 3) * r, y + Math.cos(Math.PI * i / 3) * r],
            [x + Math.sin(Math.PI * j / 3) * r, y + Math.cos(Math.PI * j / 3) * r],
          ];
          this.drawPath(cell, path);
          if (opts.stroke) {
            this.context.strokeStyle = this.strokeColors[state] || this.defaultColor;
            this.context.lineJoin = "round";
            this.context.stroke()
          }
          if (opts.fill) {
            this.context.fillStyle = this.fillColors[state] || this.defaultColor;
            this.context.fill()
          }
        }
      };
      fn.idx = ++fnCount;
      Board.bgAdapter.onDrawCell.push(fn);
      Board.instance.draw();
      return fn.idx;
    },

    drawCellImage: (url, opts={}) => {
      let fnIdx = ++fnCount;
      let adapter = Board.bgAdapter;
      (async () => {
        let defaults = {
          clip: true,
          type: Hexular.enums.TYPE_POINTY,
          scale: 1,
          states: [1],
        };
        if (!url);
        url = url || await loadImageAsUrl();
        opts = Object.assign(defaults, opts);
        let img = new Image();
        img.src = url;
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (opts.scale) {
            w = adapter.innerRadius * 2 * +opts.scale;
            h = w * img.height / img.width;
          }
          let pathScale = opts.scale || 1;
          let path = opts.type == Hexular.enums.TYPE_POINTY
            ? Hexular.math.scalarOp(Hexular.math.vertices.map(([x, y]) => [y, x]), adapter.innerRadius * pathScale)
            : Hexular.math.scalarOp(Hexular.math.vertices, adapter.innerRadius * pathScale)
          let fn = (cell) => {
            if (!opts.states.includes(cell.state))
              return;
            let [x, y] = Board.model.cellMap.get(cell);
            x -= w / 2;
            y -= h / 2;
            adapter.context.save();
            if (opts.clip) {
              adapter.drawPath(cell, path);
              adapter.context.clip();
            }
            adapter.context.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);
            adapter.context.restore();
          };
          fn.idx = ++fnCount;
          adapter.onDrawCell.push(fn);
          Board.instance.draw();
        }
      })();
      return fnIdx;
    }
  }

  return examples;
})();