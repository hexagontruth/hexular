var Hexular = (function () {

  // --- SOME EXCITING DEFAULT VALUES ---

  const DEFAULT_ROWS = 60;
  const DEFAULT_COLS = 60;
  const DEFAULT_RULE = nullRule;
  const DEFAULT_MAX_STATES = 12; // This is only used as a helper constant for computing modulo states - 

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

  let index = 0;

  // --- MATH STUFF ---

  const APOTHEM = Math.sqrt(3) / 2;

  let math = {
    tau: Math.PI * 2,
    arc: Math.PI / 3,
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
      1.5, 0,
      APOTHEM, 2 * APOTHEM
    ],
    invBasis: [
      2 / 3, 0,
      -1 / 3, 1 / (2 * APOTHEM)
    ]
  };

  class HexError extends Error {}

  /** Class representing a complete Hexular instance */

  class Hexular {
    /**
    * Creates Hexular instance
    *
    * @param {...(function|object)} args - Function rules (indexed from 0) or Object overrides to merge with instance
    */
    constructor(...args) {
      Object.assign(this, Hexular.defaults);
      this.rules = [];
      for (let arg of args) {
        if (typeof arg == 'function')
          this.rules.push(arg);
        else if (typeof arg == 'object')
          Object.assign(this, arg);
      }

      this.index = index++;
      this.timer = null;
      this.running = false;
      this.colors = this.colors.slice();
      this.renderer = new this.renderer(this);

      const radius = this.radius;
      const rows = this.rows;
      const cols = this.cols;

      // Initialize cells

      this.cells = new Array(rows);
      for (let i = 0; i < rows; i++)
        this.cells[i] = new Array(cols);

      this.eachCoord((u, v) => {
        this.cells[u][v] = new Cell(this, u, v);
      });

      // Connect cells
      for (let i = 0; i < rows; i++) {
        let upRow = mod(i - 1, rows);
        let downRow = mod(i + 1, rows);
        let offset = downRow % 2;
        for (let j = 0; j < cols; j++) {
          const cell = this.cells[i][j];
          cell.neighbors[0] = this.cells[upRow][mod(j - offset, cols)];
          cell.neighbors[1] = this.cells[i][mod(j - 1, cols)];
          cell.neighbors[2] = this.cells[downRow][mod(j - offset, cols)];
          cell.neighbors[3] = this.cells[downRow][mod(j - offset + 1, cols)];
          cell.neighbors[4] = this.cells[i][mod(j + 1, cols)];
          cell.neighbors[5] = this.cells[upRow][mod(j - offset + 1, cols)];
        }
      }
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

    eachCell(callback) {
      this.eachCoord((u, v) => {
        return callback(this.cells[u][v]);
      });
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
        cell.nextState = this.rules[cell.state](cell);
      });
      this.eachCell((cell) => {
        cell.state = cell.nextState;
      });
      this.renderer.draw();
    }

    clear() {
      this.eachCell((cell) => {
        cell.state = 0;
      });
      this.renderer.draw();
    }

    test(n) {
      n = n || 64;

      let a = +new Date();

      for (let i = 0; i < n; i++)
        this.step();

      let b = +new Date();

      return b - a;
    }

  }

  /** Class representing a cell */

  class Cell {
    constructor(owner, u, v) {
      this.owner = owner;
      this.u = u;
      this.v = v;

      // Useful for custom drawing actions that involve paths between neighbors
      this.isEdge =
        (u == 0 || u == owner.rows - 1 || v == 0 || v == owner.cols - 1);

      // We again calculate cubic coords and shift x left once every 2 rows
      this.y = owner.renderer.yOffset + owner.renderer.basis[0] * u + owner.renderer.basis[1] * v;
      this.x = owner.renderer.xOffset + owner.renderer.basis[2] * u + owner.renderer.basis[3] *
        (v - Math.floor(u / 2));

      this.state = 0;
      this.nextState = null;
      this.neighbors = Array(6);
    }

    total() {
      let tot = 0
      for (let i = 0; i < 6; i ++)
        tot += this.neighbors[i].state;
      return tot;
    }

    countAll() {
      let count = 0
      for (let i = 0; i < 6; i ++)
        if (this.neighbors[i].state > 0)
          count++;
      return count;
    }

    count(state) {
      let count = 0;
      for (let i = 0; i < 6; i ++)
        if (this.neighbors[i].state == state)
          count ++;
      return count;
    }

    counts() {
      let values = Array(this.owner.maxStates).fill(0);
      for (let i = 0; i < 6; i ++)
        values[this.neighbors[i].state] += 1;
      return values;
    }

    stateMap() {
      return this.neighbors.map((e) => this.state);
    }

    max(states) {
      states = states || this.stateMap();
      return Math.max.apply(null, this.stateMap());
    }

    min(states) {
      states = states || this.stateMap();
      return Math.min.apply(null, this.stateMap());
    }

    offset(i) {
      return mod(this.state + i, this.owner.numStates);
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

  /** Class represting a renderer to draw to the DOM */

  class Renderer {
    constructor(...args) {
      this._init(...args);
    }
    _init() { throw new HexError('Method not implemented'); }
  }

  class CanvasRenderer extends Renderer {
    _init(hex) {
      this.hex = hex;
      const radius = hex.radius, rows = hex.rows, cols = hex.cols;
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d');

      this.canvas.height  = 2 * radius * (rows + 1.5) * 0.75;
      this.canvas.width = 2 * radius * (cols + 1.5) * math.apothem;

      this.canvas.classList.add(CANVAS_CLASS);

      // Precomputed math stuff

      this.innerRadius = radius - this.hex.borderWidth / (2 * math.apothem);
      this.vertices = elemOp(math.vertices, this.innerRadius);

      this.basis = elemOp(math.basis, radius);
      this.invBasis = elemOp(math.invBasis, 1 / radius);

      this.yOffset = 2 * radius;
      this.xOffset = 2 * radius * math.apothem;

      // For imageData rectangle coords
      this.selectYOffset = Math.ceil(
        radius * math.apothem + this.hex.highlightLineWidth);
      this.selectXOffset = Math.ceil(
        radius + this.hex.highlightLineWidth);
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
    }

    // Draw all hexes

    draw() {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.hex.eachCell((cell) => {
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
          this.selected.y = cell.y - this.selectYOffset;
          this.selected.x = cell.x - this.selectXOffset;
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

    // Basic hex path for both cells and selector

    drawHexPath(cell) {
      const y = cell.y
      const x = cell.x;
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

    cellAtPosition(y, x) {
      y -= this.yOffset;
      x -= this.xOffset;

      // We first find the position with respect to cubic coordinates
      let u = this.invBasis[0] * y + this.invBasis[1] * x;
      let v = this.invBasis[2] * y + this.invBasis[3] * x;
      let w = -u - v;

      let ru = Math.round(u);
      let rv = Math.round(v);
      let rw = Math.round(w);

      let du = Math.abs(ru - u);
      let dv = Math.abs(rv - v);
      let dw = Math.abs(rw - w);

      if (du > dv && du > dw)
        ru = -rv - rw;
      else if (du > dw)
        rv = -ru - rw;

      // Every two rows are then shifted one space to the left
      rv += Math.floor(ru / 2);

      if (ru < 0 || ru >= this.rows || rv < 0 || rv >= this.cols)
        return null;
      else
        return this.hex.cells[ru][rv];
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

    this.context.fillStyle = this.hex.colors[cell.state];
    this.context.fill();
  }

  function defaultDrawSelector(cell) {
    this.drawHexPath(cell);

    this.context.strokeStyle = this.hex.highlightColor;
    this.context.lineWidth = this.hex.highlightLineWidth;
    this.context.stroke();
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

  // ---

  Hexular.HexError = HexError;

  Hexular.nullRule = nullRule;
  Hexular.defaultDrawCell = defaultDrawCell;
  Hexular.defaultDrawSelector = defaultDrawSelector;

  Hexular.elemOp = elemOp;
  Hexular.mod = mod;

  Hexular.defaults = {
    renderer: CanvasRenderer,
    rows: DEFAULT_ROWS,
    cols: DEFAULT_COLS,
    defaultRule: DEFAULT_RULE,
    maxStates: DEFAULT_MAX_STATES,
    colors: DEFAULT_COLORS,
    radius: DEFAULT_RADIUS,
    borderWidth: DEFAULT_BORDER_WIDTH,
    highlightColor: DEFAULT_HIGHLIGHT_COLOR,
    highlightLineWidth: DEFAULT_HIGHLIGHT_LINE_WIDTH,
    timerLength: DEFAULT_TIMER_LENGTH
  };

  Hexular.renderers = {
    Renderer,
    CanvasRenderer
  };

  return Hexular;
})();

if (typeof module != 'undefined')
  module.exports = Hexular;