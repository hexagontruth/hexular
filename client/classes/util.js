const Util = (() => {
  const Util = {};

  // HSL/RGB conversion functions more or less taken from:
  // https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  Util.hslToRgb = (h, s, l) => {
    h /= 360;
    s /= 100;
    l /= 100;
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
    r = Math.floor(r * 256);
    g = Math.floor(g * 256);
    b = Math.floor(b * 256);
    return [r, g, b];
  };

  Util.rgbToHsl = (r, g, b) => {
      r /= 255;
      g /= 255;
      b /= 255;
      let max = Math.max(r, g, b);
      let min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max == min){
        h = s = 0;
      }
      else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max == r)
          h = (g - b) / d + (g < b ? 6 : 0);
        else if (max == g)
          h = (b - r) / d + 2;
        else if (max == b)
          h = (r - g) / d + 4;
        h /= 6;
      }

      return [h * 360, s * 100, l * 100];
  };

  /**
   * Utility function for converting RGB CSS/canvas color string to a four-dimensional RGBA array.
   *
   * Note this presently only works correctly for three- and six-digit hex codes, and for "transparent."
   *
   * @param  {string} style Style string
   * @return {number[]}    Four-dimensional array of values 0-255 corresponding to RGBA channels
   */
  Util.styleToVcolor = (style) => {
    let vector = [127, 127, 127, 0];
    if (style[0] == '#') {
      let hex = style.slice(1);
      if (hex.length == 3 || hex.length == 4) {
        hex = hex.split('').map((e) => e.repeat(2)).join('');
      }
      else if (hex.length == 6) {
        hex += 'ff';
      }
      if (hex.length == 8) {
        for (let i = 0; i < 4; i++) {
          vector[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
      }
      // For all non-hex colors we simply return transparent for now
    }
    return vector;
  };

  /**
   * Convenience method for converting four-dimensional vector color to eight-digit hex color.
   *
   * @param  {type} vec A four-dimensional numeric array of values 0-255
   * @return {string}   A string representation of the form "#RRGGBBAA"
   */
  Util.vcolorToHex = (vec) => {
    return '#' + vec.map((e) => ('0' + e.toString(16)).slice(-2)).join('');
  };

  /**
   * Convenience method for converting one-, two-, and three-dimensional color arrays into four-dimensional forms.
   *
   * - One-dimensional arrays are taken to represent black.
   * - Two-dimensional arrays are taken to represent black and an alpha channel.
   * - Three-dimensional arrays are taken to represent RGB channels.
   *
   * @param  {number[]} vec A four-dimensional numeric array of values 0-255
   * @return {number[]}    Four-dimensional array of values 0-255 corresponding to RGBA channels
   */
  Util.normalizeVcolor = (vec) => {
    if (vec.length == 4)
      return vec;
    else if (vec.length == 3)
      return vec.concat([255]);
    else if (vec.length == 2)
      return Array(3).fill(vec[0]).concat([vec[1]]);
    else if (vec.length == 1)
      return Array(3).fill(vec[0]).concat([255]);
  };

  /**
   * Convenience method for blending two vector colors evenly or according to the specified ratio.
   *
   * @param  {number[]} c0   First vector color
   * @param  {number[]} c1   Second vector color
   * @param  {number} [q=0.5] A real number between 0-1 representing the blend weight given to the first color
   * @return {type}           Four-dimensional array representation of merged color
   */
  Util.mergeVcolors = (c0, c1, q=0.5) => {
    let vector = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      vector[i] = Math.round(c0[i] * q + c1[i] * (1 - q));
    }
    return vector;
  };

  return Util;
})();
