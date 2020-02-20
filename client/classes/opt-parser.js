class OptParser {
  constructor(defaults) {

    // Let us infer if this is a mobile browser and make some tweaks
    if (window.devicePixelRatio > 1 && screen.width < 640) {
      defaults.scaleFactor = window.devicePixelRatio;
      defaults.mobile = true;
      defaults.radius = defaults.mobileRadius;
      defaults.defaultScale = defaults.mobileDefaultScale;
      defaults.undoStackSize = defaults.mobileUndoStackSize;
    }

    this.splitFilter(location.href.split('?')[1] || '', '&').map((e) => e.split('='))
    .forEach(([key, value]) => {
      if (!value)
        return
      let result, match, idx;

      // Check for indicial assignment
      match = key.match(/(.+?)\[(\d+)\]/);
      [key, idx] = match ? [match[1], match[2]] : [key, null];
      let current = idx != null ? defaults[key][idx] : defaults[key];

      // Check if array
      match = value.match(/^\[(.+?)\]$/);
      if (match)
        result = this.merge(current, this.splitFilter(match[1], ',').map((e) => this.parseArg(e)));
      else
        result = this.parseArg(value);

      if (idx != null)
        defaults[key][idx] = result;
      else
        defaults[key] = result;
    });

    Config.merge(this, defaults);
  }

  splitFilter(str, split) {
    return str && str.split(split).filter((e) => e.trim()).filter((e) => e.length > 0) || [];
  }

  parseArg(arg) {
    let numArg = parseFloat(arg);
    if (!Number.isNaN(numArg))
      return numArg;
    if (arg == 'null' || arg == '-')
      return null
    else if (arg == 'undefined')
      return undefined;
    else if (arg == 'true')
      return true;
    else if (arg == 'false')
      return false;
    else
      return arg;
  }

  merge(a, b) {
    let length = Math.max(a.length, b.length);
    let c = Array(length);
    for (let i = 0; i < length; i++) {
      c[i] = b[i] != null ? b[i] : a[i];
    }
    return c;
  }
}