const THEMES = {
  light: {
    background: '#f8f8f8',
    colors: Object.assign([], Hexular.DEFAULTS.colors, [
      '#fff',
      '#ccccbb',
      '#99998f',
      '#666655',
      '#33332f',
    ]),
  },
  classic: {
    background: '#eeeeee',
    colors: Hexular.DEFAULTS.colors.slice(),
  },
  white: {
    background: '#ffffff',
    colors: Hexular.DEFAULTS.colors.slice(),
  },
  beigeRainbow: {
    background: '#ffffff',
    colors:[
      '#fafafa',
      '#ccccbb',
      '#ffaa11',
      '#ffcc22',
      '#aadd11',
      '#11cccc',
      '#1188ff',
      '#cc44ff',//
      '#ff44bb',//
      '#cc3333',
      '#aaaa33',
      '#332211',
    ],
  },
  dark: {
    background: '#111111',
    colors: Object.assign([], Hexular.DEFAULTS.colors, [
      '#000000',
      '#888888',
      '#aaaaaa',
      '#cccccc',
      '#eeeeee',
    ]),
  },
  darkRainbow: {
    background: '#111111',
    colors:[
      '#000000',
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
    ],
  },
};