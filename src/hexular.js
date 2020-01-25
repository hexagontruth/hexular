/**
 * @overview
 * @version 0.2
 * @author graham
 * @copyright 2020
 * @license Hexagonal Awareness License (HAL)
 */

/** @namespace {object} filters */
/** @namespace {object} rules */
/** @namespace {object} util */

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

  const APOTHEM = Math.sqrt(3) / 2;

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

  /**
   * @namespace {object} math
   */
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

  /**
   * Class representing a hexular error.
   *
   * @augments Error
   */
  class HexError extends Error {}

  /**
   * @function methodNotImplemented
   *
   * @param {string} [methodName='method'] String description of method - for informational purposes only
   * @throws {HexError}
   * @memberof HexError
   */
  HexError.methodNotImplemented = (methodName = 'method') => {
    throw new HexError(`Method not implemented: "${methodName}"`);
  }

  /**
  * @function validateKeys
  *
  * @param {object} object     Object
  * @param {...string} ...args One or more string or string-coercible keys to check
  * @throws {HexError}
  * @memberof HexError
   */
  HexError.validateKeys = (obj, ...args) => {
    for (let key of args)
      if (!obj[key])
         throw new HexError(`${obj.constructor.name} requires "${key}" to be defined`);
  }

  /**
   * Abstract class representing a grid of cells connected according to some topology
   */
  class Model {
    /**
    * Abstract constructor for creating a `Model` instance.
    *
    * @param {...object} ...args One or more settings objects to apply to model
    */
    constructor(...args) {
      let defaults = {
        /**
         * Default rule function to use for states not defined by {@link Model#rules}.
         *
         * For non-numeric cell states, arbitrary state keys can be added to this array.
         *
         * @name Model#defaultRule
         * @type function
         * @default {@link rules.identityRule}
         */
        defaultRule: DEFAULT_RULE,
        /**
         * Total number of states.
         *
         * Convenience attribute used by cell neighborhood and filter functions.
         *
         * @name Model#numStates
         * @type number
         * @default 2
         */
        numStates: DEFAULT_NUM_STATES,
        /**
         * Default ground or "off" state for cells.
         *
         * Used by on cell initialization, by {@link Model#import} and {@link Model#clear}, and
         * potentially by {@link filters} or {@link Adapter|adapters}.
         *
         * @name Model#groundState
         * @type number
         * @default 0
         */
        groundState: DEFAULT_GROUND_STATE,
        /**
         * Array of rule functions, applied when a cell's state is equal to an entry's index.
         *
         * For non-numeric cell states, arbitrary state keys can be added to this array.
         *
         * @name Model#rules
         * @type function[]
         * @see {@link rules}
         */
        rules: [],
        /**
         * List of filter functions to call on every new cell state.
         *
         * @name Model#filters
         * @type HookList
         * @default {@link filters.modFilter|[Hexular.filters.modFilter]}
         */
        filters: new HookList(this),
        /**
         * Canonical, publicly-exposed one-dimensional array of cells in order defined by subclass.
         *
         * @name Model#cells
         * @type Cell[]
         */
        cells: [],
      };
      Object.assign(this, defaults, ...args);
      // Add available adapter constructors as direct attributes of this instance
      Object.entries(attributes.classes.adapters).forEach(([className, Class]) => {
        this[className] = (...args) => new Class(this, ...args);
      });
    }

    /**
     * Add filter function to model.
     *
     * @param  {function} filter                  Filter to add
     * @param  {number} [idx=this.filters.length] Optional insertion index (defaults to end of array)
     */
    addFilter(filter, idx=this.filters.length) {
      let boundFilter = filter.bind(this);
      boundFilter.hash = this._hash(filter.toString());
      this.filters.splice(idx, 0, boundFilter);
    }

    /**
     * Remove filter function from model.
     *
     * Since filters are bound to the model, and anonymous functions lack a name, they can't be directly compared to
     * those in `this.filters`, . This we identify and compare functions based on a hash value derived from the string
     * version of the function. The upshot being any identically-coded functions will be equivalent.
     *
     * @param  {function} filter Filter to remove
     */
    removeFilter(filter) {
      let hash = this._hash(filter.toString());
      let idx = this.filters.findIndex(((e) => e.hash == hash));
      if (idx < 0) return;
      this.filters.splice(idx, 1);
      return idx;
    }

    /**
     * Advance state of each cell according to rule defined in {@link Model.rules|this.rules} for current state key.
     */
    step() {
      this.eachCell((cell) => {
        let nextState = (this.rules[cell.state] || this.defaultRule)(cell);
        cell.nextState = this.filters.call(nextState, cell);
      });
      this.eachCell((cell) => {
        cell.state = cell.nextState;
      });
    }

    /**
     * Reset each cell state to {@link Model.groundState|this.groundState}.
     */
    clear() {
      this.eachCell((cell) => {
        cell.state = this.groundState;
      });
    }

    /**
     * Set {@link Cell#neighborhood} for each cell to given value.
     *
     * @param  {number} neighborhood One of the natural numbers [6, 12, 18, 7, 13, 19].
     */
    setNeighborhood(neighborhood) {
      this.eachCell((cell) => {
        cell.neighborhood = neighborhood;
      })
    }

    /**
     * Method for calling a given function for each cell in a model, and returns an array of return values.
     *
     * This is essentially `forEach` on {@link Model#cells} but with array comprehension behavior.
     *
     * @param  {function} fn Function to call for each cell, taking the cell as an argument
     * @return {number[]}    Array of return values with same size as {@link Model#cells|this.cells}
     */
    eachCell(fn) {
     let a = new Array(this.cells.length);
     for (let i = 0; i < this.cells.length; i++) {
       a[0] = fn(this.cells[i]);
     }
     return a;
    }

    /**
     * Call a given function for each coordinate defined by a model's topology.
     *
     * This is typically used by a model's constructor to instantiate cells, but should be exposed externally as well.
     *
     * @param  {function} fn Function to call for each coordinate, taking a coordinate argument that e.g. is used to
     *                       construct {@link Model#coord}
     */
    eachCoord(fn) {
      HexError.methodNotImplemented('eachCoord');
    }

    /**
     * Get coordinates of cell according to a renderer.
     *
     * As with {@link Model#cellAtCubic}, this is a somewhat inelegant compromise between the concern domains of models
     * and adapters. In this case, we wish not to find a cell, but provide a canonical spatial address for each cell
     * according to a rendering adapter.
     *
     * @param  {Adapter} adapter An adapter instance with {@link Adapter#cellRadius} and {@link Adapter#basis} defined
     * @param  {Cell} cell       The cell to position
     * @return {number[]}       The cell's [x, y] position relative to the origin of the adapter
     */
    getCoords(adapter, cell) {
      HexError.methodNotImplemented('getCoords');
    }

    /**
     * Find cell at given cubic coordinates in model.
     *
     * There is at present some contradiction between the concerns addressed by models and those addressed by adapters.
     * In short, there is no "topologically agnostic" way to spatially locate a cell in any given model. Thus, we
     * leave the onus on specific `Model` subclasses to to convert cubic coordinates to their internal coordinate
     * system, and allow e.g. {@link Adapter} instances to look up cells spatially using this convention.
     *
     * @param  {number[]} coord Array of [u, v, w] coordinates
     * @return {Cell}           Cell at coordinates, or null
     */
    cellAtCubic([u, v, w]) {
      HexError.methodNotImplemented('cellAtCubic');
    }

    /**
     * Export cell states to a typed byte array.
     *
     * Though Hexular is not currently geared towards negative state values, we use a signed type array to preserve
     * the option of doing so. This method does not export other aspects of a model or its cells, such as
     * {@link Model#rules} or {@link Cell#neighborhood}., and will not prove effective for non-numeric states or states
     * outside the range -128...128 (inclusive and exclusive respectively).
     *
     * @return {Int8Array} Byte array of cell states
     * @see {@link Model#import}
     */
    export() {
      let bytes = Int8Array.from(this.cells.map((e) => e.state));
      return bytes;
    }

    /**
     * Import cell states from typed byte array.
     *
     * Like {@link Model#export}, this only works with integer states no less than -128 and no greater than 127, and
     * does not change other model or cell attributes such as e.g. {@link Model#rules} or {@link Cell#neighborhood}.
     *
     * @param  {Int8Array} bytes Byte array of cell states
     * @see {@link Model#export}
     */
    import(bytes) {
      this.cells.forEach((cell, idx) => {
        cell.state = bytes[idx] || this.groundState;
      });
    }

    /**
     * Internal hashing function to track bound functions. Not actually important.
     *
     * @param  {string} str Some string
     * @return {string}     Chunked, summed mod 256 hexadecimal string
     */
    _hash(str) {
      let bytes = new Uint8Array(str.split('').map((e) => e.charCodeAt(0)));
      let chunkSize = Math.max(2, Math.ceil(bytes.length / 16));
      let chunked = bytes.reduce((a, e, i) => {
        a[Math.floor(i / chunkSize)] += e;
        return a;
      }, Array(Math.ceil(bytes.length / chunkSize)).fill(0));
      return chunked.map((e) => ('0' + (e % 256).toString(16)).slice(-2)).join('');
    }
  }

