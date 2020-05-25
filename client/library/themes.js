const Themes = (() => {
  // Original 2017 color palette
  let classicColors = Object.assign([], Config.defaults.colors, [
    'transparent',
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

  let fruitcake = Object.assign([], Config.defaults.colors, [
    null,
    '#b7bb95',
    '#8e996d',
    '#796d53',
    '#68873b',
    '#8a3731',
    '#d4872e',
    '#ddc734',
    '#89c828',
    '#64a8ab',
    '#4973bb',
    '#aa5ebb',
  ]);

  let rainbow = Object.assign([], Config.defaults.colors, [
    'transparent',
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
    default: {
    },
    smooth: {
      cellGap: -0.5,
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
      modelBackgroundColor: '#efefe7',
    },
    beigeBlobular: {
      modelBackgroundColor: '#efefe7',
      cellGap: -12.75,
    },
    white: {
      backgroundColor: '#ffffff',
      colors: Config.defaults.colors.slice(),
    },
    lightRainbow: {
      cellGap: -0.5,
      colors: rainbow,
    },
    vaporRainbow : {
      cellGap: -0.5,
      backgroundColor: '#ffffff',
      modelBackgroundColor: '#fffff7',
      colors: Hexular.util.merge([], classicColors, [
        null,
        '#f7f7ef33',
        '#efefe766',
        '#e7e7df99',
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
      backgroundColor: '#ffffff',
      modelBackgroundColor: '#fafafa',
      colors: [
        null,
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
      backgroundColor: '#111111',
      modelBackgroundColor: '#000000',
      cellGap: -0.5,
      colors: Hexular.util.merge([], classicColors, [
        null,
        '#888888',
        '#aaaaaa',
        '#cccccc',
        '#eeeeee',
      ]),
    },
    darkRainbow: {
      backgroundColor: '#111111',
      modelBackgroundColor: '#000000',
      cellGap: -0.5,
      colors: rainbow,
    },
    darkRainbow2: {
      backgroundColor: '#111111',
      modelBackgroundColor: '#000000',
      cellGap: 8,
      colors: [
        null,
        '#ff2d00',
        '#ff7708',
        '#ffd400',
        '#e4ff00',
        '#5cff00',
        '#00eeff',
        '#0080ff',
        '#0044ff',
        '#dd00ff',
        '#ff00cc',
        '#ffffff',
      ],
    },
    darkLight: {
      backgroundColor: '#24222d',
      modelBackgroundColor: '#3a3545',
      colors: Hexular.util.merge(Config.defaults.colors.slice(), [
        null,
        '#5d524b',
        '#666655',
        '#99998f',
        '#ccccbb',
      ]),
    },
    smoothChalkRainbow: {
      backgroundColor: '#111111',
      modelBackgroundColor: '#001122',
      cellGap: -13,
      cellBorderWidth: 2,
      colors: [
        null,
        '#664466',
        '#dd2200',
        '#ffaa00',
        '#ddee00',
        '#00ee00',
        '#00dddd',
        '#00aaff',
        '#0066cc',
        '#3333ff',
        '#dd00dd',
        '#eeeedd',
      ],
    },
    vegetableGarden: {
      colors: [
        null,
        '#ddd7c3',
        '#bdbaa4',
        '#8b9e62',
        '#63a55c',
        '#54a298',
        '#47496e',
        '#6e5765',
        '#6a5f58',
        '#474743',
        '#393a31',
        '#39423a',
      ],
    },
    hardRainbow: {
      backgroundColor: '#111111',
      modelBackgroundColor: '#000000',
      colors: [
        null,
        '#ffffff',
        '#ff00ff',
        '#0000ff',
        '#00ffff',
        '#00ff00',
        '#ffff00',
        '#ff0000',
        'transparent',
        'transparent',
        'transparent',
        'transparent',
      ],
    },
    monogram: {
      backgroundColor: '#cce5e2',
      modelBackgroundColor: '#eeeedd',
      cellGap: 1.33,
      colors: Hexular.util.merge(new Array(64).fill('#33332f'), ['#eed']),
    },
    sovietFruitcake: {
      backgroundColor: '#f8f8f8',
      modelBackgroundColor: '#edf0e7',
      cellGap: 5,
      cellBorder: 1,
      colors: [
        null,
        '#b7bb95',
        '#8e996d',
        '#796d53',
        '#68873b',
        '#8a3731',
        '#d4872e',
        '#ddc734',
        '#89c828',
        '#64a8ab',
        '#4973bb',
        '#aa5ebb',
      ],
    },
    extendedDarkFruitcake: {
      backgroundColor: '#4e4e47',
      modelBackgroundColor: '#3e413a',
      cellGap: 0,
      cellBorder: 1,
      colors: [
        null,
        '#9b8c65',
        '#8e996d',
        '#796d53',
        '#68873b',
        '#8a3731',
        '#d4872e',
        '#ddc734',
        '#89c828',
        '#64a8ab',
        '#4973bb',
        '#aa5ebb',
        '#374a65',
        '#5d5b70',
        '#3a2e2e',
        '#342d0a',
      ],
    },

    spectral64: {
      backgroundColor: '#223030',
      modelBackgroundColor: '#182b2e',
      defaultColor: '#e7e7e7',
      cellGap: 4.33,
      colors: [null].concat(Color.from(Array(63).fill().map((_, i) => Color.hslaToRgba(i * 360 / 63, 50, 50)))),
    },
  };
  return themes;
})();
