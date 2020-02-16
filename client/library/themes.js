const Themes = (() => {
  // Original 2017 color palette
  let classicColors = Object.assign([], Hexular.DEFAULTS.colors, [
    '#ffffff',
    '#cccccc',
    '#999999',
    '#666666',
    '#333333',
    '#cc4444',
    '#ee7722',
    '#eebb33',
    '#66bb33',
    '#66aaaa',
    '#4455bb',
    '#aa55bb',
  ]);

  let rainbow = Object.assign([], Hexular.DEFAULTS.colors, [
    '#ffffff',
    '#ff0000',
    '#ffaa00',
    '#aaff00',
    '#00ff00',
    '#00ffff',
    '#00aaff',
    '#0066ff',
    '#0000ff',
    '#aa00ff',
    '#ff00ff',
    '#ff00aa',
  ]);

  let themes = {
    light: {
    },
    smooth: {
      borderWidth: -0.5,
    },
    mango: {
      colors: [
        null,
        null,
        null,
        null,
        null,
        '#cc5555',
        '#ef9f00',
        '#eedd00',
        '#6fbf44',
        '#33cccc',
        '#3366ee',
        '#cc33ee',
      ],
    },
    beige: {
      colors: [
        '#efefe7',
      ],
    },
    classic: {
      colors: classicColors,
    },
    white: {
      background: '#ffffff',
      colors: Hexular.DEFAULTS.colors.slice(),
    },
    lightRainbow: {
      borderWidth: -0.5,
      colors: rainbow,
    },
    vaporRainbow : {
      borderWidth: -0.5,
      colors: Config.merge(classicColors, [
        '#fffff7',
        '#f7f7ef',
        '#efefe7',
        '#e7e7df',
        '#ff0000',
        '#ffaa00',
        '#aaff00',
        '#00ff00',
        '#00ffff',
        '#00aaff',
        '#9900ff',
        '#ff0099',
      ]),
    },
    beigeRainbow: {
      background: '#ffffff',
      colors: [
        '#fafafa',
        '#ccccbb',
        '#ffaa11',
        '#ffcc22',
        '#aadd11',
        '#11cccc',
        '#1188ff',
        '#cc44ff',
        '#ff44bb',
        '#cc3333',
        '#aaaa33',
        '#332211',
      ],
    },
    dark: {
      background: '#111111',
      borderWidth: -0.5,
      colors: Config.merge([], classicColors, [
        '#000000',
        '#888888',
        '#aaaaaa',
        '#cccccc',
        '#eeeeee',
      ]),
    },
    darkRainbow: {
      background: '#111111',
      borderWidth: -0.5,
      colors: Config.merge(rainbow, ['#000000']),
    },
  };
  return themes;
})();