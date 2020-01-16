var Hexular = (function () {

  // --- SOME EXCITING DEFAULT VALUES ---

  // Default size for cubic (hexagonal) topology
  const DEFAULT_SIZE = 6;
  // Default size for offset (rectangular) topology
  const DEFAULT_ROWS = 60;
  const DEFAULT_COLS = 60;

  const DEFAULT_RULE = nullRule;
  const DEFAULT_MAX_STATES = 2; // Only used by modulo filter

  const DEFAULT_RADIUS = 10;
  const DEFAULT_BORDER_WIDTH = 1;
  const CANVAS_CLASS = 'hexular-canvas';
  const DEFAULT_HIGHLIGHT_COLOR = '#ffbb33';
  const DEFAULT_HIGHLIGHT_LINE_WIDTH = 2;

  const DEFAULT_TIMER_LENGTH = 100;

  let DEFAULT_COLORS = [
    '#ffffff',
    '#444444',
    '#ef482d',
    '#f7931d',
    '#f2c317',
    '#92b552',
    '#69babe', // I picked this before looking at the hex value
    '#725ca7'
  ];

  // --- MATH STUFF ---

  const APOTHEM = Math.sqrt(3) / 2;

  let math = {
    apothem: APOTHEM,
    inverseApothem: 1 / APOTHEM,
    vertices: [
      [-1, 0],
      [-0.5, -APOTHEM],
      [0.5, -APOTHEM],
      [1, 0],
      [0.5, APOTHEM],
      [-0.5, APOTHEM]
    ],
    basis: [
      [1.5, 0],
      [APOTHEM, 2 * APOTHEM]
    ],
    invBasis: [
      [2 / 3, 0],
      [-1 / 3, 1 / (2 * APOTHEM)]
    ]
  };

  let index = 0;

  let abs = Math.abs;

  /** Class representing a hexagonal error */

  class HexError extends Error {}

  /** Class representing a complete model instance */

  class Model {
    /**
    * Creates Model instance
    *
    * @param {...(function|object)} args - Function rules (indexed from 0) or Object overrides to merge with instance
    */
    constructor(...args) {
      Object.assign(this, Hexular.defaults);
      this.rules = [];
      this.filters = [];
      this.renderers = new Set();
      this.primaryRenderer = null;
      for (let arg of args) {
        if (arg instanceof Topology) {
          this.topology = arg;
        }
        else if (subclass(arg, Topology)) {
          this.topology = new arg(this);
        }
        else if (arg instanceof Renderer) {
          this.renderers.add(arg);
        }
        else if (typeof arg == 'function')
          this.rules.push(arg);
        else if (typeof arg == 'object')
          Object.assign(this, arg);
      }

      this.topology = this.topology || new this.defaultTopology();
      this.topology.init(this);
      this.renderers.forEach((renderer) => renderer.init(this));
      this.index = index++;
      this.timer = null;
      this.running = false;
      this.renderer = null;
      this.colors = this.colors.slice();

      this.cells = this.topology.cells;
    }

    renderTo(...args) {
      let Class = subclass(args[0], Renderer) ? args[0] : this.defaultRenderer;
      this.addRenderer(new Class(this, ...args));
      return this;
    }

    addRenderer(renderer) {
      this.renderers.add(renderer);
      if (this.renderers.size == 1)
        this.primaryRenderer = renderer;
    }

    addFilter(filter, idx) {
      idx = idx != null ? idx : this.filters.length;
      this.filters.splice(idx, 0, filter.bind(this));
    }

    // Iterate over u,v coords for each valid cell

    eachCoord(callback) {
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (callback(i, j, this) === false)
            return;
          }
        }
    }

    // Iterate over cells

    eachCell(fn) {
      this.topology.eachCell(fn);
    }

    // --- Timer/step stuff ---

    startStop() {
      if (this.timer) {
        this.stop();
        return false;
      }
      else {
        this.start();
        return true;
      }
    }

    start() {
      this.timer = setInterval(this.step.bind(this), this.timerLength);
      this.running = true;
    }

    stop() {
      clearTimeout(this.timer);
      this.timer = null;
      this.running = false;
    }

    step() {
      this.eachCell((cell) => {
        cell.nextState = (this.rules[cell.state] || this.defaultRule)(cell);
      });
      this.eachCell((cell) => {
        cell.state = cell.nextState;
      });
      this.draw();
    }

    clear() {
      this.eachCell((cell) => {
        cell.state = 0;
      });
      this.draw();
    }

    cellAt(...args) {
      return this._callPrimaryRenderMethod('cellAt', ...args);
    }

    selectCell(...args) {
      return this._callPrimaryRenderMethod('selectCell', ...args);
    }

    drawCell(...args) {
      return this._callPrimaryRenderMethod('drawCell', ...args);
    }

    draw() {
      this.renderers.forEach((renderer) => {
        renderer.draw();
      });
    }

    _callPrimaryRenderMethod(fnString, ...args) {
      if (this.primaryRenderer)
        return this.primaryRenderer[fnString](...args);
      else
        throw new HexError(`No primary renderer for ${this}`);
    }
  }

  /** Class representing a cell */

  class Cell {
    constructor(model, coord, ...args) {
      this.model = model;
      this.coord = coord;
      let defaults = {
        state: 0,
        nextState: 0,
        neighbors: Array(6)
      };
      Object.assign(this, defaults, ...args);
    }

    total() {
      return this.neighbors.reduce((a, e) => a + e.state, 0);
    }

    countAll() {
      return this.neighbors.reduce((a, e) => a + (e.state ? 1 : 0), 0);
    }

    count(state) {
      return this.neighbors.reduce((a, e) =>  a + (e.state == state ? 1 : 0), 0)
    }

    stateCounts() {
      let values = Array(this.model.maxStates).fill(0);
      for (let i = 0; i < 6; i ++)
        values[this.neighbors[i].state] += 1;
      return values;
    }

    stateMap() {
      return this.neighbors.map((e) => e.state);
    }

    max(states) {
      states = states || this.stateMap();
      return Math.max(...states);
    }

    min(states) {
      states = states || this.stateMap();
      return Math.min(...states);
    }

    offset(i) {
      return mod(this.state + i, this.model.numStates);
    }
  }

  /** Class representing a list of callback hooks */

  class HookList extends Array {
    constructor(owner) {
      super();
      this.owner = owner;
    }

   call() {
      for (let i = 0; i < this.length; i++)
        if (this[i].apply(this.owner, arguments) === false)
          return false;

      return true;
    }
  }

  /** Common abstract class for topologies and renderers */

  class Adapter {
    init() { Adapter.methodNotImplemented(); }
  }
  Adapter.methodNotImplemented = () => {throw new HexError('Method not implemented.')};

  class Topology extends Adapter {
    constructor() {
      super();
      this.cells = [];
    }
    eachCell() { Adapter.methodNotImplemented(); }
  }

  class OffsetTopology extends Topology {
    init(model) {
      this.cells = [];
      this.model = model;
      const rows = this.rows = model.rows;
      const cols = this.cols = model.cols;
      if (!this.rows || !this.cols) throw new HexError('OffsetTopology requires rows and columns to be defined');
      this.eachCoord(([i, j]) => {
        // Being on the edge potentially effects draw actions involving neighbors
        let edge = (i == 0 || i == this.rows - 1 || j == 0 || j == this.cols - 1);
        this.cells.push(new Cell(model, [i, j], {edge}));
      });

      // Connect cells
      this.eachCell((cell, [i, j]) => {
        let upRow = mod(i - 1, rows);
        let downRow = mod(i + 1, rows);
        let offset = downRow % 2;
        cell.neighbors[0] = this.cells[upRow * rows + mod(j - offset, cols)];
        cell.neighbors[1] = this.cells[i * rows + mod(j - 1, cols)];
        cell.neighbors[2] = this.cells[downRow * rows + mod(j - offset, cols)];
        cell.neighbors[3] = this.cells[downRow * rows + mod(j - offset + 1, cols)];
        cell.neighbors[4] = this.cells[i * rows + mod(j + 1, cols)];
        cell.neighbors[5] = this.cells[upRow * rows + mod(j - offset + 1, cols)];
      });
    }

    eachCell(fn) {
      return this.eachCoord(([i, j]) => {
        let cell = this.cells[i * this.rows + j];
        return fn(cell, [i, j]);
      });
    }

    eachCoord(fn) {
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (fn([i, j]) === false) return false;
        }
      }
      return true;
    }

    getCoords(renderer, cell) {
      let r = renderer.cellRadius;
      let xOffset = renderer.xOffset;
      let yOffset = renderer.yOffset;
      let [i, j] = cell.coord;

      // We again calculate cubic coords and shift x left once every 2 rows
      let y = yOffset + renderer.basis[0][0] * i + renderer.basis[0][1] * j;
      let x = xOffset + renderer.basis[1][0] * i + renderer.basis[1][1] * (j - Math.floor(i / 2));
      return [y, x];
    }

    cellAtCubic([u, v, w]) {
      // For offset, we shift every two rows to the left
      v += Math.floor(u / 2);
      let cell = this.model.cells[u * this.rows + v];
      return cell;
    }
  }

  class CubicTopology extends Topology {
    init(model) {
      this.model = model;
      const size = this.size = model.size;
      const rows = this.rows = size * 2 - 1;
      const radius = this.radius = this.size - 1;
      this.cells = Array(rows * 2).fill(null);

      if (!this.size) throw new HexError('CubicTopology requires size to be defined');
      this.eachCoord(([u, v, w]) => {
          // Being on the edge potentially effects draw actions involving neighbors
          let max = Math.max(abs(u), abs(v), abs(w));
          let edge = max == size - 1;
          this.cells[u * rows + v] = new Cell(model, [u, v, w], {edge});
      });

      // Connect cells
      let offset = Array(3);
      this.eachCell((cell, coord) => {
        for (let i = 0; i < 6; i++) {
          let dir1 = i >> 1;
          let dir2 = (dir1 + 1 + i % 2) % 3;
          let dir3 = (dir1 + 1 + +!(i % 2)) % 3;
          let nbr = coord.slice();
          nbr[dir1] += 1;
          nbr[dir2] -= 1;
          nbr[dir3] = -nbr[dir1] - nbr[dir2];
          for (let dir of [dir1, dir2, dir3]) {
            if (abs(nbr[dir]) > this.radius) {
              let sign = Math.sign(nbr[dir]);
              let dirA = (dir + 1) % 3;
              let dirB = (dir + 2) % 3;
              nbr[dir] -= sign * (this.radius * 2 + 1);
              nbr[dirA] += sign * this.radius;
              nbr[dirB] = -nbr[dir] - nbr[dirA];
            }
          }
          cell.neighbors[i] = this.cells[nbr[0] * rows + nbr[1]];
        }


      });
    }

    eachCell(fn) {
      return this.eachCoord(([u, v, w]) => {
        let cell = this.cells[u * this.rows + v];
        return fn(cell, [u, v, w]);
      });
    }

    eachCoord(fn) {
      for (let u = -this.size + 1; u < this.size; u++) {
        for (let v = -this.size + 1; v < this.size; v++) {
          let w = -u - v;
          if (abs(w) > this.radius) continue;
          if (fn([u, v, -u - v]) === false) return false;
        }
      }
      return true;
    }

    getCoords(renderer, cell) {
      let r = renderer.cellRadius;
      let [u, v, w] = cell.coord;

      let [y, x] = mult(renderer.basis, [u, v]);
      y += renderer.yOffset;
      x += renderer.xOffset;
      return [y, x];
    }

    cellAtCubic([u, v, w]) {
      u -= this.size;
      v -= this.size;
      let cell = this.model.cells[u * this.rows + v];
      return cell;
    }
  }

  /** Class represting a renderer to draw to the DOM */
  class Renderer extends Adapter {
    constructor(...args) {
      super();
      this.cellMap = new Map();
      this.init(...args);
    }
    draw() { Adapter.methodNotImplemented(); }
  }

  class CanvasRenderer extends Renderer {
    init(model, canvas, cellRadius) {
      this.model = model;
      this.topology = model.topology;
      this.canvas = canvas;
      this.cellRadius = cellRadius;
      this.context = canvas.getContext('2d');
      const radius = this.radius = model.radius, rows = model.rows, cols = model.cols;

      this.canvas.height  = 2 * radius * (rows + 1.5) * 0.75;
      this.canvas.width = 2 * radius * (cols + 1.5) * math.apothem;
      this.context.translate(this.canvas.width / 2, this.canvas.height / 2);

      this.canvas.classList.add(CANVAS_CLASS);

      // Precomputed math stuff

      this.innerRadius = radius - this.model.borderWidth / (2 * math.apothem);
      this.vertices = elemOp(math.vertices, this.innerRadius);

      this.basis = elemOp(math.basis, radius);

      this.yOffset = 2 * radius;
      this.xOffset = 2 * radius * math.apothem;

      // For imageData rectangle coords
      this.selectYOffset = Math.ceil(
        radius * math.apothem + this.model.highlightLineWidth);
      this.selectXOffset = Math.ceil(
        radius + this.model.highlightLineWidth);
      this.selectHeight = this.selectYOffset * 2;
      this.selectWidth = this.selectXOffset * 2;

      // Callback hooks for drawing actions

      this.onDrawCell = new HookList(this);
      this.onDrawCell.push(defaultDrawCell);

      this.onDrawSelector = new HookList(this);
      this.onDrawSelector.push(defaultDrawSelector);
      this.selected = {
        cell: null,
        imageData: null,
        y: 0,
        x: 0
      };

      this.topology.eachCell((cell) => {
        this.cellMap.set(cell, this.topology.getCoords(this, cell));
      });
    }

    // Draw all cells

    draw() {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.topology.eachCell((cell) => {
        this.drawCell(cell);
      });

      if (this.selected.cell) {
        this.getImageData();
        this.drawSelector(this.selected.cell);
      }
    }

    // Select cell and highlight on canvas

    selectCell(cell) {
      if (this.selected.cell != cell) {
        if (this.selected.cell) {
          this.putImageData()
        }
        if (cell) {
          let [y, x] = this.cellMap.get(cell);
          this.selected.y = y - this.selectYOffset;
          this.selected.x = x - this.selectXOffset;
          this.getImageData();
          this.drawSelector(cell);
        }
        this.selected.cell = cell;
      }
    }

    // Get backup image data for selected cell and store to selected.imageData

    getImageData() {
      this.selected.imageData = this.context.getImageData(
        this.selected.x,
        this.selected.y,
        this.selectWidth,
        this.selectHeight);
    }

    // Replace image data when overwriting last selector

    putImageData() {
      this.context.putImageData(
        this.selected.imageData,
        this.selected.x,
        this.selected.y);
    }

    // Draw actions

    drawCell(cell) {
      this.onDrawCell.call(cell);
    }

    drawSelector(cell) {
      this.onDrawSelector.call(cell);
    }

    // Basic cell path for both cells and selector

    drawHexPath(cell) {
      const [y, x] = this.cellMap.get(cell);
      const context = this.context;
      const vertices = this.vertices;
      context.beginPath();
      context.moveTo(x + vertices[0][1], y + vertices[0][0]);

      context.lineTo(x + vertices[1][1], y + vertices[1][0]);
      context.lineTo(x + vertices[2][1], y + vertices[2][0]);
      context.lineTo(x + vertices[3][1], y + vertices[3][0]);
      context.lineTo(x + vertices[4][1], y + vertices[4][0]);
      context.lineTo(x + vertices[5][1], y + vertices[5][0]);

      context.closePath();
    }

    // Get cell at y,x coords on canvas

    cellAt([y, x]) {
      y -= this.yOffset;
      x -= this.xOffset;
      // First convert to cubic coords
      let rawCubic = cartesianToCubic([y, x]);
      let cubic = roundCubic(rawCubic, this.cellRadius)
      let cell = this.topology.cellAtCubic(cubic);
      return cell;
    }
  }

  // TODO: Add SVG renderer

  // --- DEFAULT CELL CALLBACKS ---

  function nullRule(cell) {
    return cell.state;
  }

  function defaultDrawCell(cell) {
    // Use cell.owner when writing custom drawing callbacks
    this.drawHexPath(cell);
    this.context.fillStyle = this.model.colors[cell.state];
    this.context.fill();
  }

  function defaultDrawSelector(cell) {
    this.drawHexPath(cell);

    this.context.strokeStyle = this.model.highlightColor;
    this.context.lineWidth = this.model.highlightLineWidth;
    this.context.stroke();
  }

  // --- OPTIONAL FILTERS ---

  function modFilter(state) {
    return mod(state, this.maxStates);
  }

  // --- UTILITY FUNCTIONS ---

  // Recursive element-wise arithmetic

  function elemOp(obj, scalar, op) {
    if (obj.length)
      return obj.map(function(val, i) {
        return elemOp(val, scalar, op);
      });
    else
      return op == '+' ? obj + scalar : obj * scalar;
  }

  // Mod for reals

  function mod(k, n) {
    return ((k % n) + n) % n;
  }

  function subclass(constructor, superclass) {
    return constructor == superclass || constructor.prototype instanceof superclass;
  }

  function orAssign(cur, val) {
    return cur === undefined ? val : cur;
  }

  function mult(m, n) {
    return Array.isArray(n[0]) ? multMatrix(m, n) : multMatrix(m, [n])[0];
  }

  function multMatrix(m, n) {
    return n.map((nCol) => {
      let productRow = [];
      for (let mRow = 0; mRow < m.length; mRow++) {
        productRow.push(nCol.reduce((a, nEntry, mCol) => {
          return a + m[mRow][mCol] * nEntry;
        }, 0));
      }
      return productRow;
    });
  }

  function add(u, v) {
    return Array.isArray(u) ? u.map((e, i) => add(e, v[i])) : u + v;
  }

  function cartesianToCubic([y, x]) {
    let [u, v] = mult(math.invBasis, [y, x]);
    let w = -u - v;
    return [u, v, w];
  }

  function roundCubic([u, v, w], radius) {
    radius = radius || 1;

    let ru = Math.round(u / radius);
    let rv = Math.round(v / radius);
    let rw = Math.round(w / radius);
    // TODO: Do this better
    let du = abs(ru - u);
    let dv = abs(rv - v);
    let dw = abs(rw - w);

    if (du > dv && du > dw)
      ru = -rv - rw;
    else if (du > dw)
      rv = -ru - rw;
    return [ru, rv, rw];
  }

  // ---

  const Hexular = (...args) => {
    return new Model(...args);
  }

  Object.assign(Hexular, {
    HexError,
    nullRule,
    defaultDrawCell,
    defaultDrawSelector,
    elemOp,
    math,
    mod,
    defaults: {
      defaultTopology: CubicTopology,
      defaultRenderer: CanvasRenderer,
      defaultRule: nullRule,
      rows: DEFAULT_ROWS,
      cols: DEFAULT_COLS,
      size: DEFAULT_SIZE,
      defaultRule: DEFAULT_RULE,
      maxStates: DEFAULT_MAX_STATES,
      colors: DEFAULT_COLORS,
      radius: DEFAULT_RADIUS,
      borderWidth: DEFAULT_BORDER_WIDTH,
      highlightColor: DEFAULT_HIGHLIGHT_COLOR,
      highlightLineWidth: DEFAULT_HIGHLIGHT_LINE_WIDTH,
      timerLength: DEFAULT_TIMER_LENGTH
    },
    renderers: {
      Renderer,
      CanvasRenderer
    }
  });

  return Hexular;
})();

if (typeof module != 'undefined')
  module.exports = Hexular;