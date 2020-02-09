const Presets = {
  default: new Preset({filters: {deltaFilter: true}}, Array(12).fill('ennead')),

  classic: new Preset(Object.assign(Array(12).fill('classicDuplex23'), ['binary2'])),

  gliderWorld: new Preset({filters: {edgeFilter: true}}, [
    'ennead',
    'ennead',
  ]),

  rainbowRoad: new Preset(Object.assign(Array(12).fill('stepUp'), ['fractalLeft'])),

  fancytownClassic: new Preset({nh: 19}, Array(12).fill('fancytown')),

  grayGoo: new Preset({nh: 19}, Object.assign(Array(10).fill('average'), ['total', 'total'])),
};