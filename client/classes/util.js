const Util = (() => {
  const Util = {};

  Util.rotateColors = (offset=1) => {
    let colors = [];
    let len = Math.min(Board.config.maxNumStates, Board.config.colors.length);
    for (let i = 0; i < len; i++) {
      let color = Board.config.colors[(i - offset + len) % len];
      colors.push(color);
    }
    Board.config.setColors(colors);
  };

  Util.findDuplicateSteps = (radius=7, cell=Board.instance.debugSelected) => {
    let cells = Hexular.util.hexWrap(cell, radius);
    let map = window.stateMap = new Map();
    let dups = window.duplicates = [];
    let getStateKey = () => cells.map((e) => ('0' + e.state.toString(16)).slice(-2)).join('');
    let fn = () => {
      let stateKey = getStateKey();
      let cur = map.get(stateKey);
      if (cur != null) {
        dups.push([cur, Board.config.steps, stateKey]);
        Board.instance.setMessage(`Duplicate at ${cur}, ${Board.config.steps}!`);
        console.log(`Duplicate at ${cur}, ${Board.config.steps}: ${stateKey}`);
      }
      map.set(stateKey, Board.config.steps);
    }
    fn.duplicateMapper = true;
    Board.instance.hooks.step = Board.instance.hooks.step.filter((e) => !e.run.duplicateMapper);
    Board.instance.addHook('step', fn);
    return [map, dups];
  };

  Util.setColorRange = (opts={}) => {
    let [min, max] = opts.range || [0, Board.config.maxNumStates];
    let range = max - min;
    let hBase = opts.h || 0;
    let sBase = opts.s != null ? opts.s : 50;
    let lBase = opts.l != null ? opts.l : 50;
    let hDelta = opts.hDelta || 360;
    let sDelta = opts.sDelta || 0;
    let lDelta = opts.lDelta || 0;
    let dir = opts.dir || 1;
    let colors = Board.config.colors.slice();
    for (let i = min; i < max; i++) {
      let q = i - min;
      let h = (hBase + dir * q * hDelta / range) % 360;
      let s = (sBase + dir * q * sDelta / range) % 100;
      let l = (lBase + dir * q * lDelta / range) % 100;
      colors[i] = Color.hslToRgb(h, s, l);
    }
    Board.config.setColors(colors);
  };

  Util.binaryRuleFactory = (...args) => {
    args = args.filter((e) => typeof e == 'number' && e >= 0 && Math.floor(e) == e);
    if (args.length)
      return eval(`(cell) => ${args.map((e) => `cell.state == ${e}`).join(' || ')} ? 1 : 0`); // lol
    else
      return () => false;
  }

  Util.shallowPrettyJson = (data, maxLevels=2, indentText='  ') => {
    let json = JSON.stringify(data);
    let str = '';
    let level = 0;
    let openers = ['[', '{'];
    let closers = [']', '}'];
    let quote = false;
    let indent = (level) => '\n' + indentText.repeat(level);
    for (let i = 0; i < json.length; i++) {
      let char = json[i];
      let next = json[i + 1];
      str += char;
      if (char == '"' && json[i - 1] != '\\')
        quote = !quote;
      if (quote)
        continue;
      let opener = openers.includes(char);
      let closer = closers.includes(char);
      let closerNext = closers.includes(next);
      opener && ++level;
      closer && --level;
      let indentable = level <= maxLevels;

      if (char == ':') {
        str += ' ';
      }
      else if (indentable) {
        if (opener && !closerNext) {
          str += indent(level);
        }
        else if (closer || char == ',') {
          if (next == ',') {
            i ++;
            str += ',';
          }
          str += indent(closerNext ? level - 1 : level);
        }
        else if (closerNext) {
          str += indent(level - 1);
        }
      }
      else if (char == ',') {
        str += ' ';
      }
    }
    return str;
  }

  return Util;
})();
