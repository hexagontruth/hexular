const Util = (() => {
  const Util = {};

  Util.binaryRuleFactory = (...args) => {
    args = args.filter((e) => typeof e == 'number' && e >= 0 && Math.floor(e) == e);
    if (args.length)
      return eval(`(cell) => ${args.map((e) => `cell.state == ${e}`).join(' || ')} ? 1 : 0`); // lol
    else
      return () => false;
  };

  Util.setColorRange = (opts={}) => {
    let [min, max] = opts.range || [0, Board.config.maxNumStates];
    let range = max - min;
    let hBase = opts.h || 0;
    let sBase = opts.s != null ? opts.s : 0.5;
    let lBase = opts.l != null ? opts.l : 0.5;
    let aBase = opts.a != null ? opts.a : 1;
    let hDelta = opts.hDelta || 360;
    let sDelta = opts.sDelta || 0;
    let lDelta = opts.lDelta || 0;
    let aDelta = opts.aDelta || 0;
    let dir = opts.dir || 1;
    let colors = Board.config.colors.slice();
    let clamp = (n) => n; //(n, min=0, max=1) => Math.min(max, Math.max(min, n));
    for (let i = min; i < max; i++) {
      let q = i - min;
      let h = (hBase + dir * q * hDelta / range) % 360;
      let s = clamp(sBase + dir * q * sDelta / range);
      let l = clamp(lBase + dir * q * lDelta / range);
      let a = clamp(aBase + dir * q * aDelta / range);
      colors[i] = Color.hslaToRgba(h, s, l, a);
    }
    Board.config.setColors(colors);
  };

  Util.rotateColors = (offset=1) => {
    let colors = [];
    let len = Math.min(Board.config.maxNumStates, Board.config.colors.length);
    for (let i = 0; i < len; i++) {
      let color = Board.config.colors[(i - offset + len) % len];
      colors.push(color);
    }
    Board.config.setColors(colors);
  };

  Util.pairsToObject = (tuples) => {
    let obj = {};
    tuples.forEach(([key, value]) => obj[key] = value);
    return obj;
  };

  Util.findDuplicateSteps = (radius=7, cell=Board.instance.debugSelected) => {
    cell = cell || Board.model.cells[0];
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

  Util.debugTimer = (log=true) => {
    let intervals = window.debugIntervals = [];
    let t;
    let fn = () => {
      let oldT = t;
      t = Date.now();
      if (oldT) {
        let delta = t - oldT;
        log && console.log(delta);
        intervals.push(delta);
      }
    }
    fn.debugTimer = true;
    Board.instance.hooks.step = Board.instance.hooks.step.filter((e) => !e.run.debugTiger);
    Board.instance.addHook('step', fn);
    return intervals;
  };

  Util.debugCell = (cell, fn) => {
    if (cell == Board.instance.debugSelected)
      fn(cell);
  };

  Util.indentTrim = (string) => {
    let lines = string.split('\n');
    let min = Infinity;
    for (let line of lines) {
      let indent = line.match(/^( *?)[^ ]+$/)
      if (indent) {
        min = Math.min(indent[1].length, min);
      }
    }
    min = min < Infinity ? min : 0;
    return lines.map((e) => e.substring(min)).filter((e) => e.length > 0).join('\n');
  };

  Util.execCommandBroken = () => { // *sigh*
    if (!document.execCommand || !document.queryCommandSupported)
      return true;
    let lastFocus = document.activeElement;
    let elem = document.createElement('textarea');
    elem.style.position = 'fixed';
    elem.style.left = '0';
    elem.style.top = '0';
    elem.style.opacity = '0';
    document.body.appendChild(elem);
    elem.value = `Looking at you Firefox`;
    elem.focus();
    elem.setSelectionRange(0, 15);
    document.execCommand('delete', false);
    document.execCommand('insertText', false, 'Wtf ');
    let str = elem.value;
    lastFocus && lastFocus.focus();
    elem.remove();
    return str.length == 22 ? true : false;
  };

  Util.handleTextFormat = (elem, ev) => {
    let cursor = elem.selectionStart;
    let text = elem.value;
    let beforeCursor = text.slice(0, cursor);
    let afterCursor = text.slice(cursor);
    if (
      ev.inputType == 'insertLineBreak' ||
      text[cursor -1] == '\n' && ev.inputType == 'insertText' && !ev.data // wtf
    ) {
      let rows = beforeCursor.split('\n');
      let lastRow = rows.slice(-2)[0];
      let match = lastRow && lastRow.match(/^\s+/);
      let spaces = match && match[0] || '';
      Util.execInsert(elem, spaces, cursor);
      elem.setSelectionRange(cursor + spaces.length, cursor + spaces.length);
    }
  };

  Util.execInsert = (elem, str, startIdx, endIdx) => {
    endIdx = endIdx || startIdx;
    if (!Board.instance.execCommandBroken) {
      elem.focus();
      if (startIdx) {
        elem.setSelectionRange(startIdx, endIdx);
      }
      else {
        elem.select();
        document.execCommand("delete", false);
      }
      document.execCommand("insertText", false, str);
    }
    else {
      if (!startIdx)
        elem.value = str;
      else
        elem.value = elem.value.slice(0, startIdx) + str + elem.value.slice(endIdx);
    }
  };

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
  };

  Util.loadImageAsUrl = () => {
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

  return Util;
})();