/**
 * Class representing an offset, i.e. rectangular, topology.
 *
 * In an offset topology, cells describe a cols x rows grid where every other row is staggered one apothem-length
 * along the x axis. This is useful when trying to fit a grid into a rectangular box, but may cause undesirable
 * wraparound effects. (These effects may be mitigated by using {@link filters.edgeFilter}.)
 *
 * @augments Model
 */
  class OffsetModel extends Model {
    /**
    * Creates `OffsetModel` instance
    *
    * @param {...object} ...args One or more settings objects to apply to model
    */
    constructor(...args) {
      super();
      let defaults = {
        /**
         * @name OffsetModel#cols
         * @type number
         * @default 60
         */
        cols: DEFAULT_COLS,
        /**
         * @name OffsetModel#rows
         * @type number
         * @default 60
         */
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
  }

  /**
   * Class representing a hexagonal model with cells addressed using cubic coordinates.
   *
   * Here we describe a hexagnal grid of cells addressed by coordinates `[u, v, w]`. The cell at the origin is
   * designated `[0, 0, 0]`, with tuples of coordinates summing to zero. In the default display provided by
   * {@link CanvasAdapter}, the `u` points up, `v` points to the right, and `w` points to the left.
   *
   * For more information on this system, and how it translates to other coordinate systems, please see the excellent
   * article [Hexagonal Grids]{@link https://www.redblobgames.com/grids/hexagons/} from Red Blob Games.
   *
   * @augments Model
   */
  class CubicModel extends Model {
    /**
    * Creates `CubicModel` instance.
    *
    * @param {...object} ...args One or more settings objects to apply to model
    */
    constructor(...args) {
      super(...args);
      /**
       * @name CubicModel#radius
       * @type number
       * @default 30
       */
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

      // Connect simple neighbors
      Object.values(this.rhombus).filter((e) => e).forEach((cell) => {
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

      // Populate cell array via neighbor traversal
      // Our goal here is to put cells into center-out mapping so they can be saved and restored between board sizes
      // This will not work OffsetModel b/c there's no way to infer what size rectangle the cells were on originally
      this.cells = [this.rhombus[0]];
      for (let i = 1; i < this.radius; i++) {
        let cell = this.cells[0];
        // We select the first simple neighbor in the i-th ring
        for (let j = 0; j < i; j++)
          cell = cell.nbrs[1];

        for (let j = 0; j < 6; j++) {
          let dir = 1 + (j + 2) % 6;
          for (let k = 0; k < i; k++) {
            cell = cell.nbrs[dir];
            this.cells.push(cell);
          }
        }
      }

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

    getCoords(renderer, cell) {
      let r = renderer.cellRadius;
      let [u, v, w] = cell.coord;

      let [x, y] = matrixMult(renderer.basis, [v, u]);
      return [x, y];
    }

    cellAtCubic([u, v, w]) {
      if (absMax(u, v, w) > this.max)
        return null;
      let cell = this.rhombus[u * this.cols + v];
      return cell;
    }
  }

  /**
   * Class representing a cell.
   */
  class Cell {
    /**
     * Creates `Cell` instance.
     *
     * @param  {Model} model       Model for populating {@link Cell#model|this.model}
     * @param  {number[]} coord    Coordinate array for populating {@link Cell#coord|this.coord}
     * @param  {...object} ...args One or more settings objects to apply to cell
     */
    constructor(model, coord, ...args) {
      let defaults = {
        /**
         * {@link Model} instance associated with this cell (typically also its instantiator).
         *
         * @name Cell#model
         * @type Model
         */
        model,
        /**
         * An coordinate vector whose shape and range are determined by topology implemented in {@link Cell#model}.
         *
         * @name Cell#coord
         * @type number[]
         */
        coord,
        /**
         * Cell state, used to look up rule index on each {@link Model#step|this.step}.
         *
         * @name Cell#state
         * @type number
         * */
        state: model.groundState,
        /**
         * Used by {@link Model#step|this.model.step()} when calculating next cell states.
         *
         * @name Cell#nextState
         * @type number
         */
        nextState: 0,
        /**
         * Numeric array with default size of 19 with entries for the cell itself and its 18 nearest neighbors.
         *
         * - Entry 0 corresponds to the cell itself
         * - Entries 1-6 correspond to the cell's 6 nearest neighbors, progressing in a continuous arc
         * - Entries 7-12 correspond to those cells one edge-length from the cell, where `nbrs[7]`` corresponds to the
         *   cell touching `nbrs[1]` in the opposite direction the first ring progresses, but progressing in the same
         *   direction as the first ring
         * - Entries 13-18 correspond to cells one full cell from the cell, where `nbrs[13]` corresponds to the cell
         *   touching `nbrs[12]` opposite from `nbrs[1]`, also progressing in the same direction as the other two
         *
         * I.e., we have 3 rings where the first neighbor in each ring zigzags away from the home cell. This
         * arrangement allows successive neighborhoods to be iterated through contiguously.
         *
         * @name Cell#nbrs
         * @type number
         */
        nbrs: new Array(19).fill(null),

        /**
         * Value indicating which entry in {@link Cell#with|this.with} to look to when calling cell-level helper
         * functions, e.g. {@link Cell#count|this.count}, &c.
         *
         * @name Cell#neighborhood
         * @type number
         * @default 6
         */
        neighborhood: 6,
      };
      Object.assign(this, defaults, ...args);
      this.nbrs[0] = this;
      /**
       * Array of {@link Neighborhood} instances, for efficiently calling helper methods over defined neighborhoods.
       *
       * @name Cell#with
       * @type Neighborhood[]
       * @see {@link Cell#neighborhood}
       */
      this.with = {
        6: new Neighborhood(this, 1, 7),
        12: new Neighborhood(this, 1, 13),
        18: new Neighborhood(this, 1, 19),
        7: new Neighborhood(this, 0, 7),
        13: new Neighborhood(this, 0, 13),
        19: new Neighborhood(this, 0, 19),
      };
    }

    /**
     * Builds out {@link Cell#nbrs|this.nbrs[7:19]} after [1:7} have been populated by {@link Model|this.model}.
     */
    extendNeighborhood() {
      for (let i = 1; i < 7; i++) {
        let source12 = 1 + (i + 4) % 6;
        this.nbrs[i + 6] = this.nbrs[i].nbrs[source12];
        this.nbrs[i + 12] = this.nbrs[i].nbrs[i];
      }
    }

    /**
     * Shortcut for {@link Neighborhood#total|this.with[this.neighborhood].total}.
     *
     * @readonly
     */
    get total() { return this.with[this.neighborhood].total; }
    /**
     * Shortcut for {@link Neighborhood#count|this.with[this.neighborhood].count}.
     *
     * @readonly
     */
    get count() { return this.with[this.neighborhood].count; }
    /**
     * Shortcut for {@link Neighborhood#histogram|this.with[this.neighborhood].histogram}.
     *
     * @readonly
     */
    get histogram() { return this.with[this.neighborhood].histogram; }
    /**
     * Shortcut for {@link Neighborhood#map|this.with[this.neighborhood].map}.
     *
     * @readonly
     */
    get map() { return this.with[this.neighborhood].map; }
  }

  /**
   * Class representing a neighborhood around a cell.
   *
   * A cell's `nbrs` array contains 19 entries, starting with itself. By selecting particular subsets of this array,
   * we can confine our iteration to the 6, 12, or 18 nearest neighbors, with or without the cell itself.
   */
  class Neighborhood {
    /**
     * Creates `Neighborhood` instance.
     *
     * @param  {Cell} cell  Parent cell, usually instantiator of neighborhood
     * @param  {number} min Minimum index (inclusive) of neighborhood in {@link Cell#nbrs|this.cell.nbrs}.
     * @param  {number} max Maximum index (exclusive) of neighborhood in {@link Cell#nbrs|this.cell.nbrs}.
     */
    constructor(cell, min, max) {
      this.cell = cell;
      this.nbrs = cell.nbrs;
      this.min = min;
      this.max = max;
      this.length = max - min;
    }

    /**
     * Cumulative total of all neighboring states.
     *
     * @return {number}
     * @readonly
     */
    get total() {
      let a = 0;
      for (let i = this.min; i < this.max; i++)
        a += this.nbrs[i].state;
      return a;
    }

    /**
     * Count of all activated (state > 0) neighbors.
     *
     * @return {number}
     * @readonly
     */
    get count() {
      try {
      let a = 0;
      for (let i = this.min; i < this.max; i++)
        a += this.nbrs[i].state ? 1 : 0;
      return a;} catch (e) {console.log(this,this.cell,this.cell.coord); console.trace(); throw e;}
    }

    /**
     * A `numStates`-sized array containing neighbor counts for that state.
     *
     * @return {number[]}
     * @readonly
     */
    get histogram() {
      let a = Array(this.cell.model.numStates).fill(0);
      for (let i = this.min; i < this.max; i ++)
        if (this.nbrs[i].state < a.length)
          a[this.nbrs[i].state] += 1;
      return a;
    }

    /**
     * Array of cell states in neighborhood.
     *
     * @return {number[]}
     * @readonly
     */
    get map() {
      let a = [];
      for (let i = this.min; i < this.max; i++) {
        a.push(this.nbrs[i].state);
      }
      return a;
    }
  }

  /**
   * Class representing a list of callback hooks
   *
   * This class extends `Array`, and we can use standard array methods - e.g. `push`, &c. - to populate it.
   *
   * @augments Array
   */
  class HookList extends Array {
    /**
     * Creates `HookList` instance.
     *
     * @param  {*} owner Object or value for population {@link HookList#owner|this.owner}
     */
    constructor(owner) {
      super();
      /**
       * Object or value to be bound to functions in hook list.
       *
       * Typically a class instance. Overwriting this will have no effect on functions already in hook list.
       *
       * @name HookList#owner
       */
      this.owner = owner;
    }

    /**
     * Call each function entry in hook list, bound to {@link HookList#owner|this.owner}.
     *
     * The first function is called with the arguments as given to this method. When a called
     * function returns a value besides `undefined`, `val` is set to that value for the next
     * function. The final state of `val` is returned at the end of the iteration. Thus, if
     * constituent functions return a value, this operation serves to "filter" a value from one
     * function to the other. Conversely, if constituent functions do not return an explicit value,
     * this method essentially iterates over these functions with identitcal arguments.
     *
     * Both are good options.
     *
     * @param  {*} val        First argument to be passed to at least initial function
     * @param  {...*} ...args Any additional arguments to pass to functions
     * @return {*}            Final return value of last function called, or original value
     */
    call(val, ...args) {
      for (let i = 0; i < this.length; i++) {
        let newVal = this[i].call(this.owner, val, ...args);
        val = newVal === undefined ? val : newVal;
      }
      return val;
    }
  }

  /**
   * Abstract class representing an adapter.
   *
   * This doesn't really do much.
   */
  class Adapter {
    /**
     * Creates `Adapter` instance.
     *
     * @param  {Model} model       Model to associate with this adapter
     * @param  {...object} ...args One or more settings objects to apply to adapter
     */
    constructor(model, ...args) {
      /**
       * `Model` instance to associate with this adapter.
       *
       * In the present implementation, this only needs to be a one-way relationship - models have no explicit
       * knowledge of adapters accessing them, though they can be instantiated via `model.[ClassName]`.
       *
       * @name Adapter#model
       * @type Model
       */
       this.model = model;
       Object.assign(this, ...args);
    }
  }

  /**
   * Class represting a renderer bound to two user agent canvas elements.
   *
   * This class is fairly closely-tailored for the needs of the Hexular Demo page, and is probably does not expose
   * the ideal generalized interface for e.g. browser-based canvas rendering.
   *
   * The crux of its functionality is the employment of two ideally overlapping canvas contexts - one for drawing
   * cells, and one for drawing the highlighted cell selector. This is a change from the original 2017 version, which
   * just used a single canvas and a somewhat awkward raster buffer for storing the unselected drawn state of the cell
   * and then redrawing it when the selection changes. This more or less worked but led to occasional platform-specific
   * artifacts. At any rate, one can easily override the default selector-drawing behavior (see
   * {@link CanvasAdapter#onDrawSelector}) and use a single canvas.
   * if desired.
   *
   * @augments Adapter
   */
  class CanvasAdapter extends Adapter {
    /**
     * Creates `CanvasAdapter` instance.
     *
     * @param  {Model} model       Model to associate with this adapter
     * @param  {...object} ...args One or more settings objects to apply to adapter
     */
    constructor(model, ...args) {
      super(model);
      let defaults = {
        cellMap: new Map(),
        /**
         * Array of CSS hex or RGB color codes, for drawing cells with each entry's respective indicial state.
         *
         * @name CanvasAdapter#colors
         * @type string[]
         */
        colors: DEFAULT_COLORS,

        /**
         * @name CanvasAdapter#hightlightColor
         * @type string
         * @default #ffbb33
         */
        highlightColor: DEFAULT_HIGHLIGHT_COLOR,
        /**
         * @name CanvasAdapter#highlightLineWidth
         * @type number
         * @default 2
         */
        highlightLineWidth: DEFAULT_HIGHLIGHT_LINE_WIDTH,
        /**
         * @name CanvasAdapter#cellRadius
         * @type number
         * @default 10
         */
        cellRadius: DEFAULT_CELL_RADIUS,
        /**
         * @name CanvasAdapter#borderWidth
         * @type number
         * @default 1.25
         */
        borderWidth: DEFAULT_BORDER_WIDTH,
      };
      Object.assign(this, defaults, ...args);
      HexError.validateKeys(this, 'renderer', 'selector', 'cellRadius');

      // Precomputed math stuff

      this.innerRadius = this.cellRadius - this.borderWidth / (2 * math.apothem);
      this.vertices = scalarOp(math.vertices, this.innerRadius);
      this.basis = scalarOp(math.basis, this.cellRadius);
      this.selectYOffset = Math.ceil(
        this.cellRadius * math.apothem + this.highlightLineWidth);
      this.selectXOffset = Math.ceil(
        this.cellRadius + this.highlightLineWidth);
      this.selectHeight = this.selectYOffset * 2;
      this.selectWidth = this.selectXOffset * 2;

      /**
       * @name CanvasAdapter#onDrawCell
       * @type HookList
       * @default {@link CanvasAdapter#defaultDrawCell|[this.defaultDawCell]}
       */
      this.onDrawCell = new HookList(this);
      this.onDrawCell.push(this.defaultDrawCell);

      /**
       * @name CanvasAdapter#onDrawSelector
       * @type HookList
       * @default {@link CanvasAdapter#defaultDrawSelector|[this.defaultDrawSelector]}
       */
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

    /**
     * Draw all cell cells on {@link CanvasAdapter#renderer|this.renderer} context.
     */
    draw() {
      this.clear(this.renderer);
      this.model.eachCell((cell) => {
        this.drawCell(cell);
      });
    }

    /**
     * Select cell and draw on {@link CanvasAdapter#renderer|this.selector} context.
     *
     * @param  {Cell} cell The cell to select
     */
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

    /**
     * Helper function for clearing one of the two canvas contexts (or any other).
     *
     * When used with {@link CubicModel}, which is centered on the origin, we assume the context has been translated
     * to the center of its viewport. This is neither necessary nor assumed however, and we simply save the current
     * transformation state, clear the visible viewport, and then restore that transformed state.
     *
     * @param  {CanvasRenderingContext2D} ctx The 2D canvas context to clear
     */
    clear(ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }

    /**
     * Draw individual cell.
     *
     * Calls every method of {@link CanvasAdapter#onDrawCell} with the given cell. Used internally by
     * {@link CanvasAdapter#draw}.
     *
     * @param  {Cell} cell The cell to draw
     */
    drawCell(cell) {
      this.onDrawCell.call(cell);
    }

    /**
     * Draw selector
     *
     * Calls every method of {@link CanvasAdapter#onDrawSelector} with the given cell. Used
     * internally by {@link CanvasAdapter#selectCell}.
     *
     * @param  {Cell} cell The cell to draw
     */
    drawSelector(cell) {
      this.onDrawSelector.call(cell);
    }

    /**
     * Default cell drawing method.
     *
     * As this is bound separately to the instance via {@link CanvasAdapter#onDrawCell}, it doesn't strictly speaking
     * need to be an instance method, but is included here for concern relevance.
     *
     * @param  {Cell} cell The cell being drawn
     */
    defaultDrawCell(cell) {
    // Use cell.owner when writing custom drawing callbacks
    this._drawHexPath(this.renderer, cell);
    this.renderer.fillStyle = this.colors[cell.state];
    this.renderer.fill();
  }

  /**
   * Default cell selector drawing method.
   *
   * @param  {Cell} cell The selected cell being drawn
   */
    defaultDrawSelector(cell) {
    this._drawHexPath(this.selector, cell);

    this.selector.strokeStyle = this.highlightColor;
    this.selector.lineWidth = this.highlightLineWidth;
    this.selector.stroke();
  }

    /**
     * Internal method used to draw hexes for both selectors and cells.
     *
     * @param  {CanvasRenderingContext2D} ctx  Drawing context
     * @param  {Cell} cell                     The cell being drawn
     */
    _drawHexPath(ctx, cell) {
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

    /**
     * Get cell at specific x, y coordinates.
     *
     * This is used by Hexular Demo and presumably any other display-facing adapter for locating a cell from e.g. a
     * user's cursor position.
     *
     * @param  {number[]} coord An array consisting of [x, y] coordinates
     * @return {Cell}           The cell at this location, or null
     * @see {@link math#cartesianToCubic}
     * @see {@link math#roundCubic}
     * @see {@link Model#cellAtCubic}
     */
    cellAt([x, y]) {
      // First convert to cubic coords
      let rawCubic = cartesianToCubic([x, y]);
      let cubic = roundCubic(rawCubic, this.cellRadius);
      let cell = this.model.cellAtCubic(cubic);
      return cell;
    }
  }

  // TODO: Add SVG adapter

  /**
   * A rule that returns the current state.
   *
   * @memberof rules
   */
  function identityRule(cell) {
    return cell.state;
  }

  /**
   * A rule that returns 0.
   *
   * Debatably, this should return `model.groundState`, but for various reasons it doesn't.
   *
   * @memberof rules
   */
  function nullRule(cell) {
    return 0;
  }

  // --- OPTIONAL FILTERS ---

  /**
   * Set new cell values to modulus with respect to `this.numStates`.
   *
   * This has the effect of making states cyclical. Historically this was the default behavior. Not ethat there is,
   * in principle, preventing one from using non-numeric or complex multivalued cell states, but like much of the
   * boilerplate functionality, this filter is implemented with the assumption that states will be natural numbers.
   *
   * @memberof filters
   */
  function modFilter(value) {
   return mod(value, this.numStates);
  }

  /**
   * Always set edge cells to ground state.
   *
   * This has the effect of disabling wraparound cells, since no cell state can affect a cell neighborhood across the
   * 2 cell boundary width. This may have unexpected and undesirable effects with certain rules though.
   *
   * @memberof filters
   */
  function edgeFilter(value, cell) {
    return !cell.edge ? value : this.groundState;
  }

  /**
  * Generates an elementary rule based on 6/7-bit state of cell neighbors + optionally itself.
  *
  * Modeled roughly after Wolfram's
  * [Elementary Cellular Automaton]{@link http://mathworld.wolfram.com/ElementaryCellularAutomaton.html} rules.
  *
  * @param {bigint|number[]} ruleDef 128-bit number indicating next position per possible state, or array of 7-bit
  *                                  numbers giving individual states where next cell state is 1
  * @param {bool} [inc=false]        Whether to include cell state in neighborhood
  * @memberof util
  **/
  function ruleBuilder(ruleDef, inc=false) {
    let n
    if (typeof ruleDef == 'object') {
      n = 0n;
      for (let state of ruleDef) {
        n = n | 1n << BigInt(state);
      }
    }
    else {
      n = BigInt(n);
    }
    let startIdx = +!inc;
    return (cell) => {
      let mask = 0;
      for (let i = startIdx; i < 7; i++) {
        mask = mask | (cell.nbrs[i].state ? 1 : 0) << (6 - i);
      }
      return Number((n >> BigInt(mask)) % 2n);
    };
  }

  // --- UTILITY FUNCTIONS ---

  /**
   * Modulo operation for reals.
   *
   * @param  {number} a Dividend
   * @param  {number} n Divisor
   * @return {number} Modulus
   * @memberof math
   */
  function mod(a, n) {
    return ((a % n) + n) % n;
  }

  /**
   * Perform element-wise arithmetic operation on arbitrarily-dimensioned tensor.
   *
   * @param  {number[]} obj    Arbitrary-dimensional array of numbers
   * @param  {number} scalar   Scalar
   * @param  {string} [op='*'] Either '+' or '*' - for subtraction or division, invert `scalar` argument
   * @return {number[]}        Result array with same shape as `obj`
   * @memberof math
   */
  function scalarOp(obj, scalar, op) {
    if (obj.map)
      return obj.map(function(val, i) {
        return scalarOp(val, scalar, op);
      });
    else
      return op == '+' ? obj + scalar : obj * scalar;
  }

  /**
   * Multiply row-major matrix by another matrix or transposed 1D vector (i.e. right-multiply matrix by vector).
   *
   * @param  {number[][]} a          2D array representing m*n matrix where outer length = m and inner length = n
   * @param  {number[][]|number[]} b 2D array representing p*q matrix or 1D array representing q-length vector
   * @return {number[][]}            2D array representing m*q matrix
   * @memberof math
   */
  function matrixMult(a, b) {
    let v = !Array.isArray(b[0])
    b = v ? [b] : b;
    let product = b.map((bCol) => {
      let productRow = [];
      for (let aRow = 0; aRow < a.length; aRow++) {
        productRow.push(bCol.reduce((acc, bEntry, aCol) => {
          return acc + a[aRow][aCol] * bEntry;
        }, 0));
      }
      return productRow;
    });
    return v ? product[0] : product;
  }

  /**
   * Element-wise addition of two identical-length arrays.
   *
   * @param  {array} u N-dimensional first argument
   * @param  {array} v N-dimensional Second argument
   * @return {array}   N-dimensional sum
   * @memberof math
   */
  function vectorAdd(u, v) {
    return Array.isArray(u) ? u.map((e, i) => add(e, v[i])) : u + v;
  }

  /**
   * Helper function for finding max of absolute values.
   *
   * @param  {...number} ...args Real numbers
   * @return {number}            Maximum argument absolute value
   * @memberof math
   */
  function absMax(...args) {
    return Math.max(...args.map((e) => Math.abs(e)));
  }

  /**
   * Convert x, y coordinates to cubic coordinates u, v, w.
   *
   * @param  {array} coord Two-member array of coordinates x, y
   * @return {array}       Raw (real) cubic coordinates [u, v, w]
   * @memberof math
   */
  function cartesianToCubic([x, y]) {
    let [v, u] = matrixMult(math.invBasis, [x, y]);
    let w = -u - v;
    return [u, v, w];
  }

  /**
   * Convert real-valued u, v, w to rounded, whole-number coordinates.
   *
   * @param  {array} coord       Array of real-valued cubic coordinates u, v, w
   * @param  {number} [radius=1] radius Optional radius scalar - for converting "pixel" coords to "cell" coords
   * @return {array}             Integer cubic coordinates [u, v, w]
   * @memberof math
   */
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
      edgeFilter,
    },
    util: {
      ruleBuilder,
    },
    math: Object.assign(math, {
      mod,
      scalarOp,
      matrixMult,
      vectorAdd,
      absMax,
      cartesianToCubic,
      roundCubic,
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

  /**
   * Principal function object assigned to global `Hexular` object or returned as module.
   *
   * @param  {...object} ...args Arguments to pass to Model constructor
   * @return {Model}             Model instance
   * @global
   */
  const Hexular = (...args) => {
    let Class = (args[0].prototype instanceof Model) ? args.shift() : attributes.defaults.model;
    return new Class(...args);
  }

  Object.assign(Hexular, attributes);

  return Hexular;
})();

if (typeof module != 'undefined')
  module.exports = Hexular;
