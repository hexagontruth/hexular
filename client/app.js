// --- INIT ---

const DEFAULTS = new OptParser({
  radius: 60,
  cellRadius: 10,
  numStates: 12,
  maxNumStates: 12,
  groundState: 0,
  nh: 6,
  binaryFilter: false,
  deltaFilter: false,
  clipBottomFilter: false,
  clipTopFilter: false,
  modFilter: true,
  edgeFilter: false,
  defaultRule: 'identityRule',
  interval: 100,
  autopause: true,
  undoStackSize: 64,
  mobileRadius: 30,
  mobileCellRadius: 15,
  mobileUndoStackSize: 16,
  preset: 'default',
  theme: 'light',
  showModelBackground: true,
  borderWidth: 1,
  themes: Config.merge(Themes),
  presets: Config.merge({}, Presets),
  availableRules: Config.merge({}, Rules),
  arrayType: 'Int8Array',
  defaultImageFilename: 'hexular.png',
  defaultFilename: 'hexular.bin',
  defaultVideoFilename: 'hexular.webm',
  scaleFactor: 1,
  tool: 'brush',
  shiftTool: 'move',
  toolSize: 1,
  colorMode: 0,
  paintColors: [1, 0],
  steps: 0,
});

const OnMouseEvent = EventHole('mousedown', 'mouseup', 'mouseout', 'mousemove');
const OnTouchEvent = EventHole('touchstart', 'touchmove', 'touchend');

window.addEventListener('load', function(e) {
  if (DEFAULTS.mobile)
    document.body.classList.add('mobile');
  Select.init('.modal select');
  Board.resize();
});

