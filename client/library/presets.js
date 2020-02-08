const Presets = {
  default: new Preset(Array(12).fill('ennead')),

  classic: new Preset(Object.assign(Array(12).fill('classicDuplex23'), ['binary2'])),

  hexlife: new Preset([
    'binary2',
    'binary23',
  ]),

  rainbowRoad: new Preset(Object.assign(Array(12).fill('stepUp'), ['fractalLeft'])),

  fancytownClassic: new Preset(Array(12).fill('fancytown'), {nh: 19}),

  grayGoo: new Preset(Object.assign(Array(10).fill('average'), ['total', 'total']), {nh: 19}),
};