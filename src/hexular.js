var Hexular = (function () {

  // --- SOME EXCITING DEFAULT VALUES ---

  // Default size for cubic (hexagonal) topology
  const DEFAULT_RADIUS = 30;
  // Default size for offset (rectangular) topology
  const DEFAULT_ROWS = 60;
  const DEFAULT_COLS = 60;

  const DEFAULT_RULE = identityRule;
  const DEFAULT_NUM_STATES = 2; // Only used by modulo filter
  const DEFAULT_GROUND_STATE = 0;

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
  HexError.methodNotImplemented = (methodName) => {
    throw new HexError(`Method not implemented: "${methodName}"`);
  }
  HexError.validateKeys = (obj, ...args) => {
    for (let key of args)
      if (!obj[key])
         throw new HexError(`${obj.constructor.name} requires "${key}" to be defined`);
  }

  /** Class representing a complete model instance */

  class Model {
    /**
    * Creates Model instance
    *
    * @param {...(function|object)} args - Function rules (indexed from 0) or Object overrides to merge with instance
    */
    constructor(...args) {
      let defaults = {
        defaultRule: DEFAULT_RULE,
        numStates: DEFAULT_NUM_STATES,
        groundState: DEFAULT_GROUND_STATE,
        rules: [],
        filters: new HookList(),
        index: Model.create++,
      };
      Object.assign(this, defaults, ...args);
      Object.entries(attributes.classes.adapters).forEach(([className, Class]) => {
        this[className] = (...args) => new Class(this, ...args);
      });
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

    step() {
      this.eachCell((cell) => {
        let nextState = (this.rules[cell.state] || this.defaultRule)(cell);
        cell.nextState = this.filters.call(nextState);
      });
      this.eachCell((cell) => {
        cell.state = cell.nextState;
      });
    }

    clear() {
      this.eachCell((cell) => {
        cell.state = this.groundState;
      });
    }

    eachCoord(callback) { HexError.methodNotImplementedError('eachCoord'); }

    eachCell(fn) { HexError.methodNotImplementedError('eachCell'); }

    getCells() { HexError.methodNotImplementedError('getCells'); }

    export() { HexError.methodNotImplementedError('export'); }

    import(buffer) { HexError.methodNotImplementedError('import'); }

  }
  Model.created = 0;

  class OffsetModel extends Model {
    constructor(...args) {
      super();
      let defaults = {
        rows: DEFAULT_ROWS,
        cols: DEFAULT_COLS,
        cells: [],
      };
      Object.assign(this, defaults, ...args);
      HexError.validateKeys(this, 'rows', 'col');
      this.eachCoord(([i, j]) => {
        // Being on an edge affects draw actions involving neighbors
        let edge = (i == 0 || i == this.rows - 1 || j == 0 || j == this.cols - 1);
        this.cells.push(new Cell(this, [i, j], {edge}));
      });

      // Connect cells
      this.eachCell((cell, [i, j]) => {
        let upRow = mod(i - 1, rows);
        let downRow = mod(i + 1, rows);
        let offset = downRow % 2;
        cell.setNeighbor(6, 0, this.cells[upRow * rows + mod(j - offset, cols)]);
        cell.setNeighbor(6, 1, this.cells[i * rows + mod(j - 1, cols)]);
        cell.setNeighbor(6, 2, this.cells[downRow * rows + mod(j - offset, cols)]);
        cell.setNeighbor(6, 3, this.cells[downRow * rows + mod(j - offset + 1, cols)]);
        cell.setNeighbor(6, 4, this.cells[i * rows + mod(j + 1, cols)]);
        cell.setNeighbor(6, 5, this.cells[upRow * rows + mod(j - offset + 1, cols)]);
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
      let cell = this.cells[u * this.rows + v];
      return cell;
    }
  }

  class CubicModel extends Model {
    constructor(...args) {
      super(...args);
      let radius = this.radius = this.radius || DEFAULT_RADIUS;
      HexError.validateKeys(this, 'radius');
      this.size = radius * (radius - 1) * 3 + 1;
      let max = this.max = radius - 1;
      let cols = this.cols = radius * 2 - 1;
      let cells = this.cells = Array(cols * 2).fill(null);



      this.eachCoord(([u, v, w]) => {
          // Being on an edge affects draw actions involving neighbors
          let edge = absMax(u, v, w) == max;
          this.cells[u * cols + v] = new Cell(this, [u, v, w], {edge});
      });

      // Connect cells
      let offset = Array(3);
      this.eachCell((cell, coord) => {
        cell.addNeighborhoods(6);
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
          cell.setNeighbor(6, i, this.cells[nbr[0] * cols + nbr[1]]);
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

    getCells() {
      return Object.values(this.cells).filter((e) => e);
    }

    export() {
      let bytes = Int8Array.from(this.getCells().map((e) => e.state));
      return bytes;
    }

    import(bytes) {
      let length = bytes.length;
      let offset = this.size - length;
      let cells = this.getCells();
      bytes.forEach((state, idx) => {
        let cellIdx = idx + offset;
        if (cells[cellIdx])
          cells[cellIdx].state = state;
      });
      this.draw();
    }
  }

  /** Class representing a cell */

  class Cell {
    constructor(model, coord, ...args) {
      let defaults = {
        model,
        coord,
        state: model.groundState,
        nextState: 0,
        nbr: {
          1: [self],
          // Canonical neighborhoods
          6: Array(6).fill(this),
          12: Array(12).fill(this),
          18: Array(18).fill(this),
          // Derived neighborhoods
          7: Array(7).fill(this),
          13: Array(13).fill(this),
          19: Array(19).fill(this),
        },
        implementedNeighborhoods: new Set([1]),
      };
      Object.assign(this, defaults, ...args);
    }

    setNeighbor(canonicalRing, idx, cell) {
      let neighborhoods = [6, 12, 18].filter((e) => e >= canonicalRing);
      let cur;
      while (cur = neighborhoods.pop()) {
        this.nbr[cur][idx] = cell;
        this.nbr[cur + 1][idx] = cell;
      }
    }

    addNeighborhoods(...neighborhoods) {
      neighborhoods.forEach((e) => {
        this.implementedNeighborhoods.add(e)
      });
    }

    implements(neighborhood) {
      return this.implementedNeighborhoods.has(neighborhood);
    }

    get total() {
      return this.nbr[6].reduce((a, e) => a + e.state, 0);
    }

    get count() {
      return this.nbr[6].reduce((a, e) => a + (e.state ? 1 : 0), 0);
    }

    get histogram() {
      let values = Array(this.numStates).fill(0);
      for (let i = 0; i < this.numStates; i ++)
        values[this.nbr[6][i].state] += 1;
      return values;
    }

    countState(state) {
      return this.nbr[6].reduce((a, e) =>  a + (e.state == state ? 1 : 0), 0);
    }
  }

  /** Class representing a list of callback hooks */

  class HookList extends Array {
    constructor(owner) {
      super();
      this.owner = owner;
    }

    call(val) {
      for (let i = 0; i < this.length; i++) {
        let newVal = this[i].call(this.owner, val);
        val = newVal === undefined ? val : newVal;
      }
      return val;
    }
  }

  class Adapter {
    draw() { HexError.methodNotImplemented('draw'); }
  }

  /** Class represting a renderer to draw to the DOM */
  class CanvasAdapter extends Adapter {
    constructor(model, ...args) {
      super();
      let defaults = {
        model,
        cellMap: new Map(),
        colors: DEFAULT_COLORS,
        highlightColor: DEFAULT_HIGHLIGHT_COLOR,
        highlightLineWidth: DEFAULT_HIGHLIGHT_LINE_WIDTH,
        cellRadius: DEFAULT_CELL_RADIUS,
        borderWidth: DEFAULT_BORDER_WIDTH,
      };
      Object.assign(this, defaults, ...args);
      HexError.validateKeys(this, 'renderer', 'selector', 'cellRadius');

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

      this.model.eachCell((cell) => {
        this.cellMap.set(cell, this.model.getCoords(this, cell));
      });
    }

    // Draw all cells

    draw() {
      this.clear(this.renderer);
      this.model.eachCell((cell) => {
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

    cellAt([x, y]) {
      // First convert to cubic coords
      let rawCubic = cartesianToCubic([y, x]);
      let cubic = roundCubic(rawCubic, this.cellRadius);
      let cell = this.model.cellAtCubic(cubic);
      return cell;
    }
  }

  // TODO: Add SVG adapter

  // --- DEFAULT CELL CALLBACKS ---

  function identityRule(cell) {
    return cell.state;
  }

  function nullRule(cell) {
    return 0;
  }

  // --- OPTIONAL FILTERS ---

  function modFilter(state) {
    return mod(state, this.numStates);
  }

  function ruleBuilder(n) {
    return (cell) => {
      // TODO: This
    };
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

  // ---

  let attributes = {
    defaults: {
      model: CubicModel
    },
    rules: {
      identityRule,
      nullRule,
    },
    filters: {
      modFilter,
    },
    utility: {
      ruleBuilder,
    },
    math: Object.assign(math, {
      absMax,
      elemOp,
      mult,
      multMatrix,
      add,
      cartesianToCubic,
      roundCubic,
      mod,
    }),
    classes: {
      adapters: {
        CanvasAdapter,
      },
      models: {
        OffsetModel,
        CubicModel,
      },
      HexError,
      Model,
      Cell,
      HookList,
      Adapter,
    },
  };

  const Hexular = (...args) => {
    let Class = (args[0] instanceof Model) ? args.shift() : attributes.defaults.model;
    return new Class(...args);
  }

  Object.assign(Hexular, attributes);

  return Hexular;
})();

if (typeof module != 'undefined')
  module.exports = Hexular;