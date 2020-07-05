// In light of the plugin system these are now mostly obsolete but should still work
const Examples = (() => {
  let fnCount = 0;

  let snippets = {
    addRule: `
      Board.config.addRule('newRule', (cell) =>
        cell.max > 2 ? cell.state + 1 : 0
      );
    `,
    deleteRule: `Board.config.deleteRule('ruleName');`,
    binaryRuleFactory: `Board.config.addRule('binary135', Util.binaryRuleFactory(1, 3, 5));`,
    symmetricRuleFactory: `Board.config.addRule('symmetric26', Util.symmetricRuleFactory(2, 6));`,
    drawCellImage: `
      Examples.drawCellImage(null, {
        clipType: Hexular.enums.TYPE_POINTY,
        fit: 'cover',
        translate: [0, 0],
        states: [1, 2],
      });
    `,
    drawBackgroundImage: `
      Examples.drawBackgroundImage(null, {
        fit: 'cover',
        scale: [1, 1],
      });
    `,
    rotateColors: `Examples.rotateColors();`,
    scaleTo: `Board.instance.scaleTo(Board.instance.scale * 2, 5000);`,
    maxNumStates: `Board.config.setMaxNumStates(64);`,
    setColorRange: `Util.setColorRange({range: [1, 12], h: 0, hDelta: 360});`,
    debugTimer: `
      // Writes interval to console and window.debugIntervals
      Util.debugTimer();
    `,
    findDuplicateSteps: `Util.findDuplicateSteps();`,
    clearHooks: `
      // Hook used for e.g. debugTimer, findDuplicateSteps
      Board.instance.clearHooks('step');
    `,
    deleteSnippet: `
      // Reload page to restore built-in snippets
      Board.config.deleteSnippet('deleteSnippet');
    `,
    stateHistogram: `
      Util.stateHistogram();
    `,
    blurTool: `
      // Sets tool when window loses focus
      Board.config.blurTool = 'none';
    `,
    translateStates: `
      Util.translateStates([0, 1, -1]);
    `,
  };

  Object.entries(snippets).forEach(([k, v]) => {
    snippets[k] = Util.indentTrim(v);
  });

  function remove(...idxs) {
    Object.entries(Board.instance.hooks).forEach(([key, values]) => {
      Board.instance.hooks[key] = values.filter((e) => !idxs.includes(e.fn.idx));
    });
    Board.instance.draw();
  }

  function removeAll() {
    let adapter = Board.adapter;
    let idxs = Array(fnCount + 1).fill().map((_, i) => i);
    remove(...idxs);
  }

  let examples = {
    snippets,
    remove,
    removeAll,

    drawBackgroundImage: (url, opts={}) => {
      let fnIdx = ++fnCount;
      (async () => {
        let defaults = {
          fit: 'cover',
          scale: [1, 1],
          translate: [0, 0],
          blend: 'source-over',
          alpha: 1,
          cb: null,
          adapter: null,
          insertionIndex: 0,
        }
        url = url || await Util.loadImageAsUrl();
        opts = Object.assign(defaults, opts);
        let img = new Image();
        img.src = url;
        img.onload = () => {
          let fn = (adapter) => {
            adapter = opts.adapter || adapter;
            let viewW = Board.instance.canvasWidth;
            let viewH = Board.instance.canvasHeight;
            let [w, h] = Util.fit([viewW, viewH], [img.width, img.height], opts.fit);
            w *= opts.scale[0];
            h *= opts.scale[1];
            let x = (viewW - w) / 2;
            let y = (viewH - h) / 2;
            opts = {...opts, x, y, w, h};
            adapter.context.save();
            adapter.context.setTransform(1, 0, 0, 1, ...opts.translate);
            opts.cb && opts.cb(opts, Board.instance);
            adapter.context.globalCompositeOperation = opts.blend;
            adapter.context.globalAlpha = opts.alpha,
            adapter.context.drawImage(img, opts.x, opts.y, opts.w, opts.h);
            adapter.context.restore();
          };
          fn.idx = fnIdx;
          Board.instance.addHook('draw', fn, opts.insertionIndex);
          Board.instance.draw();
        };
      })();
      return fnIdx;
    },

    drawCellImage: (url, opts={}) => {
      let fnIdx = ++fnCount;
      (async () => {
        let defaults = {
          clipType: Hexular.enums.TYPE_POINTY,
          clipScale: 1,
          fit: 'cover',
          scale: [1, 1],
          translate: [0, 0],
          blend: 'source-over',
          alpha: 1,
          states: [1],
          cb: null,
          adapter: null,
        };
        if (!url);
        url = url || await Util.loadImageAsUrl();
        opts = Object.assign(defaults, opts);
        let img = new Image();
        img.src = url;
        img.onload = () => {
          let config = Board.config;
          let fn = (adapter) => {
            adapter = opts.adapter || adapter;
            let parent = [config.innerRadius * 2, config.innerRadius * 2];
            let [w, h] = Util.fit(parent, [img.width, img.height], opts.fit);
            w *= opts.scale[0];
            h *= opts.scale[1];
            Board.model.eachCell((cell) => {
              if (!opts.states.includes(cell.state))
                return;
              adapter.context.save();
              adapter.context.translate(...Board.model.cellMap.get(cell));
              adapter.context.translate(...opts.translate);
              opts = {...opts, x: -w / 2, y: -h / 2, w, h};
              opts.cb && opts.cb(cell, opts, Board.instance);
              adapter.context.globalCompositeOperation = opts.blend;
              adapter.context.globalAlpha = opts.alpha;
              if (opts.clipType) {
                let clipR = adapter.config.innerRadius * opts.clipScale;
                adapter.drawShape([0, 0], clipR, {type: opts.clipType, clip: true});
              }
              adapter.context.drawImage(img, 0, 0, img.width, img.height, opts.x, opts.y, opts.w, opts.h);
              adapter.context.restore();
            });
          };
          fn.idx = ++fnCount;
          Board.instance.addHook('draw', fn, opts.insertionIndex);
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
