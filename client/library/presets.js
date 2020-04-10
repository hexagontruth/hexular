const Presets = {
  default: new Preset({filters: {deltaFilter: true}}, Array(12).fill('ennead')),

  enneadPlus: new Preset(
    {filters: {clipBottomFilter: true, modFilter: true, edgeFilter: true}},
    Array(12).fill('enneadPlus')
  ),

  gliderWorld: new Preset({filters: {edgeFilter: true}}, [
    'ennead',
    'ennead',
  ]),

  rainbowRoad: new Preset(Object.assign(Array(12).fill('stepUp'), ['fractalLeft'])),

  fancytownClassic: new Preset({nh: 19}, Array(12).fill('fancytown')),

  grayGoo: new Preset({nh: 19}, Object.assign(Array(10).fill('average'), ['total', 'total'])),

  bicameralJellyfish: new Preset(
    {
      defaultRule: 'average',
      filters: {clipBottomFilter: true, modFilter: false, edgeFilter: true}
    },
    Object.assign(Array(12).fill('average'), Array(6).fill('bicameral'))
  ),
};
