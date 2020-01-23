var Hexular = (function () {

  // --- SOME EXCITING DEFAULT VALUES ---

  // Default size for cubic (hexagonal) topology
  const DEFAULT_RADIUS = 30;
  // Default size for offset (rectangular) topology
  const DEFAULT_ROWS = 60;
  const DEFAULT_COLS = 60;

  const DEFAULT_RULE = identityRule;
  const DEFAULT_NUM_STATES = 2; // Only used by modulo filter and histogram
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
      [2 * APOTHEM, APOTHEM],
      [0,           1.5]
    ],
    invBasis: [
      [1 / (2 * APOTHEM), -1 / 3],
      [0,                 2 / 3]
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

    setNeighborhood(neighborhood) {
      this.eachCell((cell) => {
        cell.neighborhood = neighborhood;
      })
    }

    eachCoord(callback) { HexError.methodNotImplemented('eachCoord'); }

    eachCell(fn) { HexError.methodNotImplemented('eachCell'); }

    export() {
      let bytes = Int8Array.from(this.cells.map((e) => e.state));
      return bytes;
    }

    import(bytes) { HexError.methodNotImplemented('import'); }
  }
  Model.created = 0;

  class OffsetModel extends Model {
    constructor(...args) {
      super();
      let defaults = {
        cols: DEFAULT_COLS,
        rows: DEFAULT_ROWS,
        cells: [],
      };
      Object.assign(this, defaults, ...args);
      HexError.validateKeys(this, 'rows', 'cols');
      let rows = this.rows, cols = this.cols;
      this.eachCoord(([i, j]) => {
        // Being on an edge affects draw actions involving neighbors
        let edge = (i == 0 || i == this.cols - 1 || j == 0 || j == rows - 1);
        this.cells.push(new Cell(this, [i, j], {edge}));
      });

      // Connect simple neighbors
      this.eachCell((cell, [i, j]) => {
        let upRow = mod(j - 1, rows);
        let downRow = mod(j + 1, rows);
        let offset = downRow % 2;

        cell.nbrs[1] = this.cells[downRow * cols + mod(i - offset + 1, cols)];
        cell.nbrs[2] = this.cells[j * cols + mod(i + 1, cols)];
        cell.nbrs[3] = this.cells[upRow * cols + mod(i - offset + 1, cols)];
        cell.nbrs[4] = this.cells[upRow * cols + mod(i - offset, cols)];
        cell.nbrs[5] = this.cells[j * cols + mod(i - 1, cols)];
        cell.nbrs[6] = this.cells[downRow * cols + mod(i - offset, cols)];
      });

      // Connect extended neighbors
      this.eachCell((cell) => {
        cell.extendNeighborhood();
      });
    }

    eachCoord(fn) {
      for (let j = 0; j < this.rows; j++) {
        for (let i = 0; i < this.cols; i++) {
          if (fn([i, j]) === false) return false;
        }
      }
      return true;
    }

    eachCell(fn) {
      return this.eachCoord(([i, j]) => {
        let cell = this.cells[j * this.cols + i];
        return fn(cell, [i, j]);
      });
    }

    getCoords(renderer, cell) {
      let r = renderer.cellRadius;
      let [i, j] = cell.coord;

      // Like converting to cubic coords but mod 2 wrt x offset
      let x = renderer.basis[0][0] * i + renderer.basis[0][1] * (j % 2);
      let y = renderer.basis[1][0] * i + renderer.basis[1][1] * j;
      return [x, y];
    }

    cellAtCubic([u, v, w]) {
      // For offset, we shift every two rows to the left
      v += u >> 1;
      let cell = this.cells[u * this.cols + v];
      return cell;
    }

    import(bytes) {
      this.cells.forEach((cell, idx) => {
        cell.state = bytes[idx] || this.groundState;
      });
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
      this.rhombus = Array(cols * 2).fill(null);

      this.eachCoord(([u, v, w]) => {
          // Being on an edge affects draw actions involving neighbors
          let edge = absMax(u, v, w) == max;
          this.rhombus[u * cols + v] = new Cell(this, [u, v, w], {edge});
      });

      this.cells = Object.values(this.rhombus).filter((e) => e);

      // Connect simple neighbors
      this.eachCell((cell) => {
        for (let i = 0; i < 6; i++) {
          let dir1 = i >> 1;
          let dir2 = (dir1 + 1 + i % 2) % 3;
          let dir3 = (dir1 + 1 + +!(i % 2)) % 3;
          let nbr = cell.coord.slice();
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
          cell.nbrs[1 + (i + 5) % 6] = this.rhombus[nbr[0] * cols + nbr[1]];
        }
      });

      // Connect extended neighbors
      this.eachCell((cell) => {
        cell.extendNeighborhood();
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

    eachCell(fn) {
      let a = [];
      for (let i = 0; i < this.cells.length; i++) {
        a.push(fn(this.cells[i]));
      }
      return a;
    }

    getCoords(renderer, cell) {
      let r = renderer.cellRadius;
      let [u, v, w] = cell.coord;

      let [x, y] = mult(renderer.basis, [v, u]);
      return [x, y];
    }

    cellAtCubic([u, v, w]) {
      if (absMax(u, v, w) > this.max)
        return null;
      let cell = this.rhombus[u * this.cols + v];
      return cell;
    }

    import(bytes) {
      let length = bytes.length;
      let offset = this.size - length;
      bytes.forEach((state, idx) => {
        let cellIdx = idx + offset;
        if (this.cells[cellIdx])
          this.cells[cellIdx].state = state;
      });
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
        nbrs: new Array(19).fill(null),
        neighborhood: 6,
      };
      Object.assign(this, defaults, ...args);
      this.nbrs[0] = this;
      this.with = {
        6: new Neighborhood(this, 1, 7),
        12: new Neighborhood(this, 1, 13),
        18: new Neighborhood(this, 1, 19),
        7: new Neighborhood(this, 0, 7),
        13: new Neighborhood(this, 0, 13),
        19: new Neighborhood(this, 0, 19),
      };
    }

    extendNeighborhood() {
      for (let i = 1; i < 7; i++) {
        let source12 = 1 + (i + 4) % 6;
        this.nbrs[i + 6] = this.nbrs[i].nbrs[source12];
        this.nbrs[i + 12] = this.nbrs[i].nbrs[i];
      }
    }

    get total() { return this.with[this.neighborhood].total; }

    get count() { return this.with[this.neighborhood].count; }

    get histogram() { return this.with[this.neighborhood].histogram; }
  }

  class Neighborhood {
    constructor(cell, min, max) {
      this.cell = cell;
      this.nbrs = cell.nbrs;
      this.min = min;
      this.max = max;
      this.length = max - min;
    }

    get total() {
      let a = 0;
      for (let i = this.min; i < this.max; i++)
        a += this.nbrs[i].state;
      return a;
    }

    get count() {
      try {
      let a = 0;
      for (let i = this.min; i < this.max; i++)
        a += this.nbrs[i].state ? 1 : 0;
      return a;} catch (e) {console.log(this,this.cell,this.cell.coord); console.trace(); throw e;}
    }

    get histogram() {
      let a = Array(this.numStates).fill(0);
      for (let i = this.min; i < this.max; i ++)
        a[this.nbrs[i].state] += 1;
      return a;
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
      this.vertices = scalarOp(math.vertices, this.innerRadius);
      this.basis = scalarOp(math.basis, this.cellRadius);

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
        x: 0,
        y: 0
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
          let [x, y] = this.cellMap.get(cell);
          this.selected.x = x - this.selectXOffset;
          this.selected.y = y - this.selectYOffset;
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
      const [x, y] = this.cellMap.get(cell);
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
      let rawCubic = cartesianToCubic([x, y]);
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

  /**
  * Generates an elementary rule based on 7-bit state of cell+neighbors
  *
  * @param {bigint|array} ruleDef 128-bit number indicating next position per possible state, or array of 7-bit numbers giving
  *                       individual states where next cell state is 1.
  * @param {bool} inc Whether to include cell state. Defaults to false by way of undefined
  **/
  function ruleBuilder(ruleDef, inc) {
    let n = BigInt(ruleDef);
    if (typeof ruleDef == 'object') {
      n = 0n;
      for (let state of ruleDef) {
        n = n | 1n << BigInt(state);
      }
    }
    let startIdx = +!inc;
    return (cell) => {
      let mask = 0;
      for (let i = startIdx; i < 7; i++) {
        mask = mask | (cell.nbrs[i].state ? 1 : 0) << i;
      }
      return Number((n >> BigInt(mask)) % 2n);
    };
  }

  // --- UTILITY FUNCTIONS ---

  // Recursive element-wise arithmetic

  function scalarOp(obj, scalar, op) {
    if (obj.length)
      return obj.map(function(val, i) {
        return scalarOp(val, scalar, op);
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

  function cartesianToCubic([x, y]) {
    let [v, u] = mult(math.invBasis, [x, y]);
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
    util: {
      ruleBuilder,
    },
    math: Object.assign(math, {
      absMax,
      scalarOp,
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
    let Class = (args[0].prototype instanceof Model) ? args.shift() : attributes.defaults.model;
    return new Class(...args);
  }

  Object.assign(Hexular, attributes);

  return Hexular;
})();

if (typeof module != 'undefined')
  module.exports = Hexular;