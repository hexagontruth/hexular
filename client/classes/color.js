/**
 * A class of immutable RGBA vector colors mapped to and from canvas/CSS hex formats
 *
 * HSL/RGB conversion functionality more or less taken from:
 * https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
 */
const Color = (() => {
  const MAX_QUEUE_LENGTH = 2 ** 20;
  const hexmap = new Map();

  function _Color(...args) {
    let hex;
    let match;
    let arg = args[0]
    if (arg == null) {
      return _Color.t;
    }
    else if (typeof arg == 'string') {
      arg = arg.trim();
      if (arg[0] == '#') {
        if (arg.length == 9) {
          hex = arg;
        }
        else if (arg.length == 7) {
          hex = arg + 'ff';
        }
        else if (arg.length == 5) {
          hex = `#${arg[1]}${arg[1]}${arg[2]}${arg[2]}${arg[3]}${arg[3]}${arg[4]}${arg[4]}`;
        }
        else if (arg.length == 4) {
          hex = `#${arg[1]}${arg[1]}${arg[2]}${arg[2]}${arg[3]}${arg[3]}ff`;
        }
      }
      else if (arg == 'transparent') {
        return _Color.t;
      }
      else if (arg == 'white') {
        return _Color.white;
      }
      else if (arg == 'black') {
        return _Color.black;
      }
      else if (match = arg.match(/hsl\((.+?)\)/)) {
        let [h, s, l] = match[1].split(',').map((e) => parseFloat(e.trim()));
        return _Color(hslaToRgba(h, s, l));
      }
    }
    else if (arg instanceof Color) {
      let cur = hexmap.get(arg);
      return arg || hexmap.set(arg.hex, arg).get(arg.hex);
    }
    else if (arg.length) {
      if (arg.length < 4) {
        return _Color(normalize(arg));
      }
      else {
        return _Color(vec2Hex(arg));
      }
    }
    else if (typeof arg == 'number') {
      return _Color(args);
    }
    if (!hex)
      throw new Hexular.HexError(`Can't parse color ${arg} lol`);
    color = hexmap.get(hex);
    return color || new Color(hex);
  }

  class Color extends Array {
    constructor(hex) {
      super(4);
      this.hex = hex;
      this[0] = parseInt(hex.slice(1, 3), 16);
      this[1] = parseInt(hex.slice(3, 5), 16);
      this[2] = parseInt(hex.slice(5, 7), 16);
      this[3] = parseInt(hex.slice(7, 9), 16);
      hexmap.set(hex, this);
    }

    toString() {
      return this.hex;
    }

    blend(other=_Color.t, q=0.5) {
      if (other[3] == 0)
        return _Color.t.blend(this, (1 - q));
      let vector = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++)
        vector[i] = Math.round(this[i] * q + other[i] * (1 - q));
      return _Color(vector);
    }
  }

  class ColorT extends Color {
    constructor() {
      super('#00000000');
      hexmap.delete(this.hex); // ew
    }

    blend(other, q=0.5) {
      return _Color([other[0], other[1], other[2], Math.round(other[3] * (1 - q))]);
    }
  }

  _Color.blend = (...colors) => {
    let vec = [0, 0, 0, 0];
    let tCount = 0;
    for (let i = 0; i < colors.length; i++) {
      let color = colors[i];
      if (!color || color[3] == 0) {
        tCount++;
      }
      else {
        vec[0] += color[0] / colors.length;
        vec[1] += color[1] / colors.length;
        vec[2] += color[2] / colors.length;
        vec[3] += color[3] / colors.length;
      }
    }
    if (tCount == colors.length)
      return _Color.t;
    let q = colors.length / (colors.length - tCount);
    vec[0] = Math.round(vec[0] * q);
    vec[1] = Math.round(vec[1] * q);
    vec[2] = Math.round(vec[2] * q);
    vec[3] = Math.round(vec[3]);
    return _Color(vec.map((e) => Math.round(e)));;
  };

  _Color.eq = (c0, c1) => {
    if (c0 == c1)
      return true;
    else if (!c0 || !c1) {
      return false;
    }
    let s0 = c0.toString(), s1 = c1.toString();
    if (s0 == s1)
      return true;
    else if (s0.slice(0, 7) == s1.slice(0, 7) && (s0.length == 7 || s1.length == 7))
      return true;
    else if (_Color(c0) == _Color(c1))
      return true;
    return false;
  }

  _Color.clear = () => {
    hexmap.clear();
    hexmap.set(_Color.t.hex, _Color.t);
    hexmap.set(_Color.black.hex, _Color.black);
    hexmap.set(_Color.white.hex, _Color.white);
  };

  _Color.Color = Color;
  _Color.hexmap = hexmap;
  _Color.t = new ColorT();
  _Color.black = _Color('#000000ff');
  _Color.white = _Color('#ffffffff');

  _Color.from = (args) => args.map((e) => _Color(e));

  let vec2Hex = (vec) => `#${vec.map((e) => ('0' + e.toString(16)).slice(-2)).join('')}`;

  let normalize = (vec) => {
    if (vec.length == 4)
      return vec;
    else if (vec.length == 3)
      return vec.concat([255]);
    else if (vec.length == 2)
      return Array(3).fill(vec[0]).concat([vec[1]]);
    else if (vec.length == 1)
      return Array(3).fill(vec[0]).concat([255]);
  };

  let hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let hslaToRgba = _Color.hslaToRgba = (h, s, l, a=1) => {
    h /= 360;
    let r, g, b;

    if (s == 0){
      r = g = b = l;
    }
    else {
      let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      let p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    r = Math.round(r * 255);
    g = Math.round(g * 255);
    b = Math.round(b * 255);
    a = Math.round(a * 255);
    return [r, g, b, a];
  };

  return _Color;
})();
