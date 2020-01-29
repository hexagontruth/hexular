/**
 * @overview
 * @version 0.2
 * @author graham
 * @copyright 2020
 * @license Hexagonal Awareness License (HAL)
 */

  /**
  * Filters are functions that take in a state value, plus optionally a {@link Cell} instance, and return a potentially
  * modified form of that value.
  *
  * Filters can be added and removed via {@link Model#addFilter} and {@link Model#removeFilter}.
  *
  * @namespace {object} Hexular.filters
  */

  /**
  * Rules are functions that take in a {@link Cell} instance, and return a state value, typically a natural number.
  *
  * The rules provided here are for example purposes only. A somewhat more robust set of examples can be found in the
  * project's `/demo/rules.js` file.
  *
  * @namespace {object} Hexular.rules
  */

  /**
   * Some utility methods. Or maybe just one.
   *
   * @namespace {object} Hexular.util
   */

var Hexular = (function () {
  // --- SOME EXCITING DEFAULT VALUES ---

  // Default size for cubic (hexagonal) topology
  const DEFAULT_RADIUS = 30;
  // Default size for offset (rectangular) topology
  const DEFAULT_ROWS = 60;
  const DEFAULT_COLS = 60;
  // Default rule is used whenever a cell state does not have an entry in model.rules
  const DEFAULT_RULE = identityRule;
  // This is only needed if one is using modFilter or certain cell/neighborhood helper functions
  const DEFAULT_NUM_STATES = 2;
  // Some functions depend on the ground sstate evaluating to false so changing this may be weird
  const DEFAULT_GROUND_STATE = 0;
  // Used by CanvasAdapter
  const DEFAULT_CELL_RADIUS = 10;
  const DEFAULT_BORDER_WIDTH = 1;
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

  const APOTHEM = Math.sqrt(3) / 2;

  /**
   * A collection of mathematical properties and functions used internally, which may be of interest when extending
   * core functionality.
   *
   * @namespace {object} Hexular.math
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
   * Class representing a Hexular error.
   *
   * @augments Error
   */
  class HexError extends Error {}

  /**
   * @function methodNotImplemented
   *
   * @param {string} [methodName='method'] String description of method &mdash; for informational purposes only
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
   * Abstract class representing a grid of cells connected according to some topology.
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
         * @default {@link Hexular.rules.identityRule}
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
         * Used by cell initialization, {@link Model#import}, and {@link Model#clear}, and
         * potentially by {@link Hexular.filters|filters}, {@link Adapter|adapters}, and other extensions.
         *
         * @name Model#groundState
         * @type number
         * @default 0
         */
        groundState: DEFAULT_GROUND_STATE,
        /**
         * Array of rule functions.
         *
         * Cells are matched with rules based on their states, with e.g. `rules[1]` being caled when
         * {@link Cell#state|cell.state} == `1`. Arbitrary state keys can be added for non-numeric states, if desired.
         *
         * @name Model#rules
         * @type function[]
         * @see {@link Hexular.rules}
         */
        rules: [],
        /**
         * List of filter functions to call on every new cell state.
         *
         * @name Model#filters
         * @type HookList
         * @default {@link Hexular.filters.modFilter|[Hexular.filters.modFilter]}
         */
        filters: new HookList(this),
        /**
         * Canonical, publicly-exposed one-dimensional array of cells in an order defined by a given subclass.
         *
         * @name Model#cells
         * @type Cell[]
         */
        cells: [],
        /**
         * Boolean flag that is set to true during {@link Model#step} when any {@link Cell#state} is changed.
         *
         * Can be used to e.g. automatically stop an auto-incrementing model when it goes "dead."
         *
         * @name Model#changed
         * @type boolean
         */
        changed: null,
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
     * those in `this.filters`, . Thus we identify and compare functions based on a hash value derived from the string
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
      this.changed = false;
      this.eachCell((cell) => {
        let nextState = (this.rules[cell.state] || this.defaultRule)(cell);
        cell.nextState = this.filters.call(nextState, cell);
        if (!this.changed && cell.nextState != cell.state)
          this.changed = true;
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
     * Call a given function for each cell in a model, and return an array of that function's return values.
     *
     * This is essentially `forEach` on {@link Model#cells} but with array comprehension behavior.
     *
     * @param  {function} fn Function to call for each {@link Cell|cell}, taking the cell as an argument
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
     *                       construct {@link Cell#coord}
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
     * @return {number[]}       The cell's [x, y] position in the adapter's frame of reference
     */
    getCoord(adapter, cell) {
      HexError.methodNotImplemented('getCoord');
    }

    /**
     * Find cell at given cubic coordinates in model.
     *
     * There is at present some contradiction between the concerns addressed by models and those addressed by adapters.
     * In short, there is no "topologically agnostic" way to spatially locate a cell in any given model. Thus, we
     * leave the onus on specific `Model` subclasses to convert cubic coordinates to their internal coordinate
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
     * {@link Model#rules} or {@link Cell#neighborhood}, and will not prove effective for non-numeric states or states
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
 * In an offset topology, cells describe a `cols * rows` grid where every other row is staggered one apothem-length
 * along the x axis. This is useful when trying to fit a grid into a rectangular box, but may cause undesirable
 * wraparound effects. (These effects may be mitigated by using {@link Hexular.filters.edgeFilter}.)
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
      this.eachCell((cell) => {
        let [i, j] = cell.coord;
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

    getCoord(adapter, cell) {
      let r = adapter.cellRadius;
      let [i, j] = cell.coord;

      // Like converting to cubic coords but mod 2 wrt x offset
      let x = adapter.basis[0][0] * i + adapter.basis[0][1] * (j % 2);
      let y = adapter.basis[1][0] * i + adapter.basis[1][1] * j;
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
   * Implements a regularly-hexagonal grid of cells addressed by coordinates `[u, v, w]`. The cell at the origin is
   * designated `[0, 0, 0]`, with all cell coordinate tuples summing to zero. In the default display provided by
   * {@link CanvasAdapter}, `u` points up, `v` points to the right, and `w` points to the left.
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

      /**
       * `CubicModel` orders its `cells` array in rings from the center out, starting with a zero-indexed origin cell.
       * This allows cell states to be backed up and restored via {@link Model#export} and {@link Model#import} across
       * differently-sized maps. Cells always remain centered and in the correct order, though a smaller map will
       * truncate cells outside of its radius.
       *
       * @name CubicModel.cells
       * @type Cell[]
       */
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

    getCoord(adapter, cell) {
      let r = adapter.cellRadius;
      let [u, v, w] = cell.coord;

      let [x, y] = matrixMult(adapter.basis, [v, u]);
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
         * A coordinate vector whose shape and range are determined by the topology implemented in {@link Cell#model}.
         *
         * @name Cell#coord
         * @type number[]
         */
        coord,
        /**
         * Cell state, used to look up rule index on each {@link Model#step}.
         *
         * @name Cell#state
         * @type number
         * @default {@link Model#groundState|this.model.groundState}
         * */
        state: model.groundState,
        /**
         * Used by {@link Model#step} when calculating new  cell states.
         *
         * @name Cell#nextState
         * @type number
         */
        nextState: 0,
        /**
         * Numeric 19-element array with entries for the cell itself and its 18 nearest neighbors.
         *
         * - Entry 0 corresponds to the cell itself
         * - Entries 1-6 correspond to the cell's 6 nearest neighbors, progressing in a continuous arc
         * - Entries 7-12 correspond to those cells one edge-length from the cell, where `nbrs[7]` corresponds to the
         *   cell touching `nbrs[1]` in the opposite direction the first ring progresses, but progressing in the same
         *   direction as the first ring
         * - Entries 13-18 correspond to cells one full cell from the cell, where `nbrs[13]` corresponds to the cell
         *   touching `nbrs[1]` opposite the home cell, also progressing in the same direction as the other two
         *
         * That is, we have three rings where the first neighbor in each ring zigzags away from the home cell. This
         * arrangement allows successive neighborhoods to be iterated through contiguously using the same array.
         *
         * @name Cell#nbrs
         * @type number
         */
        nbrs: new Array(19).fill(null),

        /**
         * Value indicating which entry in {@link Cell#with} to look to when calling cell-level helper
         * functions, e.g. {@link Cell#count}, &c.
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
     * Shortcut for {@link Neighborhood#nbrSlice|this.with[this.neighborhood].nbrSlice}.
     *
     * @readonly
     */
    get nbrSlice() { return this.with[this.neighborhood].nbrSlice; }

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
     * Shortcut for {@link Neighborhood#average|this.with[this.neighborhood].average}.
     *
     * @readonly
     */
    get average() { return this.with[this.neighborhood].average; }
    /**
     * Shortcut for {@link Neighborhood#min|this.with[this.neighborhood].min}.
     *
     * @readonly
     */
    get min() { return this.with[this.neighborhood].min; }
    /**
     * Shortcut for {@link Neighborhood#max|this.with[this.neighborhood].max}.
     *
     * @readonly
     */
    get max() { return this.with[this.neighborhood].max; }
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
   * The {@link Cell#nbrs} array contains 19 entries, starting with the cell itself. By selecting particular subsets of
   * this array, we can confine our iteration to the 6, 12, or 18 nearest neighbors, with or without the cell itself.
   */
  class Neighborhood {
    /**
     * Creates `Neighborhood` instance.
     *
     * @param  {Cell} cell  Parent cell, usually instantiator of neighborhood
     * @param  {number} min Minimum index (inclusive) of neighborhood in {@link Cell#nbrs}.
     * @param  {number} max Maximum index (exclusive) of neighborhood in {@link Cell#nbrs}.
     */
    constructor(cell, min, max) {
      this.cell = cell;
      this.nbrs = cell.nbrs;
      this.minIdx = min;
      this.maxIdx = max;
      this.length = max - min;
    }

    /**
     * Convenience method for returning limited neighbor array.
     *
     * For spatial efficiency purposes we don't keep an internal slice {@link Cell#nbrs}, but this may be useful for
     * e.g. writing certain drawing extensions, etc.
     *
     * @return {Cell[]} Array of cells in this neighborhood
     * @readonly
     */
    get nbrSlice() {
      return this.nbrs.slice(this.minIdx, this.maxIdx);
    }

    /**
     * Cumulative total of all neighboring states.
     *
     * @return {number}
     * @readonly
     */
    get total() {
      let a = 0;
      for (let i = this.minIdx; i < this.maxIdx; i++)
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
      let a = 0;
      for (let i = this.minIdx; i < this.maxIdx; i++)
        a += this.nbrs[i].state ? 1 : 0;
      return a;
    }

    /**
     * Return average of neighbor states.
     *
     * @return {number}
     * @readonly
     */
    get average() {
      let a = 0;
      for (let i = this.minIdx; i < this.maxIdx; i++)
        a += this.nbrs[i].state;
      return Math.floor(a / this.length);
    }

    /**
     * Get maximum neighbor state.
     *
     * @return {number}
     * @readonly
     */
    get max() {
      let a = -Infinity;
      for (let i = this.minIdx; i < this.maxIdx; i++)
        if (this.nbrs[i].state > a)
          a = this.nbrs[i].state;
      return a;
    }

    /**
     * Get minimum neighbor state.
     *
     * @return {number}
     * @readonly
     */
    get min() {
      let a = Infinity;
      for (let i = this.minIdx; i < this.maxIdx; i++)
        if (this.nbrs[i].state < a)
          a = this.nbrs[i].state;
      return a;
    }

    /**
     * A `numStates`-sized array containing neighbor counts for that state.
     *
     * @return {number[]}
     * @readonly
     */
    get histogram() {
      let a = Array(this.cell.model.numStates).fill(0);
      for (let i = this.minIdx; i < this.maxIdx; i ++)
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
      for (let i = this.minIdx; i < this.maxIdx; i++) {
        a.push(this.nbrs[i].state);
      }
      return a;
    }
  }

  /**
   * Class representing a list of callback hooks
   *
   * This class extends `Array`, and we can use standard array methods &mdash; e.g. `push`, &c. &mdash; to populate it.
   *
   * @augments Array
   */
  class HookList extends Array {
    /**
     * Creates `HookList` instance.
     *
     * @param  {*} owner Object or value for populating {@link HookList#owner|this.owner}
     */
    constructor(owner) {
      super();
      /**
       * Object or value to be bound to functions in hook list.
       *
       * Typically a class instance. Overwriting this will have no effect on functions already in the list.
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
     * function. The final state of `val` is returned at the end of the iteration.
     *
     * Thus, if constituent functions return a value, this operation serves to "filter" a value
     * from one function to the other. Conversely, if constituent functions do not return an
     * explicit value, this method essentially iterates over these functions with identical
     * arguments.
     *
     * The former mechanism is used by {@link Model#filters}, while the latter is used by
     * {@link CanvasAdapter#onDrawSelector}, and, when drawing individual cells, by {@link CanvasAdapter#onDrawCell}.
     *
     * @param  {*} val        First argument to be passed to at least initial function
     * @param  {...*} ...args Additional arguments to pass to each hook function
     * @return {*}            Return value of last hook function called, or original `val`
     */
    call(val, ...args) {
      for (let i = 0; i < this.length; i++) {
        let newVal = this[i].call(this.owner, val, ...args);
        val = newVal === undefined ? val : newVal;
      }
      return val;
    }

    /**
     * Call each function entry for every value in the given array, completing each function for all elements in the
     * array before moving on to the next.
     *
     * Used by {@link CanvasAdapter#draw} to finish each successive drawing function for all cells in turn, allowing
     * more complex intercellular drawings.
     *
     * @param  {array} array       Array of values to pass to hook to functions
     * @param  {...object} ...args Additional arguments to pass to each hook function
     */
    callParallel(array, ...args) {
      for (let i = 0; i < this.length; i++) {
        for (let j = 0; j < array.length; j++) {
          this[i].call(this.owner, array[j], ...args);
        }
      }
    }
  }

  /**
   * Abstract class representing an adapter.
   *
   * This doesn't really do much. The minimal adapter interface may change in the future.
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
       * In the present implementation, this only needs to be a one-way relationship &mdash; models have no explicit
       * knowledge of adapters accessing them, though they can be instantiated via `model.ClassName()`.
       *
       * @name Adapter#model
       * @type Model
       */
       this.model = model;
       Object.assign(this, ...args);
      /**
       * A 2*2 row-major transformation matrix for converting arbitrary adapter coordinates to cartesian [x, y] values.
       *
       * @name Adapter#basis
       * @type number[][]
       * @see {@link Model#getCoord}
       */
       this.basis = null;
       /**
        * Non-negative numeric value defining spatial radius of individual cells.
        *
        * @name Adapter#cellRadius
        * @type number
        * @see {@link Model#getCoord}
        */
        this.cellRadius = null;
    }
  }

  /**
   * Class representing a renderer bound to two user agent canvas contexts.
   *
   * This class is closely tailored to the needs of the Hexular Demo page, and probably does not expose the ideal
   * generalized interface for browser-based canvas rendering.
   *
   * The crux of its functionality is the employment of two presumably-coterminous canvas contexts &mdash; one for drawing
   * cells, and one for drawing the highlighted cell selector. This is a change from the original 2017 version, which
   * used just a single canvas and a somewhat awkward raster buffer for storing the unselected drawn state of the cell
   * and then redrawing it when the selection changed. This more or less worked but led to occasional platform-specific
   * artifacts. At any rate, one can easily override the default selector-drawing behavior (see
   * {@link CanvasAdapter#onDrawSelector}) and use a single canvas if desired.
   *
   * @augments Adapter
   */
  class CanvasAdapter extends Adapter {
    /**
     * Creates `CanvasAdapter` instance.
     *
     * Requires at least {@link CanvasAdapter#renderer} and {@link CanvasAdapter#selector} to be given in `...args`
     * settings.
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
         * @default Some colors
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
        /**
        * @name CanvasAdapter#renderer
        * @type 2DCanvasRenderingContext2D
        */
        renderer: null,
        /**
        * @name CanvasAdapter#selector
        * @type 2DCanvasRenderingContext2D
        */
        selector: null,
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
        this.cellMap.set(cell, this.model.getCoord(this, cell));
      });
    }

    /**
     * Draw all cells on {@link CanvasAdapter#renderer} context.
     */
    draw() {
      this.clear(this.renderer);
      this.onDrawCell.callParallel(this.model.cells);
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
     * to the center of its viewport. This is neither necessary nor assumed for other models though. Thus we simply
     * save the current transformation state, clear the visible viewport, and then restore that transformed state.
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
     * Calls every method of {@link CanvasAdapter#onDrawCell} with the given cell.
     *
     * This was originally called by {@link CanvasAdapter#draw}, but is now a standalone utility method.
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
    this.renderer.fillStyle = this.colors[cell.state];
    this._drawHexPath(this.renderer, cell);
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
     * Get cell at specific [x, y] coordinates.
     *
     * This is used by Hexular Demo and potentially other display-facing applications for locating a cell from e.g. a
     * user's cursor position.
     *
     * @param  {number[]} coord An [x, y] coordinate tuple
     * @return {Cell}           The cell at this location, or null
     * @see {@link Hexular.math.cartesianToCubic}
     * @see {@link Hexular.math.roundCubic}
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
   * @memberof Hexular.rules
   */
  function identityRule(cell) {
    return cell.state;
  }

  /**
   * A rule that returns 0.
   *
   * Debatably, this should return `model.groundState`, but for various reasons it doesn't.
   *
   * @memberof Hexular.rules
   */
  function nullRule(cell) {
    return 0;
  }

  // --- OPTIONAL FILTERS ---

  /**
   * Set new cell values to modulus with respect to {@link Model#numStates}.
   *
   * This filter has the effect of making states cyclical. Historically this was the default behavior. There is, in
   * principle, nothing preventing one from using non-numeric or complex multivalued cell states, but like much of the
   * boilerplate functionality, this filter is implemented with the assumption that states will be natural numbers.
   *
   * @memberof Hexular.filters
   */
  function modFilter(value) {
    return mod(value, this.numStates);
  }

  /**
   * Prevent state from going below 0.
   *
   * Must be run before {@link Hexular.filters.modFilter}!.
   *
   * @memberof Hexular.filters
   */
  function clampBottomFilter(value) {
    return Math.max(0, value);
  }

  /**
   * Prevent state from going above the value defined in {@link Model#numStates}.
   *
   * @memberof Hexular.filters
   */
  function clampTopFilter(value) {
    return Math.min(this.numStates - 1, value);
  }

  /**
   * Always set edge cells to ground state.
   *
   * This filter has the effect of disabling wraparound cells, since no cell state can affect a cell neighborhood
   * across the two-cell boundary width. This may have unexpected and undesirable effects with certain rules though.
   *
   * @memberof Hexular.filters
   */
  function edgeFilter(value, cell) {
    return !cell.edge ? value : this.groundState;
  }

  /**
  * Generates an elementary rule based on the state of a cell's neighbors plus optionally itself.
  *
  * The most significant (left-most) bit represents the lowest neighbor number in the selected range, while the least
  * significant bit represents the highest. Thus, the same rule masks can be used with `opts.range` set to either
  * `[0, 7]` or `[1, 7]` (default).
  *
  * Modeled roughly after Wolfram's
  * [Elementary Cellular Automaton]{@link http://mathworld.wolfram.com/ElementaryCellularAutomaton.html} rules.
  *
  * @param {BigInt|number[]} ruleDef      With default `opts.range`', 64-bit number indicating next position per
  *                                       possible state, or an array of 6-bit numbers indicating activation states
  *                                       numbers giving individual states where next cell state is 1
  * @param {object} opts                  Optional arguments
  * @param {number[]} [opts.range=[1, 7]] Neighborhood range &mdash; default is N6 (immediate neighbors)
  * @param {boolean} [opts.inc=true]     `true` increments state on positive rule match, while `false` sets it to 0
  * @param {boolean} [opts.dec=false]    `true` decrements state on negative rule match, while `false` sets it to 0
  * @param {boolean} [opts.invert=false]  Invert rule number (pass in negative state masks instead of positive ones)
  * @memberof Hexular.util
  * @see {@link Cell#nbrs}
  **/
  function ruleBuilder(ruleDef, opts={}) {
    let defaults = {
      range: [1, 7],
      inc: true,
      dec: false,
      invert: false
    };
    let {range, inc, dec, invert} = Object.assign(defaults, opts);
    invert = +invert;
    let [start, stop] = range;
    let rangeLength = stop - start;
    let incMask = inc ? -1 : 0;
    let decMask = dec ? -1 : 0;

    let n;
    if (ruleDef && ruleDef.length) {
      n = 0n;
      for (let state of ruleDef) {
        n = n | 1n << BigInt(state);
      }
    }
    else {
      n = BigInt(n);
    }

    return (cell) => {
      let mask = 0;
      for (let i = 0; i < rangeLength; i++) {
        mask = mask | ((cell.nbrs[start + i].state ? 1 : 0) << (rangeLength - i - 1));
      }
      return (Number((n >> BigInt(mask)) % 2n) ^ invert) ?
        (cell.state & incMask) + 1 :
        (cell.state - 1) & decMask;
    };

  }

  // --- UTILITY FUNCTIONS ---

  /**
   * Modulo operation for reals.
   *
   * @param  {number} a Dividend
   * @param  {number} n Divisor
   * @return {number} Modulus
   * @memberof Hexular.math
   */
  function mod(a, n) {
    return ((a % n) + n) % n;
  }

  /**
   * Perform element-wise arithmetic operation on arbitrarily-dimensioned tensor.
   *
   * @param  {number[]} obj    Arbitrary-dimensional array of numbers
   * @param  {number} scalar   Real number
   * @param  {string} [op='*'] Either '+' or '*' &mdash; for subtraction or division, invert `scalar` argument
   * @return {number[]}        Result array with same shape as `obj`
   * @memberof Hexular.math
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
   * Multiply row-major matrix by another matrix, or by a transposed one-dimensional vector (i.e. right-multiply a
   * matrix and a vector).
   *
   * @param  {number[][]} a          Two-dimensional array representing an `m`*`n` matrix, where outer length = `m` and
   *                                 inner length = `n`
   * @param  {number[][]|number[]} b Two-dimensional array representing an `p`*`q` matrix or a one-dimensional array
   *                                 representing `q`-length vector
   * @return {number[][]}            Two-dimensional array representing an `m`*`q` matrix
   * @memberof Hexular.math
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
   * @param  {array} u `n`-dimensional first argument
   * @param  {array} v `n`-dimensional second argument
   * @return {array}   `n`-dimensional sum
   * @memberof Hexular.math
   */
  function vectorAdd(u, v) {
    return Array.isArray(u) ? u.map((e, i) => add(e, v[i])) : u + v;
  }

  /**
   * Helper function for finding the maximum absolute value among several real numbers.
   *
   * @param  {...number} ...args Real numbers
   * @return {number}            Maximum absolute value of provided arguments
   * @memberof Hexular.math
   */
  function absMax(...args) {
    return Math.max(...args.map((e) => Math.abs(e)));
  }

  /**
   * Convert [x, y] coordinates to cubic coordinates [u, v, w].
   *
   * @param  {array} coord Tuple of coordinates [x, y]
   * @return {array}       Raw (real) cubic coordinates [u, v, w]
   * @memberof Hexular.math
   */
  function cartesianToCubic([x, y]) {
    let [v, u] = matrixMult(math.invBasis, [x, y]);
    let w = -u - v;
    return [u, v, w];
  }

  /**
   * Convert real-valued [u, v, w] to their rounded, whole-number counterparts.
   *
   * @param  {array} coord       Array of real-valued cubic coordinates [u, v, w]
   * @param  {number} [radius=1] Optional radius scalar &mdash; for converting "pixel" coords to "cell" coords
   * @return {array}             Integer cubic coordinates [u, v, w]
   * @memberof Hexular.math
   */
  function roundCubic([u, v, w], radius = 1) {
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
      clampBottomFilter,
      clampTopFilter,
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
    let Class = (args[0] && args[0].prototype instanceof Model) ? args.shift() : attributes.defaults.model;
    return new Class(...args);
  }

  Object.assign(Hexular, attributes);

  return Hexular;
})();

if (typeof module != 'undefined')
  module.exports = Hexular;

const RULES = {

  binary1: (cell) => cell.count == 1 ? 1 : 0,

  binary2: (cell) => cell.count == 2 ? 1 : 0,

  binary3: (cell) => cell.count == 3 ? 1 : 0,

  binary12: (cell) => {
    let count = cell.count;
    return count == 1 || count == 2 ? 1 : 0;
  },

  binary23: (cell) => {
    const count = cell.count;
    return count == 2 || count == 3 ? 1 : 0;
  },

  binary24: (cell) => {
    const count = cell.count;
    return count == 2 || count == 4 ? 1 : 0;
  },

  binary34: (cell) => {
    const count = cell.count;
    return count == 3 || count == 4 ? 1 : 0;
  },

  // offset is similar to binary except it increments instead of setting to 1

  offset23: (cell) => {
    const count = cell.count;
    return count == 2 || count == 3 ? cell.state + 1 : 0;
  },

  // Same as standardOn, using states > 1 to represent activation generation

  offset34: (cell) => {
    const count = cell.count;
    return count == 3 || count == 4 ? cell.state + 1 : 0;
  },

  // Simple multistate rule

  offset23minus: (cell) => {
    const count = cell.count;
    if (count == 2 || count == 3)
      return cell.state + 1;
    else if (count > 3)
      return cell.state - 1;
    else
      return 0;
  },

  fancytown: (cell) => {
    const tot = cell.total;
    if (tot > 2 && tot < 5)
      return cell.state + 1;
    else if (tot >= 9)
      return cell.state - 1;
    else
      return cell.state;
  },

  // Increment each state -- useful for holding activation for fixed period
  // Generally not helpful to use this as a ground state

  cycle: (cell) => cell.state + 1,

  anticycle: (cell) => cell.state - 1,

  // A cumulative offset rule
  // Pretty sure I meant for "isomod" to stand for "isotropic modulo" but I'm not sure what this means here

  isomod: (cell) => cell.state + cell.total,

  // Some xor-inspired rules

  totalXor: (cell) => cell.total % 2,

  countXor: (cell) => cell.count % 2,

  incrementXor: (cell) => Math.max(0, cell.state + (cell.count % 2 ? 1 : -1)),

  // This doesn't do a lot but can be a good utility placeholder in certain states

  average: (cell) => cell.average,

  // Here are some examples of the built-in ruleBuilder functionality

  socialMinimalist: Hexular.util.ruleBuilder([
    0b1000001,
    0b1000010,
    0b1000100,
    0b1001000,
    0b1010000,
    0b1100000,
  ], {range: [0, 7], inc: false}),

  fractalLeft: Hexular.util.ruleBuilder([
    0b010000,
    0b000100,
    0b000001,
  ]),

  lineFilter: Hexular.util.ruleBuilder([
    0b001001,
    0b010010,
    0b100100,
  ], {invert: true}),

  ennead: Hexular.util.ruleBuilder([
    0b001001,
    0b010010,
    0b100100,
    0b000011,
    0b000110,
    0b001100,
    0b011000,
    0b110000,
    0b100001,
  ]),
};

const PRESETS = {
  default: [
    'ennead',
    'ennead',
    'ennead',
    'ennead',
    'ennead',
    'ennead',
    'ennead',
    'ennead',
    'ennead',
    'ennead',
    'ennead',
    'ennead',
  ],
  classic: [
    'binary2',
    'offset23minus',
    'offset23minus',
    'offset23minus',
    'offset23minus',
    'offset23minus',
    'offset23minus',
    'offset23minus',
    'offset23minus',
    'offset23minus',
    'offset23minus',
    'offset23minus',
  ],
  noisy: [
    'binary2',
    'offset23',
    'offset23',
    'offset23',
    'offset23',
    'offset23',
    'offset23',
    'offset23',
    'offset23',
    'offset23',
    'offset23',
    'offset23',
  ],
  hexlife: [
    'binary2',
    'binary23',
  ],
  rainbowRoad: [
    'fractalLeft',
    'cycle',
    'cycle',
    'cycle',
    'cycle',
    'cycle',
    'cycle',
    'cycle',
    'cycle',
    'cycle',
    'cycle',
    'cycle',
  ]
};

// --- INIT ---

const DEFAULTS = {
  radius: 60,
  mobileRadius: 30,
  numStates: null,
  maxNumStates: 12,
  timerLength: 100,
  undoStackSize: 64,
  mobileUndoStackSize: 16,
  availableRules: Object.assign({}, Hexular.rules, RULES),
  rule: null,
  defaultRule: 'identityRule',
  defaultImagename: 'hexular.png',
  defaultFilename: 'hexular.bin',
  preset: 'default',
  presets: PRESETS,
  clampBottomFilter: 0,
  clampTopFilter: 0,
  modFilter: 1,
  edgeFilter: 0,
  cellRadius: 10,
  mobileCellRadius: 20,
  groundState: 0,
  borderWidth: 1,
  theme: 'light',
};

const THEMES = {
  dark: {
    background: '#333333',
    colors: [
      '#000000',
      '#888888',
      '#aaaaaa',
      '#cccccc',
      '#eeeeee',
      '#cc4444',
      '#ee7722',
      '#eebb33',
      '#66bb33',
      '#66aaaa',
      '#4455bb',
      '#aa55bb',
    ],
  },
  light: {
    background: '#ccdddd',
    colors: [
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
      '#aa55bb',
    ]
  },
};

let hexular, adapter, board, app;

window.addEventListener('load', function(e) {
  let opts = {};
  location.search.substring(1).split('&').filter((e) => e.length > 0).forEach((e) => {
    let pair = e.split('=');
    let parsedInt = parseInt(pair[1]);
    opts[pair[0]] = Number.isNaN(parsedInt) ? pair[1] : parsedInt;
  });
  board = new Board(opts);
  let {rules, radius, numStates, groundState, cellRadius, borderWidth, colors} = board;
  hexular = Hexular({rules, radius, numStates, groundState});
  if (board.clampBottomFilter)
    hexular.addFilter(Hexular.filters.clampBottomFilter);
  if (board.clampTopFilter)
    hexular.addFilter(Hexular.filters.clampTopFilter);
  if (board.modFilter)
    hexular.addFilter(Hexular.filters.modFilter);
  if (board.edgeFilter)
    hexular.addFilter(Hexular.filters.edgeFilter);
  adapter = hexular.CanvasAdapter({renderer: board.bgCtx, selector: board.fgCtx, cellRadius, borderWidth, colors});
  board.restoreState();
  window.requestAnimationFrame(() => {
    adapter.draw();
    board.refreshRules();
    document.body.style.opacity = 1;
    window.scrollTo(
      (board.width - window.innerWidth) / 2,
      (board.height- window.innerHeight) / 2
    );
  });

});

// --- STUFF ---

let onCursorEvent = (() => {
  let handlerFn = () => {};
  let handler = (ev) => handlerFn(ev);
  ['mousedown', 'mouseup', 'mouseout', 'mousemove', 'touchstart', 'touchmove', 'touchend']
  .map((e) => window.addEventListener(e, handler, {passive: false}));
  return (obj, fn) => {
    handlerFn = fn.bind(obj);
  };
})();


class Board {
  constructor(...args) {
    let props = {
      shift: null,
      selected: null,
      lastSet: null,
      setState: null,
      timer: null,
      messageTimer: null,
      ruleMenus: [],
      undoStack: [],
      redoStack: [],
      paint: false,
      toolbarTop: document.querySelector('.toolbar.top'),
      toolbarBottom: document.querySelector('.toolbar.bottom'),
      container: document.querySelector('.container'),
      overlay: document.querySelector('.overlay'),
      message: document.querySelector('.message'),
      info: document.querySelector('.info'),
      ruleConfig: document.querySelector('.rule-config'),
      buttons: {
        toggle: document.querySelector('#toggle'),
        step: document.querySelector('#step'),
        clear: document.querySelector('#clear'),
        undo: document.querySelector('#undo'),
        redo: document.querySelector('#redo'),
        config: document.querySelector('#config'),
        saveImage: document.querySelector('#save-image'),
        save: document.querySelector('#save'),
        load: document.querySelector('#load'),
        resize: document.querySelector('#resize'),
        togglePaint: document.querySelector('#toggle-paint'),
      },
      controls: {
        numStates: document.querySelector('#num-states'),
        selectPreset: document.querySelector('#select-preset'),
        customRule: document.querySelector('#custom-rule'),
        addRule: document.querySelector('#add-rule'),
        checkAll: document.querySelector('#check-all'),
        setAll: document.querySelector('#set-all'),
        selectNeighborhood: document.querySelector('#select-neighborhood'),
      }
    };
    Object.assign(this, DEFAULTS, props, ...args);
    let numStates;
    if (this.availableRules[this.rule]) {
      this.rules = Array(this.maxNumStates).fill(this.availableRules[this.rule]);
      numStates = this.maxNumStates;
      this.preset = null;
    }
    else {
      this.rules = Object.assign(
        Array(this.maxNumStates).fill(this.availableRules[this.defaultRule]),
        this.presets[this.preset].map((e) => this.availableRules[e])
      );
      numStates = this.presets[this.preset].length;
    }
    if (this.numStates && this.numStates != numStates) {
      this.controls.numStates.value = this.numStates;
      this.preset = null;
    }
    else {
      this.controls.numStates.value = numStates;
      this.numStates = numStates;
    }
    this.bg = document.createElement('canvas');
    this.fg = document.createElement('canvas');
    this.bg.classList.add('canvas', 'canvas-bg');
    this.fg.classList.add('canvas', 'canvas-fg');
    this.bgCtx = this.bg.getContext('2d');
    this.fgCtx = this.fg.getContext('2d');

    while (this.container.firstChild) this.container.firstChild.remove();
    this.container.appendChild(this.bg);
    this.container.appendChild(this.fg);
    this.customRuleTemplate = this.controls.customRule.value;

    let scaleFactor = this.scaleFactor = window.devicePixelRatio || 1;
    // Let us infer if this is a mobile browser and make some tweaks
    if (scaleFactor > 1 && screen.width < 640) {
      this.mobile = true;
      document.body.classList.add('mobile');
      this.radius = this.mobileRadius;
      this.cellRadius = this.mobileCellRadius;
      this.undoStackSize = this.mobileUndoStackSize;
    }
    // But be more liberal with the paint toggle
    if (scaleFactor > 1 || screen.width < 960) {
      this.toolbarBottom.classList.remove('hidden');
    }
    for (let ctx of [this.bgCtx, this.fgCtx]) {
      let canvas = ctx.canvas;
      this.width = this.radius * this.cellRadius * Hexular.math.apothem * 4;
      this.height = this.radius * this.cellRadius * 3;
      canvas.style.width = this.width + 'px';
      canvas.style.height = this.height + 'px';
      canvas.width = this.width * scaleFactor;
      canvas.height = this.height * scaleFactor;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(scaleFactor, scaleFactor);
      ctx.translate(this.width / 2, this.height / 2);
    }

    document.body.style.backgroundColor = THEMES[this.theme].background;
    this.colors = THEMES[this.theme].colors.slice();

    window.onkeydown = (ev) => this.handleKeydown(ev);
    window.oncontextmenu = (ev) => this.handleContextmenu(ev);
    onCursorEvent(this, this.handleCursor);

    this.buttons.toggle.onmouseup = (ev) => this.toggle();
    this.buttons.step.onmouseup = (ev) => this.step();
    this.buttons.clear.onmouseup = (ev) => this.clear();
    this.buttons.undo.onmouseup = (ev) => this.undo();
    this.buttons.redo.onmouseup = (ev) => this.redo();
    this.buttons.config.onmouseup = (ev) => this.toggleConfig();
    this.buttons.saveImage.onmouseup = (ev) => this.saveImage();
    this.buttons.save.onmouseup = (ev) => this.save();
    this.buttons.load.onmouseup = (ev) => this.load();
    this.buttons.resize.onmouseup = (ev) => this.promptResize();
    this.buttons.togglePaint.onmouseup = (ev) => this.togglePaint();

    this.controls.addRule.onmouseup = (ev) => this.handleAddRule();
    this.controls.checkAll.onmouseup = (ev) => this.handleCheckAll();
    this.controls.numStates.onchange = (ev) => this.setNumStates(ev.target.value);
    this.controls.selectPreset.onchange = (ev) => this.selectPreset(ev.target.value);
    this.controls.setAll.onchange = (ev) => this.handleSetAll(ev);
    this.controls.selectNeighborhood.onchange = (ev) => this.setNeighborhood(ev.target.value);
  }

  get running() { return !!this.timer; }

  // Button handlers (can also be called directly)

  toggle() {
    if (!this.running) {
      this.timer = setInterval(this.step.bind(this), this.timerLength);
      this.buttons.step.disabled = true;
      this.buttons.toggle.innerHTML = 'pause';
    }
    else {
      clearInterval(this.timer);
      this.timer = null;
      this.buttons.step.disabled = false;
      this.buttons.toggle.innerHTML = 'play_arrow';
    }
  }

  step() {
    this.newHistoryState();
    try {
      hexular.step();
      adapter.draw();
      this.storeState();
      if (!hexular.changed)
        this.toggle();
    }
    catch (e) {
      console.log(e);
      this.setMessage(e, 'error');
    }
  }

  clear() {
    this.newHistoryState();
    if (this.running) this.toggle();
    hexular.clear();
    adapter.draw();
    this.storeState();
  }

  toggleConfig() {
    this.overlay.classList.toggle('hidden');
  }

  promptResize() {
    let radiusParam = this.mobile ? 'mobileRadius' : 'radius';
    let newSize = prompt('Plz enter new board size > 1 or 0 for default. Rules will be reset and cells outside of new radius will be lost.', hexular.radius);
    if (newSize == null)
      return;
    let n = Number(newSize) || DEFAULTS[radiusParam];
    if (isNaN(n) || n < 0 || n == 1) {
      this.setMessage('Board size must be natural number > 1', 'error');
    }
    else if (n != hexular.radius) {
      let [base, params] = window.location.href.split('?');
      let paramMap = {};
      params = (params || '').split('&').filter((e) => e != '').map((e) => {
        let [key, value] = e.split('=');
        paramMap[key] = value;
      });

      paramMap[radiusParam] = n;
      if (n == DEFAULTS[radiusParam])
        delete paramMap[radiusParam];
      let url = base;
      if (Object.keys(paramMap).length > 0)
        url += '?' + Object.entries(paramMap).map((e) => e.join('=')).join('&');
      location.href = url;
    }
  }

  togglePaint() {
    this.paint = this.buttons.togglePaint.classList.toggle('active');
  }

  // Add rule or preset - also use these if adding from console

  addRule(ruleName, fn) {
    this.availableRules[ruleName] = fn;
    this.refreshRules();
  }

  addPreset(presetName, fnArray) {
    this.presets[presetName] = fnArray;
    this.refreshRules();
  }

  // Save/load

  saveImage() {
    let dataUri = this.bg.toDataURL('image/png');
    this.promptDownload(this.defaultImagename, dataUri);
  }

  save() {
    let bytes = hexular.export();
    let blob = new Blob([bytes], {type: 'application/octet-stream'});
    let dataUri = window.URL.createObjectURL(blob);
    this.promptDownload(this.defaultFilename, dataUri);
  }

  load() {
    this.newHistoryState();
    let fileReader = new FileReader();
    let input = document.createElement('input');
    input.type = 'file';
    fileReader.onload = (ev) => {
      let buffer = ev.target.result;
      let bytes = new Int8Array(buffer);
      hexular.import(bytes);
      adapter.draw();
      this.storeState();
    };
    input.onchange = () => {
      fileReader.readAsArrayBuffer(input.files[0]);
    };
    input.click();
  }

  promptDownload(filename, dataUri) {
    let a = document.createElement('a');
    a.href = dataUri;
    a.download = filename;
    a.click();
  }

  storeState(bytes) {
    bytes = bytes || hexular.export();
    let str = bytes.join('');
    sessionStorage.setItem('modelState', str);
  }

  restoreState() {
    let modelState = sessionStorage.getItem('modelState');
    if (modelState) {
      this.newHistoryState();
      let bytes = new Int8Array(modelState.split(''));
      hexular.import(bytes);
      adapter.draw();
    }
  }

 // Undo/redo stuff

  newHistoryState() {
    this.undoStack.push(hexular.export());
    if (this.undoStack.length > this.undoStackSize)
      this.undoStack.shift();
    this.redoStack = [];
    this.refreshHistoryButtons();
  }

  undo() {
    let nextState = this.undoStack.pop();
    if (nextState) {
      let curState = hexular.export()
      hexular.import(nextState);
      this.storeState(nextState);
      this.redoStack.push(curState);
      adapter.draw();
      this.refreshHistoryButtons();
    }
  }

  redo() {
    let nextState = this.redoStack.pop();
    if (nextState) {
      let curState = hexular.export()
      hexular.import(nextState);
      this.storeState(nextState);
      this.undoStack.push(curState);
      adapter.draw();
      this.refreshHistoryButtons();
    }
  }

  refreshHistoryButtons() {
    this.buttons.undo.disabled = +!this.undoStack.length;
    this.buttons.redo.disabled = +!this.redoStack.length;
  }

  // Page/canvas listeners

  handleContextmenu(ev) {
    if (ev.target == this.fg) ev.preventDefault();
  }

  handleKeydown(ev) {
    let key = ev.key.toLowerCase();
    if (!ev.repeat) {
      // ESC to hide/show controls
      if (ev.key == 'Escape') {
        if (!this.overlay.classList.contains('hidden')) {
          this.toggleConfig();
        }
        else {
          this.toolbarTop.classList.toggle('hidden');
          this.toolbarBottom.classList.toggle('hidden');
          this.info.classList.toggle('hidden');
        }
      }

      // TAB to start/stop
      else if (ev.key == 'Tab') {
        this.toggle();
      }

      // SPACE to step or stop
      else if (ev.key == ' ') {
        if (this.running) {
          this.toggle();
        }
        else {
          this.step();
        }
      }
      else if (ev.ctrlKey) {
        if (key == 'z') {
          if (ev.shiftKey) {
            this.redo();
          }
          else {
            this.undo();
          }
        }
        else if (key == 's') {
          this.save();
        }

        else if (key == 'o') {
          this.load();
        }
        // We'll use ctrl+c (as SIGINT analog) instead of ctrl+n to clear screen or "new grid" if you will
        // b/c Webkit devs just want to see the world burn: https://bugs.chromium.org/p/chromium/issues/detail?id=33056
        else if (key == 'c') {
          this.clear();
        }
        else {
          return; // Do not prevent default for other ctrl key combos
        }

      }
      else {
        return;
      }
    }
    ev.preventDefault();
  }

  handleCursor(ev) {
    if (ev instanceof MouseEvent) {
      if (ev.type == 'mousedown') {
        if (ev.target == this.fg && this.selected && !this.setState) {
          this.newHistoryState();
          if (ev.buttons & 1) {
            this.shift = ev.shiftKey;
            this.setState = Hexular.math.mod(this.selected.state + 1, hexular.numStates);
            this.setCell(this.selected);
          }
          else if (ev.buttons & 2) {
            this.setState = Hexular.math.mod(this.selected.state - 1, hexular.numStates);
            this.setCell(this.selected);
          }
        }
        else if (ev.target == this.overlay) {
          this.toggleConfig();
        }
        else if (ev.target == this.message) {
          this.clearMessage();
        }
      }
      else if (ev.type == 'mouseup' && this.setState != null) {
        this.clearCursorState();
      }
      else if (ev.type == 'mousemove') {
        let cell;
        if (ev.target == this.fg) {
          this.selectCell([ev.pageX, ev.pageY]);
          if (this.setState != null)
            this.setCell(this.selected);
        }
        if (ev.target != this.info) {
          let cell = this.selected;
          this.info.innerHTML = cell && cell.coord.map((c) => (c > 0 ? '+' : '-') + ('0' + Math.abs(c)).slice(-2)) || '';
        }
      }
    }
    // Else is TouchEvent
    else {
      if (ev.targetTouches.length == 1 && ev.target == this.fg) {
        let [x, y] = [ev.targetTouches[0].pageX, ev.targetTouches[0].pageY];
        if (ev.type == 'touchstart' && this.paint) {
          if (this.selected) {
              this.selectCell([x, y]);
              this.setState = Hexular.math.mod(this.selected.state + 1, hexular.numStates);
              this.setCell(this.selected);
          }
        }
        if (ev.type == 'touchend') {
          this.clearCursorState();
        }
        if (ev.type == 'touchmove') {
          this.selectCell([x, y]);
          this.setCell(this.selected);
        }
        if (this.paint) {
          ev.preventDefault();
        }
      }
    }
  }

  clearCursorState() {
    this.shift = false;
    this.lastSet = null;
    this.setState = null;
    this.storeState();
  }
  // Cell selection and setting

  selectCell(coord) {
    let cell;
    if (coord) {
      let {x, y} = this.fg.getBoundingClientRect();
      x = Math.max(0, x);
      y = Math.max(0, y);
      cell = adapter.cellAt([
        coord[0] - this.width / 2 - x,
        coord[1] - this.height / 2 - y
      ]);
    }
    this.selected = cell;
    adapter.selectCell(cell);
  }

  setCell(cell) {
    if (cell && cell != this.lastSet) {
      cell.state = this.shift ? 0 : this.setState;
      this.lastSet = cell;
      adapter.selectCell();
      adapter.drawCell(cell);
    }
  }

  // Alert messages

  setMessage(message, className) {
    className = className || 'alert';
    this.message.classList = 'message active ' + className;
    this.message.innerHTML = message;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.clearMessage();
    }, 5000);
  }

  clearMessage() {
    this.message.className = 'message';
    requestAnimationFrame(() => this.message.innerHTML = '');
    clearTimeout(this.messageTimer);
  }

  handleAddRule() {
    try {
      let obj = new Function(`return (${this.controls.customRule.value})`)();
      if (Object.keys(obj).length < 1) {
        this.setMessage('No rules added. Too bad.');
        return;
      }
      Object.assign(this.availableRules, obj);
      this.refreshRules();
      let ruleNames = Object.keys(obj);
      this.controls.customRule.addClass
      this.setMessage(`Added rule${ruleNames.length > 1 ? 's' : ''} ${ruleNames.join(', ')}.`);
    }
    catch (err) {
      this.setMessage(`An error occurred: ${err}.`, 'error');
    }
  }

  handleCheckAll() {
    let check = !this.ruleMenus.every((ruleMenu) => ruleMenu.checked);
    if (check)
      this.controls.checkAll.classList.add('checked');
    else
      this.controls.checkAll.classList.remove('checked');
    this.ruleMenus.forEach((ruleMenu) => {
      ruleMenu.checked = check;
    });
  }

  handleSetAll(ev) {
    let ruleName = this.controls.setAll.value;
    const rule = this.availableRules[ruleName] || this.rules.identityRule;
    this.ruleMenus.forEach((ruleMenu) => {
      if (ruleMenu.checked) {
        ruleMenu.select.value = ruleName;
        hexular.rules[ruleMenu.index] = rule;
      }
    });
    this.controls.setAll.selectedIndex = 0;
    this.checkPreset();
  }

  handleSetRule(ev) {
    const ctl = ev.target;
    hexular.rules[ctl.ruleMenu.index] = this.availableRules[ctl.value] || this.availableRules.identityRule;
    this.checkPreset();
  }

  // Set default neighborhood for rules using top-level cell helper functions

  setNeighborhood(neighborhood) {
    hexular.setNeighborhood(neighborhood);
  }

  // Preset setting and checking

  selectPreset(presetName) {
    const presetList = this.presets[presetName];
    if (!presetList)
      return;
    this.setNumStates(presetList.length);
    this.ruleMenus.forEach((ruleMenu) => {
      let ruleName = presetList[ruleMenu.index] || 'identityRule';
      let fn = this.availableRules[ruleName];
      ruleMenu.select.value = ruleName;
      hexular.rules[ruleMenu.index] = fn;
    });
    this.preset = presetName;
    this.controls.selectPreset.value = presetName;
  }

  checkPreset() {
    const presetList = this.presets[this.preset];
    if (!presetList)
      return;
    let dirty = (() => {
      if (hexular.numStates != presetList.length)
        return true;
      return hexular.rules.slice(0, hexular.numStates).reduce((a, ruleFn, idx) => {
        return a || this.availableRules[idx] != ruleFn;
      }, false);
    })();
    if (dirty) {
      this.controls.selectPreset.selectedIndex = 0;
      this.preset = null;
    }
  }

  setNumStates(val) {
    if (val)
      this.controls.numStates.value = val;
    const numStates = parseInt(this.controls.numStates.value);
    hexular.numStates = parseInt(numStates);
    this.ruleMenus.forEach((ruleMenu) => {
      let disabled = ruleMenu.index >= numStates;
      ruleMenu.container.setAttribute('data-disabled', disabled);
      hexular.rules[ruleMenu.index] = this.rules[ruleMenu.index];
    });
    this.checkPreset();
  }

  refreshRules() {
    // Refresh presets
    this.controls.selectPreset.options.length = 1;
    for (let presetName of Object.keys(this.presets)) {
      let option = document.createElement('option');
      option.text = presetName;
      option.selected = presetName == this.preset;
      this.controls.selectPreset.appendChild(option);
    }

    // Refresh rules
    this.controls.setAll.options.length = 1;
    for (let ruleName of Object.keys(this.availableRules)) {
      let option = document.createElement('option');
      option.text = ruleName;
      this.controls.setAll.appendChild(option);
    }

    while (this.ruleConfig.firstChild) this.ruleConfig.firstChild.remove();
    this.ruleMenus = [];

    for (let i = 0; i < this.maxNumStates; i++) {
      let ruleMenu = new RuleMenu(i, this.availableRules, hexular.rules[i], i >= hexular.numStates);
      ruleMenu.select.addEventListener('change', (ev) => this.handleSetRule(ev));
      this.ruleMenus.push(ruleMenu);
      this.ruleConfig.appendChild(ruleMenu.container);
    }
  }
}

class RuleMenu {
  constructor(idx, rules, selected, disabled) {
    this.index = idx;
    let prototype = document.querySelector('.assets .rule-menu');
    let container = this.container = prototype.cloneNode(true);
    let select = this.select = container.querySelector('select');
    let indicator = this.indicator = container.querySelector('.indicator');
    select.ruleMenu = this;
    container.title = `State ${idx}`;
    container.setAttribute('data-disabled', disabled);
    indicator.style.backgroundColor = adapter.colors[idx];
    for (let [ruleName, fn] of Object.entries(rules)) {
      let option = document.createElement('option');
      option.text = ruleName;
      option.selected = selected == fn;
      select.appendChild(option);
    }
    indicator.addEventListener('mouseup', (ev) => {
      this.checked = !this.checked;
    });
  }

  set checked(val) {
    if (val) this.container.classList.add('checked');
    else this.container.classList.remove('checked');
  }

  get checked() {
    return this.container.classList.contains('checked');
  }
}