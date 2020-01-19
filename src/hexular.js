var Hexular = (function () {

  // --- SOME EXCITING DEFAULT VALUES ---

  // Default size for cubic (hexagonal) topology
  const DEFAULT_RADIUS = 30;
  // Default size for offset (rectangular) topology
  const DEFAULT_ROWS = 60;
  const DEFAULT_COLS = 60;

  const DEFAULT_RULE = nullRule;
  const DEFAULT_MAX_STATES = 2; // Only used by modulo filter

  const DEFAULT_CELL_RADIUS = 10;
  const DEFAULT_BORDER_WIDTH = 1.25;
  const DEFAULT_HIGHLIGHT_COLOR = '#ffbb33';
  const DEFAULT_HIGHLIGHT_LINE_WIDTH = 2;

  var DEFAULT_COLORS = [
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
    '#aa55bb'
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
      let defaults = {
        defaultTopology: CubicTopology,
        defaultRule: DEFAULT_RULE,
        maxStates: DEFAULT_MAX_STATES,
        rules: []
      };
      Object.assign(this,defaults, ...args);
      this.filters = [];
      this.adapters = new Set();
      this.topology = new this.defaultTopology(this);
      this.renderer = null;
      this._index = Model.created++;
      this.cells = this.topology.cells;
    }

    addAdapter(Class, ...args) {
      let adapter = new Class(this, ...args);
      this.adapters.add(adapter);
      return adapter;
    }

    removeAdapter(adapter) {
      this.adapter.delete(adapter);
    }

    addFilter(filter, idx) {
      idx = idx != null ? idx : this.filters.length;
      this.filters.splice(idx, 0, filter.bind(this));
    }

    removeFilter(filter) {
      let idx = this.filters.indexOf(filter);
      this.filters.splice(idx, 1);
      return idx;
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

    draw() {
      this.adapters.forEach((renderer) => {
        renderer.draw();
      });
    }

    get index() { return this._index; }
  }
  Model.created = 0;

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

  /** Common abstract class for topologies and adapters */

  class Topology {
    eachCoord() { methodNotImplemented(); }
    eachCell() { methodNotImplemented(); }
  }

  class OffsetTopology extends Topology {
    constructor(model, ...args) {
      super();
      let defaults = {
        rows: model.rows,
        cols: model.cols,
        cells: [],
        model
      };
      Object.assign(this, defaults, ...args);
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

    eachCoord(fn) {
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (fn([i, j]) === false) return false;
        }
      }
      return true;
    }

    eachCell(fn) {
      return this.eachCoord(([i, j]) => {
        let cell = this.cells[i * this.rows + j];
        return fn(cell, [i, j]);
      });
    }

    getCoords(renderer, cell) {
      let r = renderer.cellRadius;
      let [i, j] = cell.coord;

      // We again calculate cubic coords and shift x left once every 2 rows
      let y = renderer.basis[0][0] * i + renderer.basis[0][1] * j;
      let x = renderer.basis[1][0] * i + renderer.basis[1][1] * (j - Math.floor(i / 2));
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
    constructor(model, ...args) {
      super();
      let defaults = {
        radius: model.radius,
        model
      };
      Object.assign(this, defaults, ...args);
      let radius = this.radius;
      let max = this.max = this.radius - 1;
      let cols = this.cols = this.radius * 2 - 1;
      if (isNaN(radius) || radius == null) throw new HexError('CubicTopology requires radius to be defined');
      this.cells = Array(cols * 2).fill(null);
      this.eachCoord(([u, v, w]) => {
          // Being on the edge potentially effects draw actions involving neighbors
          let edge = absMax(u, v, w) == max;
          this.cells[u * cols + v] = new Cell(model, [u, v, w], {edge});
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
            if (Math.abs(nbr[dir]) > max) {
              let sign = Math.sign(nbr[dir]);
              let dirA = (dir + 1) % 3;
              let dirB = (dir + 2) % 3;
              nbr[dir] -= sign * cols;
              nbr[dirA] += sign * max;
              nbr[dirB] = -nbr[dir] - nbr[dirA];
            }
          }
          cell.neighbors[i] = this.cells[nbr[0] * cols + nbr[1]];
        }


      });
    }

    eachCell(fn) {
      return this.eachCoord(([u, v, w]) => {
        let cell = this.cells[u * this.cols + v];
        return fn(cell, [u, v, w]);
      });
    }

    eachCoord(fn) {
      for (let u = -this.max; u < this.radius; u++) {
        for (let v = -this.max; v < this.radius; v++) {
          let w = -u - v;
          if (Math.abs(w) > this.max) continue;
          if (fn([u, v, -u - v]) === false) return false;
        }
      }
      return true;
    }

    getCoords(renderer, cell) {
      let r = renderer.cellRadius;
      let [u, v, w] = cell.coord;

      let [y, x] = mult(renderer.basis, [u, v]);
      return [y, x];
    }

    cellAtCubic([u, v, w]) {
      if (absMax(u, v, w) > this.max)
        return null;
      let cell = this.cells[u * this.cols + v];
      return cell;
    }
  }

  class Adapter {
    validateKeys(...args) {
      for (let key of args)
        if (!this[key])
           throw new HexError(`${this.constructor.name} requires "${key}" to be defined`);
    }
    draw() { methodNotImplemented(); }
  }

  /** Class represting a renderer to draw to the DOM */
  class CanvasAdapter extends Adapter {
    constructor(model, ...args) {
      super();
      let defaults = {
        model,
        topology: model.topology,
        cellMap: new Map(),
        colors: DEFAULT_COLORS,
        highlightColor: DEFAULT_HIGHLIGHT_COLOR,
        highlightLineWidth: DEFAULT_HIGHLIGHT_LINE_WIDTH,
        cellRadius: DEFAULT_CELL_RADIUS,
        borderWidth: DEFAULT_BORDER_WIDTH
      };
      Object.assign(this, defaults, ...args);
      this.validateKeys('renderer', 'selector', 'cellRadius');

      // Precomputed math stuff

      this.innerRadius = this.cellRadius - this.borderWidth / (2 * math.apothem);
      this.vertices = elemOp(math.vertices, this.innerRadius);
      this.basis = elemOp(math.basis, this.cellRadius);

      // For imageData rectangle coords
      this.selectYOffset = Math.ceil(
        this.cellRadius * math.apothem + this.highlightLineWidth);
      this.selectXOffset = Math.ceil(
        this.cellRadius + this.highlightLineWidth);
      this.selectHeight = this.selectYOffset * 2;
      this.selectWidth = this.selectXOffset * 2;

      // Callback hooks for drawing actions

      this.onDrawCell = new HookList(this);
      this.onDrawCell.push(this.defaultDrawCell);

      this.onDrawSelector = new HookList(this);
      this.onDrawSelector.push(this.defaultDrawSelector);
      this.selected = {
        cell: null,
        y: 0,
        x: 0
      };

      this.topology.eachCell((cell) => {
        this.cellMap.set(cell, this.topology.getCoords(this, cell));
      });
    }

    // Draw all cells

    draw() {
      this.clear(this.renderer);
      this.topology.eachCell((cell) => {
        this.drawCell(cell);
      });
    }

    // Select cell and highlight on canvas

    selectCell(cell) {
      if (this.selected.cell != cell) {
        this.clear(this.selector);
        if (cell) {
          let [y, x] = this.cellMap.get(cell);
          this.selected.y = y - this.selectYOffset;
          this.selected.x = x - this.selectXOffset;
          this.drawSelector(cell);
        }
        this.selected.cell = cell;
      }
    }

    clear(ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }

    // Draw actions

    drawCell(cell) {
      this.onDrawCell.call(cell);
    }

    drawSelector(cell) {
      this.onDrawSelector.call(cell);
    }


    defaultDrawCell(cell) {
    // Use cell.owner when writing custom drawing callbacks
    this.drawHexPath(this.renderer, cell);
    this.renderer.fillStyle = this.colors[cell.state];
    this.renderer.fill();
  }

    defaultDrawSelector(cell) {
    this.drawHexPath(this.selector, cell);

    this.selector.strokeStyle = this.highlightColor;
    this.selector.lineWidth = this.highlightLineWidth;
    this.selector.stroke();
  }

    // Basic cell path for both cells and selector

    drawHexPath(ctx, cell) {
      const [y, x] = this.cellMap.get(cell);
      const vertices = this.vertices;
      ctx.beginPath();
      ctx.moveTo(x + vertices[0][1], y + vertices[0][0]);
      ctx.lineTo(x + vertices[1][1], y + vertices[1][0]);
      ctx.lineTo(x + vertices[2][1], y + vertices[2][0]);
      ctx.lineTo(x + vertices[3][1], y + vertices[3][0]);
      ctx.lineTo(x + vertices[4][1], y + vertices[4][0]);
      ctx.lineTo(x + vertices[5][1], y + vertices[5][0]);

      ctx.closePath();
    }

    // Get cell at y,x coords on canvas

    cellAt([y, x]) {
      // First convert to cubic coords
      let rawCubic = cartesianToCubic([y, x]);
      let cubic = roundCubic(rawCubic, this.cellRadius);
      let cell = this.topology.cellAtCubic(cubic);
      return cell;
    }
  }

  // TODO: Add SVG adapter

  // --- DEFAULT CELL CALLBACKS ---

  function nullRule(cell) {
    return cell.state;
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

  function absMax(...args) {
    return Math.max(...args.map((e) => Math.abs(e)));
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
    let du = Math.abs(ru - u);
    let dv = Math.abs(rv - v);
    let dw = Math.abs(rw - w);

    if (du > dv && du > dw)
      ru = -rv - rw;
    else if (du > dw)
      rv = -ru - rw;
    return [ru, rv, rw];
  }

  function methodNotImplemented() {
    throw new HexError('Method not implemented.')
  }

  // ---

  const Hexular = (...args) => {
    return new Model(...args);
  }

  Object.assign(Hexular, {
    HexError,
    nullRule,
    elemOp,
    math: Object.assign(math, {
      absMax,
      elemOp,
      mult,
      multMatrix,
      add,
      cartesianToCubic,
      roundCubic,
      mod
    }),
    classes: {
      Model,
      Cell,
      HookList,
      Topology,
      OffsetTopology,
      CubicTopology,
      Adapter,
      CanvasAdapter
    }
  });

  return Hexular;
})();

if (typeof module != 'undefined')
  module.exports = Hexular;