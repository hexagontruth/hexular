// In light of the plugin system these are now mostly obsolete but should still work
const Examples = (() => {
  let fnCount = 0;

  let customCodeDemos = {
    addRule: `
      Board.config.addRule('newRule', (cell) =>
        cell.max > 2 ? cell.state + 1 : 0
      );
    `,
    deleteRule: `Board.config.deleteRule('ruleName');`,
    drawCellImage: `
      Examples.drawCellImage(null, {
        scale: 2,
        type: Hexular.enums.TYPE_FLAT,
        states: [1, 2],
        clip: true
      });
    `,
    drawBackgroundImage: `Examples.drawBackgroundImage(null, {scale: 1});`,
    rotateColors: `Examples.rotateColors();`,
    scaleTo: `Board.instance.scaleTo(Board.instance.scale * 2, 5000);`,
    maxNumStates: `Board.config.setMaxNumStates(64);`,
    setColorRange: `Util.setColorRange({range: [1, 12], dir: 1, h: 0, hDelta: 360});`,
    debugTimer: `
      // Writes interval to console and window.debugIntervals
      Util.debugTimer();
    `,
    findDuplicateSteps: `Util.findDuplicateSteps();`,
    clearHooks: `
      // Hook used for e.g. debugTimer, findDuplicateSteps
      Board.instance.clearHooks('step');
    `,
  };

  Object.entries(customCodeDemos).forEach(([k, v]) => {
    customCodeDemos[k] = Util.indentTrim(v);
  });

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
    Object.entries(Board.instance.hooks).forEach(([key, values]) => {
      Board.instance.hooks[key] = values.filter((e) => !idxs.includes(e.run.idx));
    });
    Board.instance.draw();
  }

  function removeAll() {
    let adapter = Board.adapter;
    let idxs = Array(fnCount + 1).fill().map((_, i) => i);
    remove(...idxs);
  }

  let examples = {
    customCodeDemos,
    loadImageAsUrl,
    remove,
    removeAll,

    drawBackgroundImage: (url, opts={}) => {
      let fnIdx = ++fnCount;
      (async () => {
        let defaults = {
          scale: 1,
        }
        url = url || await loadImageAsUrl();
        opts = Object.assign(defaults, opts);
        let img = new Image();
        img.src = url;
        img.onload = () => {
          let fn = () => {
            let adapter = Board.adapter;
            let w = img.width;
            let h = img.height;
            let viewW = Board.instance.canvasWidth;
            let viewH = Board.instance.canvasHeight;
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
          Board.instance.addHook('draw', fn);
          Board.instance.draw();
        };
      })();
      return fnIdx;
    },

    drawCellImage: (url, opts={}) => {
      let fnIdx = ++fnCount;
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
          let adapter = Board.adapter;
          let config = Board.config;
          let w = img.width;
          let h = img.height;
          if (opts.scale) {
            w = config.innerRadius * 2 * +opts.scale;
            h = w * img.height / img.width;
          }
          let pathScale = opts.scale || 1;
          let path = opts.type == Hexular.enums.TYPE_POINTY
            ? Hexular.math.scalarOp(Hexular.math.vertices.map(([x, y]) => [y, x]), config.innerRadius * pathScale)
            : Hexular.math.scalarOp(Hexular.math.vertices, config.innerRadius * pathScale)
          let fn = (cell) => {
            let adapter = Board.adapter;
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
          Board.instance.addHook('drawCell', fn);
          Board.instance.draw();
        }
      })();
      return fnIdx;
    },

     rotateColors: (offset=1) => {
      Board.instance.addHook('step', () => {
        Util.rotateColors(offset);
      });
    },
  }

  return examples;
})();
