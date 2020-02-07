const THEMES = {
  light: {
    background: '#f8f8f8',
    colors: Hexular.DEFAULTS.colors.slice(),
  },
  smooth: {
    background: '#f8f8f8',
    borderWidth: -0.75,
    colors: Hexular.DEFAULTS.colors.slice(),
  },
  classic: {
    background: '#eeeeee',
    colors: Object.assign([], Hexular.DEFAULTS.colors, [
      '#ffffff',
      '#cccccc',
      '#999999',
      '#666666',
      '#333333',
    ]),
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