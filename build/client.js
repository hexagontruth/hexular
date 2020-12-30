/**
 * @overview
 * @version 0.3.0-alpha
 * @author graham
 * @copyright 2020
 * @license Hexagonal Awareness License (HAL)
 */

  /**
  * Filters are functions that take in a state value, plus optionally a {@link Cell} instance, and return a potentially
  * modified form of that value.
  *
  * See {@link Filter} for details on adding and removing filters.
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
   * A selection of sundry functions with anticipated general utility.
   *
   * @namespace {object} Hexular.util
   */

var Hexular = (function () {
  const hexularAttributes = {
    defaults: {
      // Default size for cubic (hexagonal) topology, where `0`` is a single cell, `1` is 7 cells, &c.
      order: 30,
      // Default size for offset (rectangular) topology
      rows: 60,
      cols: 60,
      // Default rule is used whenever a cell state does not have an entry in model.rules
      defaultRule: identityRule,
      // Array type to use for import/export
      arrayType: Uint8Array,
      // This is only needed if one is using modFilter or certain cell/neighborhood helper functions
      numStates: 2,
      // Some functions depend on the ground state evaluating to false so changing this may be weird
      groundState: 0,
      cellRadius: 10,
    },

    /**
     * A collection of elements representing common hexagonal concepts for general semantic interoperability.
     *
     * @namespace {object} Hexular.enums
     */
    enums: {
      /**
       * Enumerator representing nothing whatsoever.
       *
       * This must be the unique enum evaluating to false.
       *
       * @name NONE
       * @default 0
       * @constant
       * @memberof Hexular.enums
       */
      NONE: 0,

      /**
       * Enumerator representing flat-topped, the greatest of all hexagons.
       *
       * @name TYPE_FLAT
       * @default 2
       * @constant
       * @memberof Hexular.enums
       */
      TYPE_FLAT: 2,

      /**
       * Enumerator representing pointy-topped hexagons.
       *
       * @name TYPE_POINTY
       * @default 1
       * @constant
       * @memberof Hexular.enums
       */
      TYPE_POINTY: 1,

      /**
       * Enumerator representing circles &mdash; the most degenerate form of hexagon.
       *
       * @name TYPE_CIRCLE
       * @default 64
       * @constant
       * @memberof Hexular.enums
       */
      TYPE_CIRCLE: 64,

      /**
       * Enumerator representing triangles whose orientation can be contextually inferred.
       * 
       * (For instance, the alternating members of a hex grid's dual triangular grid.)
       *
       * @name TYPE_TRI_AUTO
       * @default 10
       * @constant
       * @memberof Hexular.enums
       */
      TYPE_TRI_AUTO: 10,

      /**
       * Enumerator representing triangles with a vertex facing up.
       *
       * @name TYPE_TRI_UP
       * @default 11
       * @constant
       * @memberof Hexular.enums
       */
      TYPE_TRI_UP: 11,

      /**
       * Enumerator representing triangles with a vertex facing down.
       *
       * @name TYPE_TRI_DOWN
       * @default 12
       * @constant
       * @memberof Hexular.enums
       */
      TYPE_TRI_DOWN: 12,

      /**
       * Enumerator representing triangles with a vertex facing left.
       *
       * @name TYPE_TRI_LEFT
       * @default 13
       * @constant
       * @memberof Hexular.enums
       */
      TYPE_TRI_LEFT: 13,

      /**
       * Enumerator representing triangles with a vertex facing right.
       *
       * @name TYPE_TRI_RIGHT
       * @default 14
       * @constant
       * @memberof Hexular.enums
       */
      TYPE_TRI_RIGHT: 14,
      /**
       * Enumerator representing inverse triangles from contextually inferred ones.
       *
       * @name TYPE_TRI_ANTI_AUTO
       * @default 15
       * @constant
       * @memberof Hexular.enums
       * @see {@link Hexular.enums.TYPE_TRI_AUTO}
       */
      TYPE_TRI_ANTI_AUTO: 15,
      /**
       * Enumerator representing shape stroke.
       *
       * @name STROKE
       * @default 32
       * @constant
       * @memberof Hexular.enums
       */
      STROKE: 32,
      /**
       * Enumerator representing shape fill.
       *
       * @name FILL
       * @default 33
       * @constant
       * @memberof Hexular.enums
       */
      FILL: 33,
    },
  };

  /**
   * Principal function object assigned to global `Hexular` object or returned as module.
   *
   * @param {...object} ...args Arguments to pass to Model constructor
   * @return {Model}             Model instance
   * @global
   */
  const Hexular = (...args) => {
    let Class = (args[0] && args[0].prototype instanceof Model) ? args.shift() : Hexular.defaults.model;
    return new Class(...args);
  }
  merge(Hexular, hexularAttributes);

  /**
   * A collection of mathematical properties and functions used internally, which may be of interest when extending
   * core functionality.
   *
   * @namespace {object} Hexular.math
   */

  const APOTHEM = Math.sqrt(3) / 2;

  let math = {
    apothem: APOTHEM,
    hextant: Math.PI * 2 / 6,
    tau: Math.PI * 2,
    inverseApothem: 1 / APOTHEM,
    vertices: [
      [0.5, APOTHEM],
      [1, 0],
      [0.5, -APOTHEM],
      [-0.5, -APOTHEM],
      [-1, 0],
      [-0.5, APOTHEM],
    ],
    /**
     * 2*2 basis matrix for converting unit cubic [u, v] coordinates to cartesian [x, y].
     *
     * @name basis
     * @type number[][]
     * @memberof Hexular.math
     */
    basis: [
      [2 * APOTHEM, APOTHEM],
      [0,           1.5]
    ],
    /**
     * 2*2 inverse basis matrix for converting unit cartesian [x, y] coordinates to cubic [u, v].
     *
     * @name invBasis
     * @type number[][]
     * @memberof Hexular.math
     */
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
      if (obj[key] == null)
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
        defaultRule: Hexular.defaults.defaultRule,
        /**
         * Default numeric type for binary import and export.
         *
         * @name Model#arrayType
         * @default Uint8Array
         */
        arrayType: Hexular.defaults.arrayType,
        /**
         * Total number of states.
         *
         * Convenience attribute used by cell neighborhood and filter functions.
         *
         * @name Model#numStates
         * @type number
         * @default 2
         */
        numStates: Hexular.defaults.numStates,
        /**
         * Default ground or "off" state for cells.
         *
         * Used by cell initialization, {@link Model#import}, and {@link Model#clear}.
         *
         * @name Model#groundState
         * @type number
         * @default 0
         */
        groundState: Hexular.defaults.groundState,
        /**
         * Non-negative numberic value defining cell radius for spatial rendering.
         *
         * Used for determining x, y position of a cell in a given topology for e.g. rendering on a canvas. Not used
         * internally by model.
         *
         * @name Model#cellRadius
         * @type number
         * @default: 10
         * @see {@link Model#basis}
         * @see {@link Model#getCoord}
         */
        cellRadius: Hexular.defaults.cellRadius,
        /**
         * Array of rule functions.
         *
         * Cells are matched with rules based on their states, with e.g. `rules[1]` being caled when
         * {@link Cell#state|cell.state} == `1`.
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
         * @default []
         */
        filters: new HookList(),
        /**
         * Canonical, publicly-exposed one-dimensional array of cells in an order defined by a given subclass.
         *
         * @name Model#cells
         * @type Cell[]
         */
        cells: [],
        /**
         * Optional array for cells sorted via the {@link Model#sortCells} method.
         *
         * @name Model#sortedCells
         * @default null
         * @type Cell[]
         */
        sortedCells: null,
        /**
         * Mapping of cells to [x, y] coordinates computed using {@link Model#cellRadius} and (implementation
         *-dependent) {@link Model#getCoord}.
         *
         * Like {@link Model#cellRadius} and {@link Model#basis}, this is only necessary when rendering cells in a
         * spatial context.
         *
         * @name Model#cellMap
         * @type Map
         */
        cellMap: new Map(),
        /**
         * Boolean flag that is set to true during {@link Model#step} when any {@link Cell#state} is changed, and false
         * otherwise.
         *
         * Can be used to e.g. automatically stop an auto-incrementing model when it goes "dead."
         *
         * @name Model#changed
         * @type boolean
         */
        changed: null,
      };
      Object.assign(this, defaults, ...args);
      /**
       * A 2*2 row-major transformation matrix for converting cubic coordinates to cartesian [x, y] values.
       *
       * Derived from {@link Hexular.math.basis} scaled by {@link Model#cellRadius}.
       *
       * @name Model#basis
       * @type number[][]
       * @see {@link Model#cellRadius}
       * @see {@link Model#getCoord}
       */
      this.basis = scalarOp(math.basis, this.cellRadius);
      /**
       * Apothem computed from {@link Model#cellRadius}.
       *
       * @name Model#cellApothem
       * @type number
       *
       */
      this.cellApothem = this.cellRadius * math.apothem;
    }

    /**
     * Advance state of each cell according to rule defined in {@link Model.rules|this.rules} for current state key.
     */
    step() {
      this.changed = false;
      this.eachCell((cell) => {
        let nextState
        try {
          nextState = (this.rules[cell.state] || this.defaultRule)(cell);
        }
        catch (e) {
          let idx = this.cells.findIndex((e) => e == cell);
          console.error(`An error occurred while processing cell ${cell} at index ${idx}:`, e);
          if (e instanceof TypeError) {
            throw new HexError(`Invalid rule function for state "${cell.state}"`);
          }
          else {
            throw e;
          }
        }
        cell.nextState = this.filters.call(nextState, cell);
        if (!this.changed && cell.nextState != cell.state)
          this.changed = true;
      });
      this.eachCell((cell) => {
        cell.lastState = cell.state;
        cell.state = cell.nextState;
      });
    }

    /**
     * Reset each cell state to {@link Model.groundState|this.groundState}.
     */
    clear() {
      this.eachCell((cell) => {
        cell.setState(this.groundState);
      });
    }

    /**
     * Set {@link Cell#neighborhood} for each cell to given value.
     *
     * @param {number} neighborhood One of the natural numbers [6, 12, 18, 7, 13, 19].
     */
    setNeighborhood(neighborhood) {
      this.eachCell((cell) => {
        cell.neighborhood = neighborhood;
      })
    }

    /**
     * Call a given function for each cell in a model, and return an array of that function's return values.
     *
     * We iterate over {@link Model#sortedCells|this.sortedCells} if it is defined, otherwise
     * {@link Model#cells|this.cells}.
     *
     * @param {function} fn Function to call for each {@link Cell|cell}, taking the cell as an argument
     * @return {number[]}    Array of return values with same size as {@link Model#cells|this.cells}
     */
    eachCell(fn) {
      let cells = this.sortedCells || this.cells;
      let a = new Array(cells.length);
      for (let i = 0; i < cells.length; i++) {
        a[0] = fn(cells[i]);
      }
      return a;
    }

    /**
     * Sort cells by given sort function and store in {@link Model#sortedCells|this.sortedCells}.
     */
    sortCells(fn) {
      if (!fn) {
        this.sortedCells = null;
      }
      else {
        this.sortedCells = this.cells.slice();
        this.sortedCells.sort(fn);
      }
    }

    /**
     * Get sorted or topologically-ordered cells as array.
     */
    getCells() {
      return this.sortedCells || this.cells;
    }

    /**
     * Build cell map using {@link Model#cellRadius} and `Model` subclass implementation of {@link Model#eachCoord}.
     *
     * This should optionally be called by an adapter, &c., that wishes to use canonical cartesian coordinates for
     * cells. This method should be idempotent.
     */
    buildCellMap() {
      this.cellMap.clear();
      this.eachCell((cell) => {
        let mapCoord = this.getCoord(cell);
        this.cellMap.set(cell, mapCoord);
      });
    }

    /**
     * Call a given function for each coordinate defined by a model's topology.
     *
     * This is typically used by a model's constructor to instantiate cells, but should be exposed externally as well.
     *
     * @param {function} fn Function to call for each coordinate, taking a coordinate argument that e.g. is used to
     *                       construct {@link Cell#coord}
     */
    eachCoord(fn) {
      HexError.methodNotImplemented('eachCoord');
    }

    /**
     * Get coordinates of cell according to {@link Model#cellRadius}, relative to an origin defined by a subclass.
     *
     * @param {Cell} cell       The cell to position
     * @return {number[]}       The cell's [x, y] position according to the model topology
     */
    getCoord(cell) {
      HexError.methodNotImplemented('getCoord');
    }

    /**
     * Find cell at given cubic coordinates in model.
     *
     * There is no "topologically agnostic" way to spatially locate a cell in any given model. Thus, we leave the
     * onus on specific `Model` subclasses to convert cubic coordinates to their internal coordinate system, and allow
     * interested clients to look up cells spatially using this convention.
     *
     * @param {number[]} coord Array of [u, v, w] coordinates
     * @return {Cell}           Cell at coordinates, or null
     */
    cellAtCubic([u, v, w]) {
      HexError.methodNotImplemented('cellAtCubic');
    }

    /**
     * Get cell at specific [x, y] coordinates.
     *
     * This is used by Hexular Studio and potentially other display-facing applications for locating a cell from e.g.
     * a user's cursor position using {@link Model#cellRadius}.
     *
     * @param {number[]} coord An [x, y] coordinate tuple
     * @return {Cell}           The cell at this location, or null
     * @see {@link Hexular.math.cartesianToCubic}
     * @see {@link Hexular.math.roundCubic}
     * @see {@link Model#cellAtCubic}
     */
    cellAt([x, y]) {
      // First convert to cubic coords
      let rawCubic = cartesianToCubic([x, y]);
      let cubic = roundCubic(rawCubic, this.cellRadius);
      let cell = this.cellAtCubic(cubic);
      return cell;
    }

    /**
     * Export cell states to a typed byte array.
     *
     * Neither this method nor its counterpart {@link Model#import} deals with other aspects of models or cells,
     * such as {@link Model#rules|rules} or {@link Cell#neighborhood|neighborhoods}, and will not prove effective,
     * under the default settings, for non-numeric states or states outside the range -128...128.
     *
     * @return {TypedArray} Typed array of cell states
     * @see {@link Model#arrayType})
     * @see {@link Model#import}
     */
    export() {
      let array = this.arrayType.from(this.cells.map((e) => e.state));
      return array;
    }

    /**
     * Import cell states from typed or untyped array.
     *
     * @param {TypedArray|Array} array Any array of cell states
     * @param {number[]} skip          Optional array of states to skip over
     * @see {@link Model#arrayType})
     * @see {@link Model#export}
     */
    import(array, skip) {
      let len = Math.min(array.length, this.cells.length);
      for (let i = 0; i < len; i++) {
        if (!skip || !skip.includes(array[i]))
          this.cells[i].setState(array[i] || this.groundState);
      }
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
      super(...args);
      let defaults = {
        /**
         * @name OffsetModel#cols
         * @type number
         * @default 60
         */
        cols: Hexular.defaults.cols,
        /**
         * @name OffsetModel#rows
         * @type number
         * @default 60
         */
        rows: Hexular.defaults.rows,
        cells: [],
      };
      Object.assign(this, defaults, args);
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

    getCoord(cell) {
      let r = this.cellRadius;
      let [i, j] = cell.coord;

      // Like converting to cubic coords but mod 2 wrt x offset
      let x = this.basis[0][0] * i + this.basis[0][1] * (j % 2);
      let y = this.basis[1][0] * i + this.basis[1][1] * j;
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
   * Hexular Studio, `u` points down, `v` points to the right, and `w` points to the left.
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
      let defaults = {
        /**
         * @name CubicModel#order
         * @type number
         * @default 30
         */
        order: Hexular.defaults.order,
      };
      Object.assign(this, defaults, ...args);
      HexError.validateKeys(this, 'order');
      let order = this.order;
      let cols = this.cols = order * 2 + 1;
      this.size = this.order * (order + 1) * 3 + 1;
      this.rhombus = {};
      this.eachCoord(([u, v, w]) => {
          // Being on an edge affects draw actions involving neighbors
          let edge = absMax(u, v, w) == order;
          this.rhombus[u * cols + v] = new Cell(this, [u, v, w], {edge});
      });
      // A hack for the trivial case
      if (order == 0) {
        this.rhombus[0].nbrs.fill(this.rhombus[0]);
      }
      // Otherwise connect simple neighbors
      else {
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
              if (Math.abs(nbr[dir]) > order) {
                let sign = Math.sign(nbr[dir]);
                let dirA = (dir + 1) % 3;
                let dirB = (dir + 2) % 3;
                nbr[dir] -= sign * cols;
                nbr[dirA] += sign * order;
                nbr[dirB] = -nbr[dir] - nbr[dirA];
              }
            }
            cell.nbrs[1 + (i + 5) % 6] = this.rhombus[nbr[0] * cols + nbr[1]];
          }
        });
      }
      /**
       * `CubicModel` orders its `cells` array in rings from the center out, starting with a zero-indexed origin cell.
       * This allows cell states to be backed up and restored via {@link Model#export} and {@link Model#import} across
       * differently-sized maps. Cells always remain centered and in the correct order, though a smaller map will
       * truncate cells outside of its area.
       *
       * @name CubicModel.cells
       * @type Cell[]
       */
      this.cells = this.rhombus[0].wrap(this.order);

      // Connect extended neighbors
      this.eachCell((cell) => {
        cell.extendNeighborhood();
      });
    }

    eachCoord(fn) {
      for (let u = -this.order; u <= this.order; u++) {
        for (let v = -this.order; v <= this.order; v++) {
          let w = -u - v;
          if (Math.abs(w) > this.order) continue;
          if (fn([u, v, -u - v]) === false) return false;
        }
      }
      return true;
    }

    getCoord(cell) {
      let r = this.cellRadius;
      let [u, v, w] = cell.coord;

      let [x, y] = matrixMult(this.basis, [v, u]);
      return [x, y];
    }

    cellAtCubic([u, v, w]) {
      if (absMax(u, v, w) > this.order)
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
     * @param {Model} model       Model for populating {@link Cell#model|this.model}
     * @param {number[]} coord    Coordinate array for populating {@link Cell#coord|this.coord}
     * @param {...object} ...args One or more settings objects to apply to cell
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
         * The previous cell state.
         *
         * @name Cell#lastState
         * @type number
         */
        lastState: 0,
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
         * That is, we have three rings where the first neighbor in each ring forms a line zigzagging away from the
         * home cell. This arrangement allows successive neighborhoods to be iterated through contiguously using the
         * same array.
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
     * String representation of cell for debugging purposes.
     *
     * @return {string} String representation of {@link Cell#coord|this.coord} wrapped in square brackets.
     */
    toString() {
      return `[${this.coord}]`;
    }

    /**
     * Set state and erase value of lastState.
     *
     * @param {*} state New cell state
     */
    setState(state) {
      this.state = state;
      this.lastState = this.model.groundState;
    }

    /**
     * Find all cells out to a given radius, ordered by radial ring.
     *
     * This is used to order {@link CubicModel#cells}, and by the hex-drawing tools in Hexular Studio.
     *
     * @param {number} order A nonnegative integer
     * @return {Cell[]}        An array of cells, including the current cell, of length `3 * order * (order + 1) + 1`
     */
    wrap(order) {
      let cells = [this];
      for (let i = 1; i <= order; i++) {
        let cell = this;
        // We select the first simple neighbor in the i-th ring
        for (let j = 0; j < i; j++)
          cell = cell.nbrs[1];

        for (let j = 0; j < 6; j++) {
          let dir = 1 + (j + 2) % 6;
          for (let k = 0; k < i; k++) {
            cell = cell.nbrs[dir];
            cells.push(cell);
          }
        }
      }
      return cells;
    }

    /**
     * Shortcut for {@link Neighborhood#nbrSlice|this.with[this.neighborhood].minIdx}.
     *
     * @readonly
     */
    get minIdx() { return this.with[this.neighborhood].minIdx; }

    /**
     * Shortcut for {@link Neighborhood#nbrSlice|this.with[this.neighborhood].maxIdx}.
     *
     * @readonly
     */
    get maxIdx() { return this.with[this.neighborhood].maxIdx; }

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
     * @param {Cell} cell  Parent cell, usually instantiator of neighborhood
     * @param {number} min Minimum index (inclusive) of neighborhood in {@link Cell#nbrs}.
     * @param {number} max Maximum index (exclusive) of neighborhood in {@link Cell#nbrs}.
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
     * @param {function[]} functions Optional initial list of functions to add
     */
    constructor(arg) {
      // We need to allow Array constructor signature to keep Array methods from freaking out
      let functions = typeof arg == 'number' || arg == null ? [] : arg;
      super();
      this.replace(functions)
    }

    /**
     * Add function to list.
     *
     * @param {function|function[]} filter                  Filter function to add, or an array of such functions
     * @param {number} [idx=this.length] Optional insertion index (defaults to end of array)
     */
    add(filterArg, idx=this.length) {
      let filters = Array.isArray(filterArg) ? filterArg : [filterArg];
      this.splice(idx, 0, ...filters);
    }

    /**
     * Remove a given filter function.
     *
     * Functions are compared via toString() method, so the first identically-coded function will be removed.
     *
     * @param {function} filter Filter to remove
     * @return {number}         The index of the removed function or -1 if not found
     */
    delete(filter) {
      let str = filter.toString();
      let idx = this.findIndex((e) => e.toString() == str);
      idx >= -1 && this.splice(idx, 1);
      return idx;
    }

    /**
     * Convenience method for removing all existing functions and optionally adding new ones.
     *
     * Call without argument to clear all functions.
     *
     * @param {function[]} functions=[] List of new functions to add
     */
    replace(functions=[]) {
      this.length = 0;
      for (let fn of functions)
        this.push(fn);
    }

    /**
     * Convenience method for removing member functions with filter function.
     *
     * Member functions that return true are kept; others are removed and returned in an array.
     *
     * @param {function} fn Filter function taking a member function and returning a boolean value
     * @return {function[]} Member functions removed during filtering
     */
    keep(fn) {
      let removed = [];
      this.replace(this.filter((e) => {
        let val = fn(e);
        val || removed.push(e);
        return val;
      }));
      return removed;
    }

    /**
     * Convenience method for rotating callback order.
     *
     * Sometimes a drawing callback is in the wrong place wrt others. This is essentially a wrapper for
     * `hookList.unshift(hookList.pop())` (default behavior) and associated operations.
     *
     * @param {number} [n=1] Negative/positive offset
     */
    rotate(n=1) {
      if (n > 0) {
        let slice = this.splice(this.length -n);
        this.replace(slice.concat(this));
      }
      else if (n < 0) {
        let slice = this.splice(0, -n);
        this.replace(this.concat(slice));
      }
    }

    /**
     * Call each function entry in hook list.
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
     * The former mechanism is used by {@link Model#filters}.
     *
     * @param {*} val        First argument to be passed to at least initial function
     * @param {...*} ...args Additional arguments to pass to each hook function
     * @return {*}            Return value of last hook function called, or original `val`
     */
    call(val, ...args) {
      for (let i = 0; i < this.length; i++) {
        let newVal = this[i](val, ...args);
        val = newVal === undefined ? val : newVal;
      }
      return val;
    }

    /**
     * Call each function entry for every value in the given array, completing each function for all elements in the
     * array before moving on to the next.
     *
     * @param {array} array       Array of values to pass to hook to functions
     * @param {...object} ...args Additional arguments to pass to each hook function
     */
    callParallel(array, ...args) {
      for (let i = 0; i < this.length; i++) {
        for (let j = 0; j < array.length; j++) {
          this[i](array[j], ...args);
        }
      }
    }
  }

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
   * Debatably, this should return {@link Model#groundState}, but for various reasons doesn't.
   *
   * @memberof Hexular.rules
   */
  function nullRule(cell) {
    return 0;
  }

  // --- FILTERS ---

  /**
   * Constrain state to zero or one, with values less than zero being counted as the former.
   *
   * Must be run before {@link Hexular.filters.modFilter|modFilter}!.
   *
   * @memberof Hexular.filters
   */
  function binaryFilter(value) {
    return value > 0 ? 1 : 0;
  }

  /**
   * Add new state to current cell state if nonzero, otherwise set to zero.
   *
   * This is the some sense the opposite of, and generally &mdash; though not always &mdash; mutually exclusive with,
   * {@link Hexular.filters.binaryFilter|binaryFilter}.
   *
   * @memberof Hexular.filters
   */
  function deltaFilter(value, cell) {
    return value ? cell.state + value : 0;
  }

  /**
   * Prevent state from going below 0.
   *
   * Must be run before {@link Hexular.filters.modFilter|modFilter}!.
   *
   * @memberof Hexular.filters
   */
  function clipBottomFilter(value) {
    return Math.max(0, value);
  }

  /**
   * Prevent state from going above the value defined in {@link Model#numStates}.
   *
   * @memberof Hexular.filters
   */
  function clipTopFilter(value, cell) {
    return Math.min(cell.model.numStates - 1, value);
  }

  /**
   * Set new cell values to modulus with respect to {@link Model#numStates}.
   *
   * This filter has the effect of making states cyclical. Historically this was the default behavior. There is, in
   * principle, nothing preventing one from using non-numeric or complex multivalued cell states, but like much of the
   * boilerplate functionality, this filter is implemented on the assumption that states will be natural numbers.
   *
   * @memberof Hexular.filters
   */
  function modFilter(value, cell) {
    return mod(value, cell.model.numStates);
  }

  /**
   * Always set edge cells to ground state.
   *
   * This filter has the effect of disabling wraparound cells, since no cell state can affect a cell neighborhood
   * across the two-cell boundary width. This may have unexpected and undesirable effects with certain rules.
   *
   * @memberof Hexular.filters
   */
  function edgeFilter(value, cell) {
    return !cell.edge ? value : cell.model.groundState;
  }

  // --- UTILITY FUNCTIONS ---

  /**
   * Utility function for recursively merging arrays and objects.
   *
   * Works similarly to `Object.assign`, with the first argument taking the merged properties of the remaining ones,
   * applied from left to right so that e.g. later arguments overwrite earlier ones.
   *
   * In addition to recursively merging objects (by creating new objects for all but the base object), `null` values in
   * arrays are ignored when merging. So, e.g., `merge([1, 2], [null, 3])` will return `[1, 3]`.
   *
   * Additionally, one may use a non-array object to merge sparse keys with an array. So for instance
   * `merge([1, 2], {2: 3})` will return `[1, 2, 3]`.
   *
   * @param  {object} ...objs One or more objects or arrays to be recursively merged
   * @return {type}           The updated first argument passed to the function
   * @memberof Hexular.util
   */
  function merge(...objs) {
    let base = objs.shift();
    let next;
    let mergeWhitelist = [Object, Array];
    while (next = objs.shift()) {
      for (let [key, val] of Object.entries(next)) {
        let baseVal = base[key];
        // Keep nulls when overwriting undefined
        if (val == null) {
          base[key] = baseVal || val;
          continue;
        }
        // Populate objects and arrays as appropriate
        if (!baseVal) {
          let defaultBaseVal = Array.isArray(val) ? [] : typeof val == 'object' ? {} : null;
          baseVal = defaultBaseVal;
        }
        // Do things
        if (typeof val == 'object' && !mergeWhitelist.includes(val.constructor)) {
          base[key] = val;
        }
        else if (Array.isArray(val) && Array.isArray(baseVal)) {
          base[key] = merge([], baseVal, val);
        }
        else if (typeof baseVal =='object' && typeof val == 'object') {
          base[key] = merge({}, baseVal, val);
        }
        else {
          base[key] = val;
        }
      }
    }
    return base;
  }

  /**
  * Convenience method for extracting specific keys from an object into a new object.
  *
  * @param {object} obj    An object
  * @param {string[]} keys An array of keys to extract from said object
  * @return {object}       An new object containing the given keys and values from the original object
  * @memberof Hexular.util
  **/

  function extract(obj, keys) {
    let newObj = {};
    for (let key of keys) {
      newObj[key] = obj[key];
    }
    return newObj;
  }

  /**
  * Convenience method for returning an argument unchanged.
  *
  * Used as placeholder where e.g. mutual equivalence of such placeholders is important.
  *
  * @param {*} arg Any value
  * @return {*}    The same value
  * @memberof Hexular.util
  */
  let identity = (e) => e;

  /**
  * Generates an elementary rule based on the state of a cell's six immediate neighbors plus optionally itself.
  *
  * The most significant (left-most) bit represents the lowest neighbor number in the selected range, while the least
  * significant bit represents the highest. Thus, the same rule masks can be used with `opts.range` set to either
  * `[0, 7]` or `[1, 7]` (default).
  *
  * Modeled roughly after Wolfram's
  * [Elementary Cellular Automaton]{@link http://mathworld.wolfram.com/ElementaryCellularAutomaton.html} rules.
  *
  * @param {BigInt|number[]} ruleDef          With default `opts.range`, 64-bit number indicating next position per
  *                                           possible state, or an array of 6-bit numbers indicating activation states
  *                                           numbers giving individual states where next cell state is 1
  * @param {object} opts                      Optional arguments
  * @param {number[]} [opts.range=[1, 7]]     Neighborhood range &mdash; default is N6 (immediate neighbors)
  * @param {number} [opts.miss=0]             Value to set on rule miss
  * @param {number} [opts.match=1]            Value to set on rule match
  * @param {boolean} [opts.missRel=false]     Whether to increment miss value from current state
  * @param {boolean} [opts.matchRel=false]    Whether to increment match value from current state
  * @param {boolean} [opts.rel=false]         If true, compare neighbors with current state, matching when former is
  *                                           nonzero and difference is >= 0
  * @return {function}                        A rule function taking a {@link Cell} instance and returning an integer
  * @memberof Hexular.util
  * @see {@link Hexular.util.templateRuleBuilder}
  **/
  function ruleBuilder(ruleDef, opts={}) {
    let defaults = {
      range: [1, 7],
      miss: 0,
      match: 1,
      missRel: 0,
      matchRel: 0,
      rel: 0,
    };
    let {range, miss, match, missRel, matchRel, rel} = Object.assign(defaults, opts);
    let [start, stop] = range;
    let rangeLength = stop - start;
    missRel = +missRel;
    matchRel = +matchRel;
    rel = +rel;

    if (typeof ruleDef == 'function' && ruleDef.n) {
      ruleDef = ruleDef.toObject()[0];
    }
    let n;
    if (ruleDef && ruleDef.length) {
      // For serialization consistency
      if (Array.isArray(ruleDef))
        ruleDef = ruleDef.slice().sort((a, b) => a - b);
      n = 0n;
      for (let state of ruleDef) {
        n = n | 1n << BigInt(state);
      }
    }
    else {
      n = BigInt(ruleDef);
    }

    let rule = (cell) => {
      let nbrStates = 0;
      for (let i = 0; i < rangeLength; i++) {
        let nbrState = cell.nbrs[start + i].state
        let nbrDiff = nbrState - cell.state * rel;
        nbrStates = nbrStates | ((nbrState && nbrDiff >= 0 ? 1 : 0) << (rangeLength - i - 1));
      }
      return (n >> BigInt(nbrStates)) % 2n ?
        (cell.state * matchRel) + match :
        (cell.state * missRel) + miss;
    };
    rule.n = n;
    rule.range = range;
    rule.toObject = () => [ruleDef, {range, miss, match, missRel, matchRel, rel}];
    rule.toString = () => JSON.stringify(rule.toObject());
    return rule;
  }

  /**
   * Generates a rule consisting of one or more templates that are matched in turn to the cell's eighteen neighboring
   * states, successively updating the cell's state.
   *
   * This allows a superset of rules including but not limited to those generated with
   * {@link Hexular.util.ruleBuilder}, allowing ternary conditions for neighbor cells (on, off, and indifferent), plus
   * the ability to only consider certain activated states.
   *
   * For details on the constitution of template objects, please consult the source code.
   *
   * @param  {object[]} templates An array of template objects
   * @return {function}           A rule function taking a {@link Cell} instance and returning an integer
   * @memberof Hexular.util
   * @see {@link Hexular.util.ruleBuilder}
   */
  function templateRuleBuilder(templateDefs=[{}]) {
    let templateDefaults = {
      applyFn: (a, b) => 1,
      matchFn: (c, a, b) => c,
      match: 1,
      miss: -1,
      matchRel: 1,
      missRel: 1,
      sym: 0,
      states: Array(19).fill(-1),
    };
    // Merge defaults and re-instantiate lambda strings
    let templates = templateDefs.map((template) => {
      for (let fnKey of ['applyFn', 'matchFn']) {
        if (typeof template[fnKey] == 'string') {
          let evalFn = new Function('fnString', 'return eval(fnString)');
          template[fnKey] = evalFn(template[fnKey]);
        }
      }
      return merge({}, templateDefaults, template);
    });
    // Copy back to exportable defs
    let exportDefs = merge([], templates);
    // Re-stringify matchFn
    exportDefs.forEach((template) => {
      template.applyFn = template.applyFn.toString();
      template.matchFn = template.matchFn.toString();
    });
    // Create mirror template state maps based on symmetry setting
    templates.forEach((template, idx) => {
      let states = template.states.slice();
      let alts = [states];
      for (let i = 1; i < 6; i++) {
        let sym6 = states.slice(1, 7);
        let sym12 = states.slice(7, 13);
        let sym18 = states.slice(13, 19);
        sym6.push(sym6.shift());
        sym12.push(sym12.shift());
        sym18.push(sym18.shift());
        states = states.slice(0, 1).concat(sym6, sym12, sym18);
        if (i % template.sym == 0) {
          alts.push(states);
        }
      }
      for (let i = 0; i < alts.length; i++) {
        let alt = alts[i];
        let remaining = alts.slice(i + 1);
        let dups = [];
        for (let j = 0; j < remaining.length; j++) {
          let isDup = remaining[j].reduce((a, e, k) => a && alt[k] == e, true);
          isDup && dups.unshift(i + j + 1);
        }
        dups.forEach((idx) => alts.splice(idx, 1));
      }
      template.stateMaps = alts;
    });

    let rule = (cell) => {
      let nbrStates = cell.with[19].map;
      let cellState = cell.state;
      for (let template of templates) {
        if (!template.applyFn(cell.state, cellState))
          continue;
        let match = false;
        for (let stateMap of template.stateMaps) {
          let matchMap = true;
          for (let i = 0; i < 19; i++) {
            let mapCellState = stateMap[i];
            let matchState = template.matchFn(nbrStates[i], cell.state, cellState);
            let matchCell = matchState && mapCellState || !matchState && mapCellState != 1;
            if (!matchCell) {
              matchMap = false;
              break;
            }
          }
          if (matchMap) {
            match = true;
            break;
          }
        }
        if (match) {
          if (template.matchRel) cellState += template.match;
          else cellState = template.match;
        }
        else {
          if (template.missRel) cellState += template.miss;
          else cellState = template.miss;
        }
      }
      return cellState;
    };
    rule.templates = templates;
    rule.defs = exportDefs;
    rule.toObject = () => [rule.defs];
    rule.toString = () => JSON.stringify(rule.toObject());
    return rule;
  }

  // --- MATH STUFF ---

  /**
   * Modulo operation for reals.
   *
   * @param {number} a Dividend
   * @param {number} n Divisor
   * @return {number} Modulus
   * @memberof Hexular.math
   */
  function mod(a, n) {
    return ((a % n) + n) % n;
  }

  /**
   * Constraint a given number between two inclusive bounds.
   *
   * @param {number} n Value to clamp
   * @param {number} a Lower bound
   * @param {number} b Upper bound
   * @return {number} n when a <= n <= b, otherwise a or b
   * @memberof Hexular.math
   */
  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }

  /**
   * Perform element-wise arithmetic operation on arbitrarily-dimensioned tensor.
   *
   * @param {number[]} obj    Arbitrary-dimensional array of numbers
   * @param {number} scalar   Real number
   * @param {string} [op='*'] Either '+' or '*' &mdash; for subtraction or division, invert `scalar` argument
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
   * @param {number[][]} a          Two-dimensional array representing an `m`*`n` matrix, where outer length = `m` and
   *                                 inner length = `n`
   * @param {number[][]|number[]} b Two-dimensional array representing an `p`*`q` matrix or a one-dimensional array
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
   * Convenience method for generating a 2D rotation matrix for left-hand [x, y] coordinates.
   * 
   * @param {number} a    The angle of rotation in radians
   * @return {number[][]} Two-dimensional array representing a transformation matrix
   * @memberof Hexular.math
   */
  function rotationMatrix(a) {
    return [
      [Math.cos(a), Math.sin(a)],
      [-Math.sin(a), Math.cos(a)]
    ];
  }

  /**
   * Element-wise addition of two identical-length arrays.
   *
   * @param {array} u `n`-dimensional first argument
   * @param {array} v `n`-dimensional second argument
   * @return {array}   `n`-dimensional sum
   * @memberof Hexular.math
   */
  function vectorAdd(u, v) {
    return Array.isArray(u) ? u.map((e, i) => add(e, v[i])) : u + v;
  }

  /**
   * Helper function for finding the maximum absolute value among several real numbers.
   *
   * @param {...number} ...args Real numbers
   * @return {number}            Maximum absolute value of provided arguments
   * @memberof Hexular.math
   */
  function absMax(...args) {
    return Math.max(...args.map((e) => Math.abs(e)));
  }

  /**
   * Convert [x, y] coordinates to cubic coordinates [u, v, w].
   *
   * @param {array} coord Tuple of coordinates [x, y]
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
   * @param {array} coord       Array of real-valued cubic coordinates [u, v, w]
   * @param {number} [radius=1] Optional radius scalar &mdash; for converting "pixel" coords to "cell" coords
   * @return {array}             Integer cubic coordinates [u, v, w]
   * @memberof Hexular.math
   */
  function roundCubic([u, v, w], radius = 1) {
    [u, v, w] = scalarOp([u, v, w], 1 / radius);
    let ru = Math.round(u);
    let rv = Math.round(v);
    let rw = Math.round(w);

    let du = Math.abs(ru - u);
    let dv = Math.abs(rv - v);
    let dw = Math.abs(rw - w);

    if (du > dv && du > dw)
      ru = -rv - rw;
    else if (dv > dw)
      rv = -ru - rw;
    else
      rw = -ru - rv;
    return [ru, rv, rw];
  }

  // ---

  merge(Hexular, {math}, {
    defaults: {model: CubicModel},
    rules: {
      identityRule,
      nullRule,
    },
    filters: {
      binaryFilter,
      deltaFilter,
      clipBottomFilter,
      clipTopFilter,
      modFilter,
      edgeFilter,
    },
    util: {
      merge,
      extract,
      identity,
      ruleBuilder,
      templateRuleBuilder,
    },
    math: {
      mod,
      clamp,
      scalarOp,
      matrixMult,
      rotationMatrix,
      vectorAdd,
      absMax,
      cartesianToCubic,
      roundCubic,
      flatVertices: math.vertices,
      pointyVertices: math.vertices.slice(2).concat(math.vertices.slice(0, 2)).reverse().map(([x, y]) => [y, x]),
    },
    HexError,
    Model,
    Cell,
    HookList,
    OffsetModel,
    CubicModel,
  });

  return Hexular;
})();

if (typeof module != 'undefined')
  module.exports = Hexular;

class Action {
  constructor(board, ...args) {
    let config = board.config;
    let model = board.model;
    Object.assign(this, {board, config, model}, ...args);
    this.model = board.model;
    this.coords = [];
    this.board.clearFg();
    this.buffer = new Map();
  }

  start() {}
  move() {}
  end() {}

  _setCells(...cells) {
    let cur = new Map();
    for (let cell of cells) {
      if (this.buffer.get(cell) == this.setState)
        continue;
      this.buffer.set(cell, this.setState)
      cur.set(cell, this.setState);
    }
    this.board.fgAdapter.drawStateMap(cur);
  }

  _selectWithSize(arg) {
    if (Array.isArray(arg))
      return [].concat(...arg.map((e) => this._selectWithSize(e)));
    return arg ? arg.wrap(this.config.toolSize - 1) : [];
  }

  _applyBuffer() {
    if (this.buffer.size > 0) {
      let cells = Array.from(this.buffer.keys());
      this.board.newHistoryState();
      this.buffer.forEach((state, cell) => {
        cell.setState(state);
      });
      this.buffer.clear();
      this.board.clearFg();
      this.board.runHooks('paint', cells);
      this.board.draw();
    }
  }

  _getCoord(pointerEv) {
    return [pointerEv.pageX, pointerEv.pageY];
  }

  _getPointerCoord(ev) {
    let x, y;
    if (ev.pageX)
      [x, y] = this._getCoord(ev);
    else if (ev.touches && ev.touches[0])
      [x, y] = this._getCoord(ev.touches[0]);
    return [x, y];
  }

  _getAllCoords(ev) {
    if (ev.pageX)
      return [this._getCoord(ev)];
    else if (ev.touches)
      return Array.from(ev.touches).map((e) => this._getCoord(e));
  }

  _getHypot(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  _hypotToModel(h) {
    return h / this.model.cellApothem / this.board.scale;
  }
}

class NoneAction extends Action {
}

class MoveAction extends Action {
  start(ev) {
    this.startEv = ev;
    this.coords = [this._getPointerCoord(ev)];
  }
  move(ev) {
    this.coords.push(this._getPointerCoord(ev));
    let [last, cur] = this.coords.slice(-2);
    let diffX = cur[0] - last[0];
    let diffY = cur[1] - last[1];
    this.board.translate([diffX, diffY]);
  }
  end() {
    this.board.clearFg();
  }
}

class PinchAction extends Action {
  start(ev) {
    this.hypot = this._getHypotFromTouch(ev);
  }
  move(ev) {
    let newHypot = this._getHypotFromTouch(ev);
    this.board.scaleRelative(newHypot / this.hypot);
    this.hypot = newHypot;
  }
  _getHypotFromTouch(ev) {
    let t0 = this._getCoord(ev.touches[0]);
    let t1 = this._getCoord(ev.touches[1]);
    return this._getHypot(t0, t1);
  }
}

class PaintAction extends Action {
  constructor(...args) {
    super(...args);
    if (this.setState == null)
      this.setState = this.config.getPaintColor(0);
    if (this.ctrl)
      this.setState = this.model.groundState;
  }

  end() {
    this._applyBuffer();
    this.board.storeModelState();
  }
}

class FillAction extends PaintAction {
  start() {
    let homeCell = this.board.selected;
    let fillState = homeCell.state;
    let cellSet = new Set();
    cellSet.add(homeCell);
    let queue = homeCell.nbrs.slice(1, 7);
    let cur;
    while (cur = queue.shift()) {
      if (cur.state != fillState || cellSet.has(cur))
        continue;
      cellSet.add(cur);
      for (let i = 1; i < 7; i++)
        queue.push(cur.nbrs[i]);
    }
    let cells = Array.from(cellSet);
    this._setCells(...cells);
  }
}

class BrushAction extends PaintAction {
  start() {
    this._setCells(...this._selectWithSize(this.board.selected));
  }

  move() {
    this._setCells(...this._selectWithSize(this.board.selected));
  }
}

class LineAction extends PaintAction {
  start(ev) {
    this.originCell = this.board.selected;
    this.a = this.board.modelToWindow(this.model.getCoord(this.originCell));
    this.move(ev);
  }

  move(ev) {
    this.b = this._getPointerCoord(ev);
    this.length = this._getHypot(this.a, this.b);
    this.info = Math.round(this._hypotToModel(this.length) / 2);
    this._calculateCells();
  }

  _calculateCells() {
    let samples = this._hypotToModel(this.length);
    let [x, y] = this.a.slice();
    let xSample = (this.b[0] - this.a[0]) / samples;
    let ySample = (this.b[1] - this.a[1]) / samples;
    let cells = this._selectWithSize(this.originCell);
    for (let i = 1; i < samples; i++) {
      x += xSample;
      y += ySample;
      let cell = this.board.cellAt([x, y]);
      // We don't actually care about dups tho this probably could be tightened up a bit
      cells = cells.concat(this._selectWithSize(cell));
    }
    this._bufferCells(cells);
  }

  _bufferCells(cells) {
    this.board.clearFg();
    this.buffer.clear();
    cells.forEach((cell) => {
      this._setCells(cell);
    })
  }
}

class LocklineAction extends LineAction {
  move(ev) {
    this.b = this._getPointerCoord(ev);
    let x = this.b[0] - this.a[0];
    let y = this.b[1] - this.a[1];
    let h = this.length = this._getHypot(this.a, this.b);
    let a = Math.acos(x / h) / Hexular.math.hextant;
    if (Math.sin(y / h) < 0)
      a = 6 - a;
    let aRound = Math.round(a) % 6;
    let xRound = Math.cos(aRound * Hexular.math.hextant) * h;
    let yRound = Math.sin(aRound * Hexular.math.hextant) * h;
    this.b = [this.a[0] + xRound, this.a[1] + yRound];
    this.info = Math.round(this._hypotToModel(this.length) / 2);
    this._calculateCells();
  }
}

class HexAction extends LineAction {
  _calculateCells() {
    let pixRad = this.length / this.board.scale;
    this.radius = Math.ceil(pixRad / (this.board.model.cellApothem * 2) - 0.5);
    let cells = this.originCell.wrap(this.radius);
    let outline = cells.slice(-this.radius * 6);
    let expandedOutline = this._selectWithSize(outline);
    this._hexToBuffer(cells, expandedOutline);
  }
}

class HexFilledAction extends HexAction {
  _hexToBuffer(cells, expandedOutline) {
    this._bufferCells(cells.concat(expandedOutline));
  }
}

class HexOutlineAction extends HexAction {
  _hexToBuffer(cells, expandedOutline) {
    this._bufferCells(expandedOutline);
  }
}

// TODO: Massively refactor this and/or scatter it to the very winds

class CanvasAdapter {
  constructor(...args) {
    let defaults = {
      model: null,
      board: null,
      context: null,
    };
    Hexular.util.merge(this, defaults, ...args);
    Hexular.HexError.validateKeys(this, 'model', 'board', 'context');
    this.config = this.board.config;

    // Build cell map if not already built
    this.model.buildCellMap();

    // Common paths
    this.shapes = {};
    this.shapes[Hexular.enums.TYPE_FLAT] = Hexular.math.flatVertices.slice();
    this.shapes[Hexular.enums.TYPE_POINTY] = Hexular.math.pointyVertices.slice();
    this.shapes[Hexular.enums.TYPE_TRI_UP] = Hexular.math.pointyVertices.filter((_, i) => i % 2 == 0);
    this.shapes[Hexular.enums.TYPE_TRI_DOWN] = Hexular.math.pointyVertices.filter((_, i) => i % 2 != 0);
    this.shapes[Hexular.enums.TYPE_TRI_LEFT] = Hexular.math.flatVertices.filter((_, i) => i % 2 == 0);
    this.shapes[Hexular.enums.TYPE_TRI_RIGHT] = Hexular.math.flatVertices.filter((_, i) => i % 2 != 0);
  }

  set fillColor(color=Color.t) {
    this.context.fillStyle = color.toString();
  }

  set strokeColor(color=Color.t) {
    this.context.strokeStyle = color.toString();
  }

  draw() {
    // Provisional hack for the illusion of grid wrapping
    // This is by a wide margin now the worst function in this project
    // TODO: Rewrite
    this.board.eachHook(['draw', 'drawCell'], (hook, hookName) => {
      if (this.config.meta.repeat) {
        let rings = +this.config.meta.repeat;
        let f = this.config.meta.repeatRadius || this.config.order;
        let a = this.config.cellRadius * 2;
        let r = (f + 0.5) * 1.5 * a;
        let bigT = Hexular.math.scalarOp(Hexular.math.pointyVertices, r);
        let smolT = Hexular.math.scalarOp(Hexular.math.flatVertices, this.config.cellRadius * Hexular.math.apothem);
        let translate = (dir) => {
          this.context.translate(...bigT[dir]);
          this.context.translate(...smolT[(dir + 1) % 6]);
        };
        for (let i = 0; i < rings; i++) {
          this.context.save();
          for (let k = 0; k <= i; k++)
            translate(0);
          for (let j = 0; j < 6; j++) {
            for (let k = 0; k <= i; k++) {
              translate((j + 2) % 6);
              if (hookName == 'draw')
                this.board.runHook(hook, this);
              else
                this.board.runHookParallel(hook, this.model.getCells(), this);
            }

          }
          this.context.restore();
        }
      }
      if (hookName == 'draw')
        this.board.runHook(hook, this);
      else
        this.board.runHookParallel(hook, this.model.getCells(), this);
    });
  }

  clear() {
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.clearRect(0, 0, this.context.canvas.width, this.context.canvas.height);
    this.context.restore();
  }

  drawDefaultCells(cells=this.model.getCells()) {
    let opts = {
      type: Hexular.enums.TYPE_POINTY,
      fill: true,
      stroke: true,
      strokeStyle: this.config.modelBackgroundColor,
      lineWidth: Config.defaults.cellBorderWidth,
    };
    cells.forEach((cell) => {
      let state = cell.state;
      opts.fillStyle = this.config.fillColors[state] || this.config.defaultColor;
      this.drawShape(cell, this.config.cellRadius, opts);
    });
  }

  drawStateMap(map) {
    map.forEach((state, cell) => {
      let color = this.config.fillColors[state] || this.config.defaultColor;
      color = color[3] == 0 ? this.config.modelBackground : Color([color[0], color[1], color[2], 0xff]);
      this.context.fillStyle = color;
      this.drawPath(cell);
      this.context.fill();
    });
  }

  drawCircle(cell, radius=this.config.innerRadius) {
    const [x, y] = this.model.cellMap.get(cell);
    let ctx = this.context;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  }

  // Draw paths as relative points, without styling &c.
  drawPath(locator, path=this.config.pointyVertices) {
    const [x, y] = locator instanceof Hexular.Cell ? this.model.cellMap.get(locator) : locator;
    let ctx = this.context;
    ctx.beginPath();
    ctx.moveTo(x + path[0][0], y + path[0][1]);
    for (let i = 1; i < path.length; i++)
      ctx.lineTo(x + path[i][0], y + path[i][1]);
    ctx.closePath();
  }

  // Draw enumerated shapes or paths, without saving or restoring context
  drawShape(locator, radius=this.config.innerRadius, opts={}) {
    let defaults = {
      path: null,
      type: Hexular.enums.TYPE_POINTY,
      fill: false,
      stroke: false,
      fillStyle: null,
      strokeStyle: null,
      lineWidth: this.config.cellBorderWidth,
      lineJoin: 'miter',
      alpha: null,
      clip: false,
    };
    opts = Object.assign(defaults, opts);
    let ctx = this.context;
    if (opts.path) {
      this.drawPath(locator, Hexular.math.scalarOp(opts.path, radius));
    }
    else {
      const [x, y] = locator instanceof Hexular.Cell ? this.model.cellMap.get(locator) : locator;
      if (opts.type == Hexular.enums.TYPE_CIRCLE) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Hexular.math.tau);
      }
      else {
        let path = this.shapes[opts.type] || this.shapes[Hexular.enums.TYPE_POINTY];
        path = Hexular.math.scalarOp(path, radius);
        ctx.beginPath();
        ctx.moveTo(x + path[0][0], y + path[0][1]);
        for (let i = 1; i < path.length; i++)
          ctx.lineTo(x + path[i][0], y + path[i][1]);
        ctx.closePath();
      }
    }
    if (opts.clip) {
      ctx.clip();
    }
    else {
      if (opts.alpha != null) {
        ctx.globalAlpha = opts.alpha;
      }
      if (opts.fill) {
        ctx.fillStyle = (opts.fillStyle || this.config.defaultColor).toString();
        ctx.fill();
      }
      if (opts.stroke && opts.lineWidth) {
        ctx.strokeStyle = (opts.strokeStyle || this.config.defaultColor).toString();
        ctx.lineWidth = opts.lineWidth;
        ctx.lineJoin = opts.lineJoin;
        ctx.stroke();
      }
    }
  }

  getFillFade(cell) {
    let q = this.board.drawStepQ;
    let fade = this.config.fadeIndex;
    let cur = this.config.fillColors[cell.state] || this.config.defaultColor;
    let last = this.config.fillColors[cell.lastState] || this.config.defaultColor;
    if ( fade == 0 || q >= fade)
      return cur;
    else if (q == 0)
      return last;
    return cur.blend(last, q / fade);
  }

  getStrokeFade(cell) {
    let q = this.board.drawStepQ;
    let fade = this.config.fadeIndex;
    let cur = this.config.strokeColors[cell.state] || this.config.defaultColor;
    let last = this.config.strokeColors[cell.lastState] || this.config.defaultColor;
    if ( fade == 0 || q >= fade)
      return cur;
    else if (q == 0)
      return last;
    return cur.blend(last, q / fade);
  }

  drawFilledPointyHex(cell, style) {
    this.context.fillStyle = style || this.getFillFade(cell);
    this.drawPath(cell);
    this.context.fill();
  }

  drawOutlinePointyHex(cell, style, lineWidth) {
    lineWidth = lineWidth || this.config.cellBorderWidth;
    if (lineWidth == 0)
      return;
    this.context.strokeStyle = style || this.getStrokeFade(cell);

    this.context.lineWidth = lineWidth;
    this.drawPath(cell);
    this.context.stroke();
  }

  drawFilledFlatHex(cell, style) {
    this.context.fillStyle = style || this.getFillFade(cell);
    this.drawPath(cell, this.config.flatVertices);
    this.context.fill();
  }

  drawOutlineFlatHex(cell, style, lineWidth) {
    lineWidth = lineWidth || this.config.cellBorderWidth;
    if (lineWidth == 0)
      return;
    this.context.strokeStyle = style || this.getStrokeFade(cell);
    this.context.lineWidth = lineWidth;
    this.drawPath(cell, this.config.flatVertices);
    this.context.stroke();
  }

  drawFilledCircle(cell, style) {
    this.context.fillStyle = style || this.getFillFade(cell);
    this.drawCircle(cell);
    this.context.fill();
  }

  drawOutlineCircle(cell, style, lineWidth) {
    lineWidth = lineWidth || this.config.cellBorderWidth;
    if (lineWidth == 0)
      return;
    this.context.strokeStyle = style || this.getStrokeFade(cell);
    this.context.lineWidth = lineWidth
    this.drawCircle(cell);
    this.context.stroke();
  }

  drawBackground() {
    if (this.config.order == null) return;
    this.context.save();
    this.context.setTransform(1, 0, 0, 1, 0, 0);
    this.context.fillStyle = this.board.recordingMode ?
      this.config.modelBackgroundColor.toString() : this.config.backgroundColor.toString();
    this.context.fillRect(0, 0, this.context.canvas.width, this.context.canvas.height);
    this.context.restore();
    if (this.config.drawModelBackground && !this.board.recordingMode) {
      let radius = (this.config.order + 1) * this.config.cellRadius * Hexular.math.apothem * 2;
      this.context.beginPath();
      this.context.moveTo(radius, 0);
      for (let i = 0; i < 6; i++) {
        let a = Math.PI / 3 * i;
        this.context.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      }
      this.context.closePath();
      this.context.fillStyle = this.config.modelBackgroundColor;
      this.context.fill();
    }
  }
}

class Board {
  static registerPlugin(PluginClass) {
    Board.availablePlugins[PluginClass.name] = PluginClass;
    Board.instance && Board.instance.modals.draw.update();
  }

  static resize(configOpts={}, boardOpts=Board.defaults) {
    // TODO: Wtf is this even doing?
    return new Promise((resolve, reject) => {
      document.body.classList.add('splash');
      let oldBoard = Board.instance;
      oldBoard && oldBoard.stop();
      setTimeout(async () => {
        let board = new Board(configOpts, boardOpts);
        Board.instance = board;
        if (oldBoard) {
          oldBoard.pluginControls.forEach((e) => e.delete());
          board.undoStack = oldBoard.undoStack;
          board.redoStack = oldBoard.redoStack;
          board.refreshHistoryButtons();
          Object.entries(oldBoard.hooks).forEach(([key, value]) => {
            value.forEach((hook) => {
              // We do not wish to copy over the "core" radio button hooks
              // TODO: Change addHook sig to fix the ridiculousness of this
              hook.fn.radio || board.addHook(key, hook, hook);
            });
          });
        }
        Board.config = board.config;
        Board.model = board.model;
        Board.bgAdapter = board.bgAdapter;
        Board.adapter = board.adapter;
        Board.fgAdapter = board.fgAdapter;
        Board.modals = board.modals;
        Board.meta = board.config.meta;
        Board.plugins = board.config.plugins;
        Board.shared = board.shared;
        Board.db || Board.initDb();
        board.runHooks('resize');
        await board.draw();
        board.clearFg();
        document.body.classList.remove('splash');
        resolve();
      }, 50);
    });
  }

  static async initDb() {
    // Initialize media database
    const DB_VERSION = 1;
    const DB_SCHEME = {
      media: {keyPath: 'name'}
    };
    Board.db = new Database('hexular', DB_VERSION, DB_SCHEME);
    await Board.db.connect();
    return true;
  }

  static get aspectRatio() {
    return window.innerWidth / window.innerHeight;
  }

  static get defaults() {
    let defaults = {
      selected: null,
      debugSelected: null,
      lastSet: null,
      setState: null,
      timer: null,
      drawStep: 0,
      drawStepQ: 0,
      drawStepQInc: 0,
      playStart: null,
      playSteps: 0,
      playLast: null,
      shared: new SharedStore(),
      messageTimer: null,
      undoStack: [],
      redoStack: [],
      msgIdx: 0,
      shift: false,
      configMenu: false,
      altView: false,
      imageCapture: null,
      recorder: null,
      recordingMode: false,
      recordingModeUsers: new Set(),
      hooks: {
        incrementStep: [],
        playStep: [],
        beforeStep: [],
        autopauseStep: [],
        step: [],
        draw: [],
        drawCell: [],
        drawStep: [],
        timer: [],
        playStart: [],
        playStop: [],
        recordStop: [],
        resize: [],
        center: [],
        select: [],
        debugSelect: [],
        debugStep: [],
        drawFg: [],
        clear: [],
        paint: [],
        updatePreset: [],
        updateTheme: [],
      },
      hookMap: {},
      hookQueue: new Set(),
      pluginControls: [],
      scaling: false,
      scaleQueue: [],
      toolClasses: {
        none: NoneAction,
        move: MoveAction,
        fill: FillAction,
        brush: BrushAction,
        line: LineAction,
        lockline: LocklineAction,
        hexfilled: HexFilledAction,
        hexoutline: HexOutlineAction,
        pinch: PinchAction,
      },
      sizableTools: [
        'brush',
        'line',
        'lockline',
        'hexfilled',
        'hexoutline',
        'none',
      ],
      modal: null,
      modalTranslate: null,
      container: document.querySelector('.container'),
      overlay: document.querySelector('.modal-container'),
      messageWrapper: document.querySelector('.message-wrapper'),
      message: document.querySelector('.message'),
      menus: {
        top: document.querySelector('#toolbar-top'),
        color: document.querySelector('#color-menu'),
        config: document.querySelector('#config-menu'),
      },
      infoBoxes: {
        cursor: document.querySelector('.info-cursor'),
        timer: document.querySelector('.info-timer'),
        steps: document.querySelector('.info-steps'),
        tool: document.querySelector('.info-tool'),
      },
      buttons: {
        toolHider: document.querySelector('.tool-hider button'),
        toggleRecord: document.querySelector('#toggle-record'),
        togglePlay: document.querySelector('#toggle-play'),
        step: document.querySelector('#step'),
        clear: document.querySelector('#clear'),
        undo: document.querySelector('#undo'),
        redo: document.querySelector('#redo'),
        toggleMenu: document.querySelector('#toggle-menu'),
        showConfig: document.querySelector('#show-config'),
        showTheme: document.querySelector('#show-theme'),
        showDraw: document.querySelector('#show-draw'),
        showPlugin: document.querySelector('#show-plugin'),
        showResize: document.querySelector('#show-resize'),
        showSrb: document.querySelector('#show-srb'),
        showTrb: document.querySelector('#show-trb'),
        showCustom: document.querySelector('#show-custom'),
        saveSnapshot: document.querySelector('#snapshot-save'),
        loadSnapshot: document.querySelector('#snapshot-load'),
        showDoc: document.querySelector('#show-doc'),
        saveImage: document.querySelector('#save-image'),
        toggleImageCapture: document.querySelector('#toggle-image-capture'),
        load: document.querySelector('#load'),
        save: document.querySelector('#save'),
        saveData: document.querySelector('#save-data'),
        loadData: document.querySelector('#load-data'),
        toggleLock: document.querySelector('#toggle-lock'),
        showClear: document.querySelector('#show-clear'),
      },
      tools: {
        fill: document.querySelector('#tool-fill'),
        move: document.querySelector('#tool-move'),
        brush: document.querySelector('#tool-brush'),
        line: document.querySelector('#tool-line'),
        lockline: document.querySelector('#tool-lockline'),
        hexfilled: document.querySelector('#tool-hexfilled'),
        hexoutline: document.querySelector('#tool-hexoutline'),
      },
      toolSizes: [
        document.querySelector('#ts-1'),
        document.querySelector('#ts-2'),
        document.querySelector('#ts-3'),
      ],
      toolMisc: {
        center: document.querySelector('#center'),
        color: document.querySelector('#tool-color'),
      },
      allColorButtons: Array.from(document.querySelectorAll('.toolbar.colors button')),
      colorButtons: [],
    };
    defaults.disableWhenRecording = [
      defaults.buttons.step,
      defaults.buttons.undo,
      defaults.buttons.redo,
      defaults.buttons.saveSnapshot,
      defaults.buttons.loadSnapshot,
      defaults.buttons.saveImage,
      defaults.buttons.toggleImageCapture,
      defaults.buttons.save,
      defaults.buttons.load,
    ];
    return defaults;
  }

  constructor(configOpts={}, boardOpts=Board.defaults) {
    Object.assign(this, boardOpts);
    this.config = new Config(this, configOpts);
    this.execCommandBroken = Util.execCommandBroken();
    this.hookCounter = 1;

    // Initialize canvases
    this.container.querySelectorAll('canvas').forEach((e) => e.remove());
    this.bgCanvas = document.createElement('canvas');
    this.mainCanvas = document.createElement('canvas');
    this.fgCanvas = document.createElement('canvas');
    this.bgCanvas.classList.add('canvas', 'canvas-bg');
    this.bgCanvas.classList.add('canvas', 'canvas-main');
    this.fgCanvas.classList.add('canvas', 'canvas-fg');
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.mainCtx = this.mainCanvas.getContext('2d');
    this.fgCtx = this.fgCanvas.getContext('2d');
    this.container.appendChild(this.bgCanvas);
    this.container.appendChild(this.mainCanvas);
    this.container.appendChild(this.fgCanvas);

    window.onblur = (ev) => this.handleBlur(ev);
    window.onkeydown = (ev) => this.handleKey(ev);
    window.onkeyup = (ev) => this.handleKey(ev);
    window.oncontextmenu = (ev) => this.handleContextmenu(ev);
    window.onresize = (ev) => this.resetTransform();
    window.onwheel = (ev) => this.handleWheel(ev);
    OnMouseEvent(this, this.handleMouse);
    OnTouchEvent(this, this.handleTouch);

    this.buttons.toolHider.onclick = this.click(this.toggleToolHidden);
    this.buttons.togglePlay.onclick = this.click(this.togglePlay);
    this.buttons.step.onclick = this.click(this.step);
    this.buttons.clear.onclick = this.click(this.clear);
    this.buttons.undo.onclick = this.click(this.undo);
    this.buttons.redo.onclick = this.click(this.redo);
    this.buttons.toggleRecord.onclick = this.click(this.toggleRecord);
    this.buttons.toggleMenu.onclick = this.click(this.toggleMenu);
    this.buttons.showConfig.onmousedown = () => this.toggleModal('config');
    this.buttons.showDraw.onmousedown = () => this.toggleModal('draw');
    this.buttons.showTheme.onmousedown = () => this.toggleModal('theme');
    this.buttons.showResize.onmousedown = () => this.toggleModal('resize');
    this.buttons.showSrb.onmousedown = () => this.toggleModal('srb');
    this.buttons.showTrb.onmousedown = () => this.toggleModal('trb');
    this.buttons.showPlugin.onmousedown = () => this.toggleModal('plugin');
    this.buttons.showCustom.onmousedown = () => this.toggleModal('custom');

    this.buttons.saveSnapshot.onclick = this.click(this.saveSnapshot);
    this.buttons.loadSnapshot.onclick = this.click(this.loadSnapshot);
    this.buttons.showDoc.onclick = this.click(this.showDoc);
    this.buttons.saveImage.onclick = this.click(this.promptSaveImage);
    this.buttons.toggleImageCapture.onclick = this.click(this.toggleImageCapture);
    this.buttons.load.onclick = this.click(this.load);
    this.buttons.save.onclick = this.click(this.save);
    this.buttons.loadData.onclick = this.click(this.loadData);
    this.buttons.saveData.onclick = this.click(this.saveData);
    this.buttons.toggleLock.onclick = () => this.config.setLock();
    this.buttons.showClear.onclick = () => this.handleClearStorage();

    this.tools.move.onclick = this.click((ev) => this.config.setTool('move'), this.config);
    this.tools.brush.onclick = this.click((ev) => this.config.setTool('brush'), this.config);
    this.tools.fill.onclick = this.click((ev) => this.config.setTool('fill'), this.config);
    this.tools.line.onclick = this.click((ev) => this.config.setTool('line'), this.config);
    this.tools.lockline.onclick = this.click((ev) => this.config.setTool('lockline'), this.config);
    this.tools.hexfilled.onclick = this.click((ev) => this.config.setTool('hexfilled'), this.config);
    this.tools.hexoutline.onclick = this.click((ev) => this.config.setTool('hexoutline'), this.config);
    this.toolMisc.center.onclick = this.click(this.resetTransform);
    this.toolMisc.color.onclick = this.click(this.config.setPaintColorMode, this.config);
    this.toolSizes.forEach((button, i) => {
      button.onclick = this.click(() => this.config.setToolSize(i + 1), this.config);
    });
    this.allColorButtons.forEach((button, i) => {
      button.onmousedown = (ev) => this.handleSetColor(ev, i);
    });

    let {order, numStates, groundState, cellRadius, cellGap, colors} = this.config;
    this.model = Hexular({order, numStates, groundState, cellRadius});
    this.bgAdapter = new CanvasAdapter({model: this.model, board: this, context: this.bgCtx, cellGap, colors});
    this.adapter = new CanvasAdapter({model: this.model, board: this, context: this.mainCtx, cellGap, colors});
    this.fgAdapter = new CanvasAdapter({model: this.model, board: this, context: this.fgCtx, cellGap, colors});
    this.resetTransform();

    this.modals = {
      confirm: new ConfirmModal(this, 'confirm'),
      config: new ConfigModal(this, 'config'),
      theme: new ThemeModal(this, 'theme'),
      draw: new DrawModal(this, 'draw'),
      plugin: new PluginModal(this, 'plugin'),
      resize: new ResizeModal(this, 'resize'),
      srb: new SrbModal(this, 'srb'),
      trb: new TrbModal(this, 'trb'),
      custom: new CustomModal(this, 'custom'),
    }
    this.toggleModal();
    this.config.restoreModel();
    this.config.initialize();
  }

  get running() { return !!this.timer; }

  // Bypass Firefox's idiotic space-click
  click(fn, bind=this) {
    return (ev) => ev.pageX && ev.pageY && fn.bind(bind)();
  }

  eachContext(fn) {
    [this.bgCtx, this.mainCtx, this.fgCtx].forEach(fn);
  }

  draw() {
    if (!this.drawPromise && this.adapter) {
      this.drawPromise = new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
          if (!this.running) {
            try {
              this.drawPromise && this.drawSync();
              resolve();
            }
            catch (e) {
              reject(e);
            }
          }
          else {
            resolve();
          }
          this.drawPromise = null;
        });
      });
    }
    return this.drawPromise;
  }

  drawSync() {
    this.bgAdapter.clear();
    this.bgAdapter.drawBackground();
    this.adapter.context.lineCap = this.config.defaultCap;
    this.adapter.context.lineJoin = this.config.defaultJoin;
    this.config.clearOnDraw && this.adapter.clear();
    this.adapter.draw();
    this.altView && this.drawFg();
    this.recorder && this.recorder.draw();
    this.drawPromise = null;
  }

  // Button handlers (can also be called directly)

  toggleRecord() {
    if (!this.recorder) {
      if (!this.running)
        requestAnimationFrame(() => this.start());
      this.playStart = Date.now();
      this.disableWhenRecording.forEach((e) => e.disabled = true);
      this.buttons.toggleRecord.className = 'icon-stop active';
      this.setButtonTitle(this.buttons.toggleRecord, 'Stop');
      this.startRecordingMode('record');
      this.drawSync();
      this.recorder = new Recorder(this);
      this.recorder.start();
    }
    else {
      this.recorder.stop();
      this.recorder = null;
      requestAnimationFrame(() => {
        this.stop();
        this.draw();
      });
      this.endRecordingMode('record');
      this.buttons.toggleRecord.className = 'icon-record';
      this.setButtonTitle(this.buttons.toggleRecord, 'Record');
      this.disableWhenRecording.forEach((e) => e.disabled = false);
    }
  }

  togglePlay() {
    if (!this.running) {
      this.start();
    }
    else {
      this.stop();
    }
  }

  start() {
    if (!this.running) {
      this.playLast = this.playStart = Date.now();
      this.playSteps = 0;
      this.timer = setInterval(() => {
        let cur = Date.now();
        let delta = cur - this.playLast;
        if (delta >= this.config.interval) {
          this.playLast = cur;
          this.playSteps ++;
          this.step();
        }
      }, 5);
      this.startMeta();
      this.buttons.step.disabled = true;
      this.buttons.togglePlay.className = 'icon-pause';
      this.setButtonTitle(this.buttons.togglePlay, 'Pause');
      this.runHooks('playStart');
    }
  }

  stop() {
    if (this.running) {
      if (this.recorder)
        this.toggleRecord();
      clearInterval(this.timer);
      this.timer = null;
      this.resetDrawStep();
      this.playStart = null;
      this.playLast = null;
      this.stopMeta();
      this.buttons.step.disabled = false;
      this.buttons.togglePlay.className = 'icon-play';
      this.setButtonTitle(this.buttons.togglePlay, 'Play');
      this.runHooks('playStop');
    }
  }

  startMeta() {
    let hooks = this.hooks.timer.slice();
    let sexFmt = (i) => ('00' + i).slice(-2);
    this.infoBoxes.cursor.classList.add('hidden');
    this.recorder && this.infoBoxes.timer.classList.add('recording');
    this.metaInterval = setInterval(() => {
      let deltaMs = Date.now() - this.playStart;
      let deltaSecs = Math.floor(deltaMs / 1000);
      let thirds = Math.floor((deltaMs % 1000) * 60 / 1000);
      let secs = deltaSecs % 60;
      let mins = Math.floor(deltaSecs / 60) % 60;
      let str = `${sexFmt(mins)}:${sexFmt(secs)}:${sexFmt(thirds)}`;
      this.setInfoBox('timer', str);
      while (hooks[0] && hooks[0].trigger <= deltaMs) {
        let hook = hooks.shift();
        hook.fn();
      }
    }, 10);
  }

  stopMeta() {
    clearInterval(this.metaInterval);
    this.metaInterval = null;
    this.setInfoBox('timer');
    this.infoBoxes.cursor.classList.remove('hidden');
    this.infoBoxes.timer.classList.remove('recording');
  }

  async step() {
    try {
      this.drawStep = (this.drawStep + 1) % this.config.drawStepInterval;
      if (this.config.drawStepInterval > 1) {
        this.drawStepQ = this.drawStep / this.config.drawStepInterval;
        this.drawStepQInc = this.drawStep / (this.config.drawStepInterval - 1 || 1);
      }
      else {
        this.drawStepQ = this.drawStepQInc = 1;
      }
      if (!this.drawStep) {
        this.runHooks('beforeStep');
        this.newHistoryState();
        this.model.step();
        this.storeModelState();
        this.runHooks('autopauseStep');
        if (!this.model.changed && this.config.autopause) {
          this.stop();
          this.undo(true);
        }
        else {
          this.config.setSteps(this.config.steps + 1);
          this.running
            ? this.runHooks('playStep')
            : this.runHooks('incrementStep');
          this.runHooks('step');
          this.debugSelected && this.runHooks('debugStep', this.debugSelected);
        }
      }
      this.drawSync();
      this.runHooks('drawStep');
      // Reset cell order in case sorting has been applied
      this.model.sortCells();
    }
    catch (e) {
      console.error(e);
      this.setMessage(e, 'error');
      if (this.running)
        this.stop();
    }

  }

  clear() {
    this.newHistoryState();
    this.model.clear();
    this.resetDrawStep();
    this.adapter.clear();
    this.draw();
    this.storeModelState();
    this.config.setSteps(0);
    this.runHooks('clear');
  }

  clearFg() {
    this.fgAdapter.clear();
    this.runHooks('drawFg');
  }

  createHook(key, obj, opts={}) {
    this.hooks[key] = this.hooks[key] || [];
    let fn = obj.fn || obj;
    let id;
    if (opts.id != null) {
      id = opts.id;
      this.removeHook(id);
    }
    else {
      while (id == null || this.hookMap[id])
        id = this.hookCounter++;
    }
    obj = {...opts, key, fn, id};
    this.hookMap[obj.id] = obj;
    return obj;
  }

  addHook(key, obj, opts={}) {
    let idx = opts.index != null ? opts.index : this.hooks[key].length;
    delete opts.index;
    obj = this.createHook(key, obj, opts);
    this.hooks[key].splice(idx, 0, obj);
    return obj;
  }

  // This is ridiculous
  addTrigger(key, obj, trigger) {
    obj = this.createHook(key, obj, {trigger});
    this.hooks[key].push(obj);
    this.hooks[key].sort((a, b) => a.trigger - b.trigger);
    return obj;
  }

  removeHook(...args) {
    // "Old style" hook removal not actually used anywhere and also stupid
    if (args.length == 2 && typeof args[1] == 'function') {
      let [hook, fn] = args;
      let idx = this.hooks[hook].findIndex((e) => e.fn == fn);
      if (idx != -1)
        this.hooks[hook].splice(idx, 1);
    }
    else {
      let id = args[0] && args[0].id  || args[0];
      let obj = this.hookMap[id];
      if (obj)
        this.hooks[obj.key] = this.hooks[obj.key].filter((e) => e.id != id);
    }
  }

  clearHooks(key) {
    if (this.hooks[key])
      this.hooks[key] = [];
  }

  runHooks(hook, ...args) {
    let fns = this.hooks[hook] || [];
    fns.forEach((e) => e.fn(...args));
  }

  runHooksAsync(hook, ...args) {
    if (!this.hookQueue.has(hook)) {
      this.hookQueue.add(hook);
      window.requestAnimationFrame(() => {
        this.hookQueue.delete(hook);
        this.runHooks(hook, ...args);
      });
    }
  }

  runHooksParallel(hook, argArray, ...args) {
    let fns = this.hooks[hook] || [];
    for (let i = 0; i < fns.length; i++) {
      for (let j = 0; j < argArray.length; j++) {
        fns[i].fn(argArray[j], ...args);
      }
    }
  }

  runHook(hookObj, ...args) {
    hookObj.fn(...args);
  }

  runHookParallel(hookObj, argArray, ...args) {
    for (let i = 0; i < argArray.length; i++) {
      hookObj.fn(argArray[i], ...args);
    }
  }

  eachHook(hooks, fn) {
    hooks = hooks.length ? hooks : [hooks];
    let fns = [];
    for (let hook of hooks) {
      let fns = this.hooks[hook] || [];
      for (let i = 0; i < fns.length; i++) {
        fn(fns[i], hook);
      }
    }
  }

  toggleAltView(state=!this.altView) {
    this.altView = state;
    this.selectCell();
  }

  toggleMenu(state=!this.configMenu) {
    this.configMenu = state;
    this.buttons.toggleMenu.classList.toggle('active', state);
    this.menus.config.classList.toggle('hidden', !state);
    if (!state)
      this.altView = false;
  }

  toggleModal(modal) {
    let selected = this.modals[modal];
    let current = this.modal;
    Object.values(this.modals).forEach((e) => e.close());
    if (selected && current != selected) {
      this.toggleMenu(false);
      this.modals[modal].open();
      document.body.classList.add('modal-state');
    }
    else if (!selected) {
      this.fgCanvas.focus();
      document.body.classList.remove('modal-state');
    }
  }

  translateModal(coord) {
    if (!this.modalTranslate) {
      this.modalTranslate = coord;
    }
    else if (coord && this.modal) {
      let left = parseInt(this.modal.modal.style.left || 0);
      let top = parseInt(this.modal.modal.style.top || 0);
      this.modal.modal.style.left = `${left + coord[0] - this.modalTranslate[0]}px`;
      this.modal.modal.style.top = `${top + coord[1] - this.modalTranslate[1]}px`;
      this.modalTranslate = coord;
    }
    else {
      this.modalTranslate = null;
    }
  }

  showDoc() {
    window.open('doc/', '_blank');
  }

  toggleToolHidden() {
    let hidden = document.body.classList.toggle('tool-hidden');
    this.buttons.toolHider.classList.toggle('active');
    this.buttons.toolHider.classList.toggle('icon-eye');
    this.buttons.toolHider.classList.toggle('icon-eye-off');
    setTimeout(() => this.repositionElements(), 500);
  }

  setButtonTitle(button, title) {
    let cur = button.title.split(' ');
    cur[0] = title;
    button.title = cur.join(' ');
  }

  setCursorInfoInfo() {
    let cell = this.selected;
    let coord = cell && cell.coord.map((c) => (c > 0 ? '+' : '-') + ('0' + Math.abs(c)).slice(-2));
    this.setInfoBox('cursor', coord);
  }

  setToolInfo() {
    let info = this.action && this.action.info;
    this.setInfoBox('tool', info);
  }

  // Save/load

  saveSnapshot() {
    this.config.storeModel('snapshotModel', this.model.export());
    this.config.storeSessionState({snapshotSteps: this.config.steps});
    this.setMessage('Snapshot saved!');
  }

  loadSnapshot() {
    this.newHistoryState();
    let bytes = this.config.loadModel('snapshotModel');
    let steps = this.config.getSessionItem('snapshotSteps');
    if (bytes) {
      this.config.setSteps(steps);
      let cur = this.model.export();
      let diff = false;
      for (let i = 0; i < cur.length; i++)
        if (cur[i] != bytes[i]) {
          diff = true;
          break;
        }
      this.resetDrawStep();
      this.draw();
      if (diff) {
        this.model.import(bytes, this.config.importMask);
        this.storeModelState();
        this.setMessage('Snapshot loaded!');
      }
      else {
        this.setMessage('Snapshot already loaded!', 'warning');
      }
    }
    else {
      this.setMessage('No snapshot found!', 'warning');
    }
  }

  // Recording mode and capture

  startRecordingMode(user) {
    this.recordingModeUsers.add(user);
    this.recordingMode = true;
    this.draw();
  }

  endRecordingMode(user) {
    this.recordingModeUsers.delete(user);
    this.recordingMode = !!this.recordingModeUsers.size;
    this.draw();
  }

  toggleImageCapture() {
    if (!this.imageCapture) {
      this.imageCapture = [];
      this.startRecordingMode('imageCapture');
      this.draw();
      let fn = async (e) => {
        this.imageCapture.push([this.getImageFilename(), await this.getImage()]);
      };
      // This shocks the conscience
      this.imageCapture.handle = this.addHook('drawStep', fn);
      // Capture current state
      fn();
      this.buttons.toggleImageCapture.classList.add('active');
    }
    else {
      this.endRecordingMode('imageCapture');
      this.draw();
      this.removeHook(this.imageCapture.handle);
      this.processImageCaptures(this.imageCapture);
      this.imageCapture = null;

      this.buttons.toggleImageCapture.classList.remove('active');
    }
  }

  async processImageCaptures(captures) {
    if (captures.length < 0)
      return;
    let string2bytes = (str) => Uint8Array.from(str.split('').map((e) => e.charCodeAt(0)));
    let padString = (str, length) => (str + ' '.repeat(length)).slice(0, length);
    let segments = [string2bytes('!<arch>\n')];
    captures.forEach(([filename, dataUri]) => {
      // I have literally no idea what I'm doing
      let data = atob(dataUri.split(',')[1]);
      let length = data.length;
      if (data.length % 2 == 1) {
        data += '\n';
      }
      let bytes = Uint8Array.from(string2bytes(data));
      let header = padString(filename + '/', 16)
        + padString('0', 12)
        + padString('0', 6)
        + padString('0', 6)
        + padString('644', 8)
        + padString(bytes.length.toString(), 10)
        + '`\n';
      segments.push(string2bytes(header));
      segments.push(bytes);
    });
    let blob = new Blob(segments, {type: 'application/x-archive'});
    let dataUri = window.URL.createObjectURL(blob);
    this.promptDownload(this.config.defaultArchiveFilename, dataUri);
  }

  async getImage(type='url') {
    this.startRecordingMode('getImage');
    await this.draw();
    let transferCanvas = new TransferCanvas(this);
    this.endRecordingMode('getImage');
    await this.draw();
    let canvas = transferCanvas.canvas;
    let format = `image/${this.config.imageFormat}`;
    let quality = this.config.imageQuality;
    if (type == 'url') {
      return canvas.toDataURL(format, quality);
    }
    else if (type == 'blob') {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob, format, quality) => {
          resolve(blob);
        })
      });
    }
  }

  async promptSaveImage() {
    let dataUri = await this.getImage();
    this.promptDownload(this.getImageFilename(), dataUri);
  }

  parseTemplate(str, pairs={}) {
    Object.entries(pairs).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v);
    });
    return str;
  }

  padNum(n, pad) {
    return ('0'.repeat(pad) + n).slice(-pad);
  }

  getImageFilename() {
    let padStep = this.padNum(this.config.steps, this.config.padStepDigits);
    if (this.config.drawStepInterval > 1) {
      padStep += '-' + this.padNum(this.drawStep, this.config.padDrawStepDigits);
    }
    return this.parseTemplate(
      this.config.defaultImageFilenameTemplate,
      {steps: padStep, format: this.config.imageFormat}
    );
  }

  save() {
    let bytes = this.model.export();
    let blob = new Blob([bytes], {type: 'application/octet-stream'});
    let dataUri = window.URL.createObjectURL(blob);
    let filename = this.parseTemplate(
      this.config.defaultModelFilenameTemplate,
      {steps: this.padNum(this.config.steps, this.config.padStepDigits)}
    )
    this.promptDownload(filename, dataUri);
  }

  load() {
    let Class = window[this.config.arrayType];
    this.newHistoryState();
    let fileLoader = new FileLoader('.bin', {reader: 'readAsArrayBuffer'});
    fileLoader.onload = (result) => {
      let bytes = new Class(result);
      this.model.import(bytes, this.config.importMask);
      this.draw();
      this.storeModelState();
      this.setMessage('Model loaded!');
    };
    fileLoader.prompt();
  }

  saveData() {
    this.config.storeLocalConfig();
    this.config.storeSessionConfig();
    let obj = this.config.retrieveConfig();
    let dataUri = `data:application/json,${encodeURIComponent(JSON.stringify(obj, null, 2))}`;
    this.promptDownload(this.config.defaultSettingsFilename, dataUri);
  }

  loadData() {
    let fileLoader = new FileLoader('.json');
    fileLoader.onload = (result) => {
      try {
        let config = JSON.parse(result);
        this.config.restoreState(config);
        this.config.restorePlugins();
        this.config.storeLocalConfig();
        this.config.storeSessionConfig();
        Board.resize();
        this.setMessage('Settings restored!');
      }
      catch (e) {
        this.setMessage('Unable to parse settings file!', 'error');
        console.error(e);
      }
    };
    fileLoader.prompt();
  }

  import() {
    let fileLoader = new FileLoader('.js,.jpg,.jpeg,.gif,.png,.svg,.bmp', {multiple: true});
    fileLoader.onload = (result, name, type) => {
      try {
        if (type == 'text/javascript') {
          eval(result) // lol
          this.modals.config.update();
          this.setMessage('Custom code imorted!');
        }
        else { // Assume is image
          name = name.replace(/\.\w+/, '').replace(/\W+/g, '_').replace(/_+/, '_').replace(/^_?(.*?)_?$/, '$1');
          let media = new Media(name, result, type);
          let image = Media.getImage(name, (err) => {
            // This is offensive
            if (err) {
              this.setMessage(`Error loading image "${name}"!`, 'error');
              console.error(err);
            }
            else {
              this.setMessage(`Image "${name}" loaded!`);
            }
          });
        }
      }
      catch (e) {
        this.setMessage(e.toString(), 'error');
        console.error(e);
      }
    };
    // fileLoader.filter = (files) => {
    //   let result = files.map((file) => file.type.indexOf('javascript') >= 0);
    //   result.some((e) => !e) && this.setMessage('Not all selected files are JavaScript files', 'error');
    //   return result;
    // };
    fileLoader.prompt();
  }

  promptDownload(filename, dataUri) {
    let a = document.createElement('a');
    a.href = dataUri;
    a.download = filename;
    a.click();
  }

 // Undo/redo stuff

  newHistoryState() {
    if (this.config.undoStackSize) {
      let state = this.model.export();
      state.steps = this.config.steps;
      this.undoStack.push(state);
      if (this.undoStack.length > this.config.undoStackSize)
        this.undoStack.shift();
    }
    this.redoStack = [];
    this.refreshHistoryButtons();
  }

  storeModelState(bytes) {
    bytes = bytes || this.model.export();
    this.config.storeModel('modelState', bytes);
  }

  undo(discard=false) {
    if (this.recorder) return;
    let nextState = this.undoStack.pop();
    if (nextState) {
      let curState = this.model.export()
      curState.steps = this.config.steps;
      this.model.import(nextState);
      this.storeModelState(nextState);
      this.config.setSteps(nextState.steps);
      if (!discard)
        this.redoStack.push(curState);
      this.draw();
      this.resetDrawStep();
      this.refreshHistoryButtons();
    }
  }

  redo(discard=false) {
    if (this.recorder) return;
    let nextState = this.redoStack.pop();
    if (nextState) {
      let curState = this.model.export()
      curState.steps = this.config.steps;
      this.model.import(nextState);
      this.storeModelState(nextState);
      this.config.setSteps(nextState.steps);
      if (!discard)
        this.undoStack.push(curState);
      this.draw();
      this.resetDrawStep();
      this.refreshHistoryButtons();
    }
  }

  resetDrawStep() {
    this.drawStep = 0;
    this.drawStepQ = 0;
    this.drawStepQInc = 0;
  }

  resetTransform() {
    this.repositionElements();

    // Canvas stuff
    let logicalWidth = this.config.logicalWidth;
    let logicalHeight = this.config.logicalHeight;
    this.canvasWidth = window.innerWidth * this.config.pixelScaleFactor;
    this.canvasHeight = window.innerHeight * this.config.pixelScaleFactor;
    this.translateX = 0;
    this.translateY = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1
    this.eachContext((ctx) => {
      let gco = ctx.globalCompositeOperation;
      ctx.canvas.width = this.canvasWidth;
      ctx.canvas.height = this.canvasHeight;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = gco;
    });
    this.scaleTo(this.config.zoom);
    // Resize
    let [oldX, oldY] = [this.scaleX, this.scaleY];
    this.scaleX = this.canvasWidth / window.innerWidth;
    this.scaleY = this.canvasHeight / window.innerHeight;
    let [scaleX, scaleY] = [this.scaleX / oldX, this.scaleY / oldY];
    this.eachContext((ctx) => {
      ctx.scale(scaleX, scaleY);
    });
    // Translate to center
    this.translate([this.canvasWidth / this.scaleX / 2, this.canvasHeight / this.scaleY / 2]);
    this.draw();
    this.clearFg();
    this.runHooks('center');
  }

  repositionElements() {
    // Config menu
    let x, y, height;
    ({x, y, height} = this.buttons.toggleMenu.getBoundingClientRect());
    this.menus.config.style.top = `${y + height}px`;
    this.menus.config.style.left = `${x}px`;
    // Message box
    ({y, height} = this.menus.top.getBoundingClientRect());
    this.messageWrapper.style.top = `calc(${y + height}px + 1rem)`;
  }

  refreshHistoryButtons() {
    this.buttons.undo.disabled = +!this.undoStack.length || this.recorder;
    this.buttons.redo.disabled = +!this.redoStack.length;
  }

  scaleRelative(scale) {
    this.scale *= scale;
    this.eachContext((ctx) => {
      ctx.scale(scale, scale);
    });
    this.draw();
    this.drawFg();
  }

  scaleTo(target, interval=0, step=50, timingFn) {
    if (this.scaling) {
      this.scaleQueue.push([target, interval, step, timingFn]);
      return;
    } else if (!interval) {
      this.scaleRelative(target / this.scale);
      return;
    }
    this.scaling = true;
    let diff = target - this.scale;
    let numSteps = Math.ceil(interval / step);
    timingFn = timingFn || this.defaultTimingFn;
    let steps = Array(numSteps).fill(null).map((_, idx) => timingFn(idx, numSteps));
    steps = steps.map((e, i) => (steps[i + 1] || 1) - e);
    let fn = (increment) => {
      if (steps.length) {
        let stepTarget = this.scale + diff * increment;
        this.scaleRelative(stepTarget / this.scale);
        setTimeout(() => fn(steps.pop()), step);
      }
      else {
        this.scaleRelative(target / this.scale);
        this.scaling = false;
        if (this.scaleQueue.length) {
          this.scaleTo(...this.scaleQueue.shift());
        }
      }
    };
    setTimeout(() => fn(steps.pop()), step);
  }

  setInfoBox(boxName, value) {
    value = value != null ? value.toString() : '';
    let box = this.infoBoxes[boxName];
    let lastValue = box.innerHTML;
    box.innerHTML = value;
    if (lastValue == '' && value != '')
      box.classList.add('active');
    else if (lastValue != '' && value == '')
      box.classList.remove('active');
  }

  translate([x, y]) {
    this.translateX += x;
    this.translateY += y;
    x /= this.scale;
    y /= this.scale;
    this.eachContext((ctx) => {
      ctx.translate(x, y);
    });
    this.draw();
  }

  updateColorButtons() {
    this.colorButtons = [];
    for (let i = 0; i < this.allColorButtons.length; i++) {
      let colorButton = this.allColorButtons[i];
      if (i < this.config.maxNumStates) {
        this.colorButtons.push(colorButton);
        colorButton.classList.remove('hidden');
      }
      else {
        colorButton.classList.add('hidden');
      }
    }
  }

  // Page/canvas listeners

  handleClearStorage() {
    let msg = 'Clear all data, including rules, presets, and themes, or only session data from the current tab?'
    this.modals.confirm.ask(msg, {'Cancel': 0, 'Session data': 1, 'All data': 2})
    .then((e) => {
      if (e) {
        this.config.clearStorage(!!e, e == 2);
        Board.resize();
        Board.instance.setMessage(`${e == 2 ? 'Local' : 'Session'} settings cleared!`);
      }
    }).catch((e) => { throw e; });
  }

  handleSetColor(ev, color) {
    if (ev.buttons & 1)
      this.config.setPaintColor(0, color);
    if (ev.buttons & 2)
      this.config.setPaintColor(1, color);
  }

  handleBlur(ev) {
    setTimeout(() => {
      this.shift = false;
      this.config.blurTool && this.config.setTool(this.config.blurTool);
      this.altView && this.toggleAltView();
    });
  }

  handleWheel(ev) {
    let textTags = ['textarea', 'input'];
    let focus = document.activeElement;
    if (focus && textTags.indexOf(focus.tagName.toLowerCase()) != -1) {
      if (focus.type =='range' && focus == ev.target) {
        let min = focus.min || -Infinity;
        let max = focus.max || Infinity;
        let step = focus.step || 1;
        let dir = -Math.sign(ev.deltaY);
        focus.value = Math.max(min, Math.min(max, parseFloat(focus.value) + step * dir));
        focus.dispatchEvent(new Event('input'));
      }
    }
    else if (ev.target == this.fgCanvas && !this.config.locked) {
      let scale = 1 - Math.sign(ev.deltaY) * 0.1;
      this.scaleRelative(scale);
      this.draw();
    }
  }

  handleContextmenu(ev) {
    if (ev.target == this.fgCanvas || this.colorButtons.includes(ev.target))
      ev.preventDefault();
  }

  handleKey(ev) {
    let key = ev.key.toLowerCase();

    // Modal-specific stuff
    if (this.modal && ev.type == 'keydown') {
      let isInput = ['TEXTAREA', 'INPUT'].includes(ev.target.tagName);
      if (ev.key == 'Escape') {
        this.toggleModal();
        ev.preventDefault();
        return;
      }
      else if (!ev.repeat && ev.ctrlKey) {
        if (key == 'a') {
          if (isInput) {
            return;
          }
          else {
            if (this.modal == this.modals.config) {
              this.modals.config._handleCheckAll();
            }
            else if (this.modal == this.modals.srb || this.modal == this.modals.trb) {
              this.modals.srb._handleCheckAll();
            }
            else if (this.modal == this.modals.custom && document.activeElement == this.modals.custom.input) {
              this.modals.custom.input.select();
            }
          }
        }
      }
      let ctrlSkip = ['c', 'x', 'v', 'z'].includes(key);
      if (ctrlSkip || !ev.ctrlKey && isInput) {
        return;
      }
    }

    // Board things
    if (ev.key == 'Alt' || ev.key == 'Meta') {
      if (ev.type == 'keydown') {
        this.toggleAltView(true);
      }
      else if (ev.type == 'keyup') {
        this.toggleAltView(false);
      }
    }
    if (ev.key == 'Shift') {
      this.config.shift = ev.type == 'keydown';
      this.config.setTool();
      return;
    }
    else if (ev.type == 'keyup') {
      return;
    }
    else if (ev.type == 'keydown' && !ev.repeat) {
      if (ev.ctrlKey) {
        if (key == 'z') {
          if (ev.shiftKey) {
            this.redo();
          }
          else {
            this.undo();
          }
        }
        else if (!ev.shiftKey && !ev.altKey) {
          if (key == 's') {
            this.save();
          }
          else if (key == 'o') {
            this.load();
          }
          else if (key == 'b') {
            this.toggleModal('srb');
          }
          else if (key == 'c') {
            this.clear();
          }
          else if (key == 'd') {
            this.toggleModal('draw');
          }
          else if (key == 'e') {
            this.toggleModal('theme');
          }
          else if (key == 'f') {
            this.toggleModal('custom');
          }
          else if (key == 'i') {
            this.toggleImageCapture();
          }
          else if (key == 'g') {
            this.toggleModal('config');
          }
          else if (key == 'h') {
            this.toggleModal('trb');
          }
          else if (key == 'l') {
            this.config.setLock();
          }
          else if (key == 'r') {
            this.toggleModal('resize');
          }
          else if (key == 'y') {
            this.toggleModal('plugin');
          }
          else if (key == 'x') {
            this.handleClearStorage();
          }
          else if (key == 'a') {
            // preventDefault
          }
          else {
            return;
          }
        }
        else if (ev.shiftKey) {
          if (key == 's') {
            this.promptSaveImage();
          }
          else {
            return;
          }
        }
        else if (ev.altKey) {
          if (key == 'c') {
            // Secret shortcut
            this.clear();
            this.autodot();
          }
          if (key == 's') {
            this.saveData();
          }
          else if (key == 'o') {
            this.loadData();
          }
          else {
            return;
          }
        }
        else {
          return;
        }
      }
      // ESC to hide/show controls
      else if (ev.key == 'Escape') {
        this.toggleToolHidden();
        this.toggleMenu(false);
      }

      // TAB to start/stop
      else if (ev.key == 'Tab' && !this.modal) {
        if (ev.shiftKey) {
          this.toggleRecord();
        }
        else {
          this.togglePlay();
        }
      }

      // SPACE to step or stop
      else if (ev.key == ' ') {
        if (this.running) {
          this.togglePlay();
        }
        else {
          this.step();
        }
      }
      // F1 to show documentation
      else if (ev.key == 'F1' || ev.key == '?') {
        this.showDoc();
      }
      // Tool and lesser keys
      else if (key == 'g') {
        this.config.setTool('fill');
      }
      else if (key == 'b') {
        this.config.setTool('brush');
      }
      else if (key == 'f') {
        this.config.setTool('hexfilled');
      }
      else if (key == 'h') {
        this.config.setTool('hexoutline');
      }
      else if (key == 'l') {
        this.config.setTool('line');
      }
      else if (key == '/') {
        this.config.setTool('lockline');
      }
      else if (key == 'm') {
        this.config.setTool('move');
      }
      else if (key == 'n') {
        this.config.setTool('none');
      }
      else if (key == '1') {
        this.config.setToolSize(1);
      }
      else if (key == '2') {
        this.config.setToolSize(2);
      }
      else if (key == '3') {
        this.config.setToolSize(3);
      }
      else if (key == 'r') {
        this.resetTransform();
      }
      else if (key == 'c') {
        this.config.setPaintColorMode();
      }
      else if (key == 'q') {
        this.saveSnapshot();
      }
      else if (key == 'a') {
        this.loadSnapshot();
      }
      else if (ev.shiftKey && this.config.colorMode && ev.key == 'ArrowUp') {
        let newColor = Hexular.math.mod(this.config.paintColors[1] - 1, this.colorButtons.length);
        this.config.setPaintColor(1, newColor);
      }
      else if (ev.shiftKey && this.config.colorMode && ev.key == 'ArrowDown') {
        let newColor = Hexular.math.mod(this.config.paintColors[1] + 1, this.colorButtons.length);
        this.config.setPaintColor(1, newColor);
      }
      else if (this.config.colorMode && ev.key == 'ArrowUp') {
        let newColor = Hexular.math.mod(this.config.paintColors[0] - 1, this.colorButtons.length);
        this.config.setPaintColor(0, newColor);
      }
      else if (this.config.colorMode && ev.key == 'ArrowDown') {
        let newColor = Hexular.math.mod(this.config.paintColors[0] + 1, this.colorButtons.length);
        this.config.setPaintColor(0, newColor);
      }
      else {
        return;
      }
    }
    ev.preventDefault();
  }

  handleMouse(ev) {
    if (ev.type == 'mousedown') {
      // Close config menu if applicable;
      if (this.configMenu) {
        let target =  ev.target;
        while (target != this.buttons.toggleMenu && target.parentNode && (target = target.parentNode));
        if (target != this.buttons.toggleMenu) {
          this.toggleMenu(false);
        }
      }
      if (this.altView) {
        this.toggleAltView(false);
      }
      if (ev.target == this.fgCanvas) {
        if (this.modal) {
          this.toggleModal();
        }
        if (this.selected && !this.action) {
          if (ev.buttons & 1) {
            this.startAction(ev);
          }
          else if (ev.buttons & 2) {
            let setState = this.config.getPaintColor(1);
            this.startAction(ev, {setState});
          }
          else if ((ev.buttons & 4) && this.selected) {
            this.debugSelect();
          }
        }
      }
      this.clickTarget = ev.target;
    }
    else if (ev.type == 'mouseup') {
      if (this.action)
        this.endAction(ev);
      else if (this.modalTranslate) {
        this.translateModal();
      }
      else if (this.clickTarget == ev.target) {
        if (ev.target == this.message) {
          this.clearMessage()
        }
        this.clickTarget = null;
      }
    }
    else if (ev.type == 'mousemove') {
      let cell;
      if (ev.target == this.fgCanvas && !this.modal) {
        this.selectCell([ev.pageX, ev.pageY]);
        this.moveAction(ev);
      }
      else if (this.modalTranslate) {
        this.translateModal([ev.pageX, ev.pageY]);
      }
      else {
        this.selectCell();
      }
      if (ev.target != this.info) {
        this.setCursorInfoInfo();
      }
    }
    else if (ev.type == 'mouseout') {
      this.selectCell();
    }
  }

  handleTouch(ev) {
    // Close config menu if applicable;
    if (this.configMenu && ev.target != this.buttons.toggleMenu) {
      setTimeout(() => this.toggleMenu(false), 500);
    }

    if (ev.target == this.fgCanvas) {
      if (this.modal) {
        this.toggleModal();
      }
      if (ev.touches.length == 1) {
        let [x, y] = [ev.touches[0].pageX, ev.touches[0].pageY];
        if (ev.type == 'touchstart') {
          this.selectCell([x, y]);
          this.startAction(ev);
        }
        if (ev.type == 'touchmove') {
          this.selectCell([x, y]);
          this.moveAction(ev);
        }
        ev.preventDefault();
      }
      else if (ev.touches.length == 2) {
        if (ev.type == 'touchstart') {
          this.config.setTool('pinch', this.config.tool);
          this.startAction(ev);
          this.config.setTool();
        }
        if (ev.type == 'touchmove') {
          this.moveAction(ev);
        }
      }
      if (ev.type == 'touchend') {
        this.endAction(ev);
        this.selectCell();
      }
    }
  }

  startAction(ev, ...args) {
    if (this.config.locked)
      return;
    let ctrl = ev.ctrlKey;
    let shift = ev.shiftKey;
    let Class = this.toolClasses[this.config.tool];
    this.action = new Class(this, {ctrl, shift}, ...args);
    this.action.start(ev);
    this.setToolInfo();
  }

  moveAction(ev) {
    if (this.action) {
      this.action.move(ev);
      this.setToolInfo();
    }
  }

  endAction(ev) {
    this.action && this.action.end(ev);
    this.action = null;
    this.setToolInfo();
  }

  autodot() {
    let oldSelected = this.selected;
    this.selected = this.model.cells[0];
    let action = new BrushAction(this);
    action.start();
    action.end();
    this.selected = oldSelected;
  }

  // Cell selection and setting

  selectCell(coord) {
    let lastCell = this.selected;
    this.selected = coord && this.cellAt(coord);
    this.drawFg();
    if (lastCell != this.selected)
      this.runHooks('select', this.selected);
  }

  drawFg() {
    let cell = this.selected;
    if (!this.action) {
      this.clearFg();
      if (this.altView) {
        this.fgAdapter.drawBackground();
        this.fgAdapter.drawDefaultCells();
      }
      else if (cell) {
        let color = this.config.selectColor;
        let width = this.config.selectWidth;
        width = (width + width / this.scale) / 2;
        let size = this.sizableTools.includes(this.config.tool) ? this.config.toolSize : 1;
        let opts = {stroke: true, lineWidth: width, strokeStyle: color};
        let radius = this.config.cellRadius;
        if (size == 1) {
          opts.type = Hexular.enums.TYPE_POINTY;
        }
        else {
          opts.type = Hexular.enums.TYPE_FLAT;
          radius = radius * (size * 2 - 1) * Hexular.math.apothem;
        }
        this.fgAdapter.drawShape(cell, radius, opts);
      }
    }
  }

  cellAt([x, y]) {
    [x, y] = this.windowToModel([x, y]);
    return this.model.cellAt([x, y]);
  }

  debugSelect() {
    let cell = this.selected;
      this.debugSelected = window.cell = cell;
    if (cell) {
      this.setMessage(`Cell at ${cell}: ${cell.state}`);
      this.runHooks('debugSelect', cell);
    }
  }

  // TODO: Use Hexular.math.matrixMult
  windowToModel([x, y]) {
    x -= this.translateX;
    y -= this.translateY;
    x -= this.offsetX;
    x -= this.offsetY;
    x = x / this.scale;
    y = y / this.scale;
    return [x, y];
  }

  modelToWindow([x, y]) {
    x = x * this.scale;
    y = y * this.scale;
    x += this.offsetX;
    y += this.offsetY;
    x += this.translateX;
    y += this.translateY;
    return [x, y];
  }

  defaultTimingFn(i, n) {
    let t = i / n;
    let s = t * t;
    return s / (2 * (s - t) + 1);
  }

  // Alert messages

  setMessage(message, className) {
    let idx = ++this.msgIdx;
    className = className || 'alert';
    this.message.classList = 'message active ' + className;
    this.message.innerHTML = message;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      if (this.msgIdx == idx)
        this.clearMessage();
    }, 4000);
  }

  clearMessage() {
    this.message.className = 'message';
    requestAnimationFrame(() => this.message.innerHTML = '');
    clearTimeout(this.messageTimer);
  }
}
Board.availablePlugins = {};
Board.constants = {};

/**
 * A class of immutable RGBA vector colors mapped to and from canvas/CSS hex formats
 *
 * HSL/RGB conversion functionality more or less taken from:
 * https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
 */
const Color = (() => {
  const MAX_QUEUE_LENGTH = 2 ** 20;
  const hexmap = new Map();

  function _Color(...args) {
    let hex;
    let match;
    let arg = args[0]
    if (arg == null) {
      return _Color.t;
    }
    else if (typeof arg == 'string') {
      arg = arg.trim();
      if (arg[0] == '#') {
        if (arg.length == 9) {
          hex = arg;
        }
        else if (arg.length == 7) {
          hex = arg + 'ff';
        }
        else if (arg.length == 5) {
          hex = `#${arg[1]}${arg[1]}${arg[2]}${arg[2]}${arg[3]}${arg[3]}${arg[4]}${arg[4]}`;
        }
        else if (arg.length == 4) {
          hex = `#${arg[1]}${arg[1]}${arg[2]}${arg[2]}${arg[3]}${arg[3]}ff`;
        }
      }
      else if (arg == 'transparent') {
        return _Color.t;
      }
      else if (arg == 'white') {
        return _Color.white;
      }
      else if (arg == 'black') {
        return _Color.black;
      }
      else if (match = arg.match(/hsl\((.+?)\)/)) {
        let [h, s, l] = match[1].split(',').map((e) => parseFloat(e.trim().replace('%', '')));
        return _Color(hslaToRgba(h, s / 100, l / 100));
      }
    }
    else if (arg instanceof Color) {
      let cur = hexmap.get(arg);
      return arg || hexmap.set(arg.hex, arg).get(arg.hex);
    }
    else if (arg.length) {
      if (arg.length < 4) {
        return _Color(normalize(arg));
      }
      else {
        return _Color(vec2Hex(arg));
      }
    }
    else if (typeof arg == 'number') {
      return _Color(args);
    }
    if (!hex)
      throw new Hexular.HexError(`Can't parse color ${arg} lol`);
    color = hexmap.get(hex);
    return color || new Color(hex);
  }

  class Color extends Array {
    constructor(hex) {
      super(4);
      this.hex = hex;
      this[0] = parseInt(hex.slice(1, 3), 16);
      this[1] = parseInt(hex.slice(3, 5), 16);
      this[2] = parseInt(hex.slice(5, 7), 16);
      this[3] = parseInt(hex.slice(7, 9), 16);
      hexmap.set(hex, this);
    }

    toString() {
      return this.hex;
    }

    blend(other=_Color.t, q=0.5) {
      if (other[3] == 0)
        return _Color.t.blend(this, (1 - q));
      let vector = [0, 0, 0, 0];
      for (let i = 0; i < 4; i++)
        vector[i] = Math.round(this[i] * q + other[i] * (1 - q));
      return _Color(vector);
    }

    get fg() {
      let total = (this[0] + this[1] + this[2]) / 765;
      let alpha = this[3] / 255;
      return total > 0.5 || alpha < 0.25 ? _Color('#333333') : _Color('#ffffff');
    }
  }

  class ColorT extends Color {
    constructor() {
      super('#00000000');
      hexmap.delete(this.hex); // ew
    }

    blend(other, q=0.5) {
      return _Color([other[0], other[1], other[2], Math.round(other[3] * (1 - q))]);
    }
  }

  _Color.blend = (...colors) => {
    let vec = [0, 0, 0, 0];
    let tCount = 0;
    for (let i = 0; i < colors.length; i++) {
      let color = colors[i];
      if (!color || color[3] == 0) {
        tCount++;
      }
      else {
        vec[0] += color[0] / colors.length;
        vec[1] += color[1] / colors.length;
        vec[2] += color[2] / colors.length;
        vec[3] += color[3] / colors.length;
      }
    }
    if (tCount == colors.length)
      return _Color.t;
    let q = colors.length / (colors.length - tCount);
    vec[0] = Math.round(vec[0] * q);
    vec[1] = Math.round(vec[1] * q);
    vec[2] = Math.round(vec[2] * q);
    vec[3] = Math.round(vec[3]);
    return _Color(vec.map((e) => Math.round(e)));;
  };

  _Color.eq = (c0, c1) => {
    if (c0 == c1)
      return true;
    else if (!c0 || !c1) {
      return false;
    }
    let s0 = c0.toString(), s1 = c1.toString();
    if (s0 == s1)
      return true;
    else if (s0.slice(0, 7) == s1.slice(0, 7) && (s0.length == 7 || s1.length == 7))
      return true;
    else if (_Color(c0) == _Color(c1))
      return true;
    return false;
  }

  _Color.clear = () => {
    hexmap.clear();
    hexmap.set(_Color.t.hex, _Color.t);
    hexmap.set(_Color.black.hex, _Color.black);
    hexmap.set(_Color.white.hex, _Color.white);
  };

  _Color.Color = Color;
  _Color.hexmap = hexmap;
  _Color.t = new ColorT();
  _Color.black = _Color('#000000ff');
  _Color.white = _Color('#ffffffff');

  _Color.from = (args) => args.map((e) => _Color(e));

  let vec2Hex = (vec) => `#${vec.map((e) => ('0' + e.toString(16)).slice(-2)).join('')}`;

  let normalize = (vec) => {
    if (vec.length == 4)
      return vec;
    else if (vec.length == 3)
      return vec.concat([255]);
    else if (vec.length == 2)
      return Array(3).fill(vec[0]).concat([vec[1]]);
    else if (vec.length == 1)
      return Array(3).fill(vec[0]).concat([255]);
  };

  let hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let hslaToRgba = _Color.hslaToRgba = (h, s, l, a=1) => {
    h /= 360;
    let r, g, b;

    if (s == 0){
      r = g = b = l;
    }
    else {
      let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      let p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    r = Math.round(r * 255);
    g = Math.round(g * 255);
    b = Math.round(b * 255);
    a = Math.round(a * 255);
    return [r, g, b, a];
  };

  return _Color;
})();

class Config {
  static get defaults() {
    return {
      preset: 'default',
      theme: 'light',
      meta: {},
      media: {},
      order: 60,
      cellRadius: 10,
      zoom: 1,
      numStates: 12,
      maxNumStates: 12,
      groundState: 0,
      defaultRule: 'identityRule',
      nh: 6,
      filters: {
        binaryFilter: false,
        deltaFilter: false,
        clipBottomFilter: false,
        clipTopFilter: false,
        modFilter: false,
        edgeFilter: false,
      },
      undoStackSize: 128,
      mobileOrder: 30,
      mobileZoom: 1.5,
      mobileUndoStackSize: 64,
      interval: 125,
      autopause: true,
      theme: 'default',
      colors: [
        'transparent',
        '#ccccbb',
        '#99998f',
        '#666655',
        '#33332f',
        '#cc4444',
        '#ee7722',
        '#eebb33',
        '#66bb33',
        '#66aaaa',
        '#4455bb',
        '#aa55bb',
      ],
      fillColors: Array(256).fill(),
      strokeColors: Array(256).fill(),
      colorMapping: {
        fill: true,
        stroke: true,
      },
      defaultColor: '#ccccff',
      backgroundColor: '#f8f8f8',
      modelBackgroundColor: '#ffffff',
      defaultColor: '#77f0f0',
      selectWidth: 2,
      selectColor: '#ffbb33',
      cellGap: 1,
      cellBorderWidth: 1,
      rules: Array(this.maxNumStates).fill(this.defaultRule),
      plugins: [],
      arrayType: 'Uint8Array',
      imageFormat: 'png',
      imageQuality: 1,
      padStepDigits: 4,
      padDrawStepDigits: 2,
      defaultImageFilenameTemplate: 'hex-{steps}.{format}',
      defaultModelFilenameTemplate: 'hex-{steps}.bin',
      defaultArchiveFilename: 'hexular.ar',
      defaultSettingsFilename: 'hexular.json',
      defaultVideoFilename: 'hexular.webm',
      videoMimeType: 'video/webm',
      videoCodec: 'vp9',
      videoFrameRate: 60,
      videoBitsPerSecond: 2 ** 28,
      scaleFactor: 1,
      pixelScaleFactor: 1,
      tool: 'brush',
      shiftTool: 'move',
      blurTool: null,
      locked: false,
      lockedTool: null,
      toolSize: 1,
      colorMode: 0,
      paintColors: [1, 0],
      importMask: [],
      customPaintMap: null,
      steps: 0,
      drawDefaultQ: 1,
      clearOnDraw: true,
      drawStepInterval: 1,
      fadeIndex: 0,
      drawModelBackground: true,
      alpha: 1,
      blendMode: 'source-over',
      defaultCap: 'butt', // lol
      defaultJoin: 'miter',
      rbName: 'newSimpleRule',
      rbMiss: 0,
      rbMatch: 1,
      rbMissRel: 0,
      rbMatchRel: 0,
      rbRel: 0,
      rbStates: Array(64).fill(false),
      snippetFields: {
        name: null,
        text: '',
      },
      trb: {
        ruleName: 'newTemplateRule',
        selectedName: '',
        selectedRuleDef: [],
        selectedControlIdx: -1,
        templateDefs: [],
        templateDef: Hexular.util.templateRuleBuilder().defs[0],
      },
      drawFunctions: {
        sortCellsAsc: false,
        sortCellsDesc: false,
        drawFilledPointyHex: true,
        drawOutlinePointyHex: false,
        drawFilledFlatHex: false,
        drawOutlineFlatHex: false,
        drawFilledCircle: false,
        drawOutlineCircle: false,
      },
      radioGroups: {
        draw: [
          [
            'sortCellsAsc',
            'sortCellsDesc',
          ],
          [
            'drawFilledPointyHex',
            'drawOutlinePointyHex',
            'drawFilledFlatHex',
            'drawOutlineFlatHex',
            'drawFilledCircle',
            'drawOutlineCircle',
          ]
        ],
      },
      radioMap: {},
      localStorageObj: window.localStorage,
      sessionStorageObj: window.sessionStorage,
    };
  }

  static toObject(kvArray) {
    let obj = {};
    for (let [key, value] of kvArray)
      obj[key] = value;
    return obj;
  }

  constructor(board, ...args) {
    // We load these after Config.defaults b/c it needs to be available for populating themes &c.
    let library = {
      availableRules: Hexular.util.merge({}, Rules),
      presets: Hexular.util.merge({}, Presets),
      snippets: Hexular.util.merge({}, Examples.snippets),
      themes: Hexular.util.merge(Themes),
    };
    this.board = board;
    Hexular.util.merge(this, Config.defaults, library);
    this.colors = Color.from(this.colors);
    // Let us infer if this is a mobile browser and make some tweaks
    if (window.devicePixelRatio > 1 && screen.width < 640) {
      this.mobile = true;
      this.order = Config.defaults.mobileOrder;
      this.zoom = Config.defaults.mobileZoom;
      this.undoStackSize = Config.defaults.mobileUndoStackSize;
    }

    // Restore state from local/session storage
    this.restoreState();

    // Finally, merge in URL parameter and constructor args
    Hexular.util.merge(this, new OptParser(this), ...args);

    // Set logical size for all canvases
    let width = (this.order + 1) * this.cellRadius * Hexular.math.apothem * 4;
    let height = (this.order + 1) * this.cellRadius * 3;
    this.logicalWidth = width;
    this.logicalHeight = height;

    this.mobile && document.body.classList.add('mobile');
  }

  initialize() {
    try {
      this.model = this.board.model;
      this.bgAdapter = this.board.bgAdapter;
      this.adapter = this.board.adapter;
      this.fgAdapter = this.board.fgAdapter;
      this.configModal = this.board.modals.config;
      this.themeModal = this.board.modals.theme;
      this.drawModal = this.board.modals.draw;
      this.srbModal = this.board.modals.srb;
      this.trbModal = this.board.modals.trb;
      this.pluginModal = this.board.modals.plugin;
      this.customModal = this.board.modals.custom;
      this.configModal.update();
      this.updateMathPresets();

      // Drawing config initialization
      this.adapterFunctions = {
          sortCellsAsc: () => this.model.sortCells((a, b) => a.state - b.state),
          sortCellsDesc: () => this.model.sortCells((a, b) => b.state - a.state),
        };
      let cellCallbacks = [
          'drawFilledPointyHex',
          'drawOutlinePointyHex',
          'drawFilledFlatHex',
          'drawOutlineFlatHex',
          'drawFilledCircle',
          'drawOutlineCircle',
      ];
      for (let cb of cellCallbacks) {
        this.adapterFunctions[cb] = (...args) => {
          this.model.eachCell((cell) => {
            this.adapter[cb](cell);
          });
        }
      }
      let drawCb = (active, alts) => {
        for (let alt of alts) {
          this.drawModal.drawButtons[alt].classList.remove('active');
          this.drawFunctions[alt] = false;
        }
        if (active) {
          this.drawFunctions[active] = true;
          this.drawModal.drawButtons[active].classList.add('active');
        }
        return this.adapterFunctions[active];
      };
      for (let hook of Object.keys(this.radioGroups)) {
        for (let group of this.radioGroups[hook]) {
          let radioGroup = new RadioGroup(group, drawCb);
          for (let key of group)
            this.radioMap[key] = radioGroup;
          this.board.addHook(hook, radioGroup.fn);
        }
      }
      this.setOnDraw();
      this.setMaxNumStates();

      // Board
      this.setTheme(this.theme);
      if (!this.theme)
        this.setThemable();
      this.setPaintColor(0, this.paintColors[0]);
      this.setPaintColor(1, this.mobile ? -1 : this.paintColors[1]);
      this.setPaintColorMode(this.colorMode);
      this._setTool(this.tool);
      this.setToolSize(this.toolSize);
      this.setSteps(this.steps);
      this.setScaleFactor(this.scaleFactor);
      this.setZoom(this.zoom);
      this.setLock(this.locked);

      // Config modal
      this.setPreset(this.preset);
      if (!this.preset) {
        this.setNh(this.nh);
        this.setNumStates(this.numStates);
        this.setRules();
        this.setFilters();
      }

      // Rule builder modals
      this.srbModal.ruleName.value = this.rbName || Config.defaults.rbName;
      this.setRbMiss([this.rbMiss, this.rbMissRel]);
      this.setRbMatch([this.rbMatch, this.rbMatchRel]);
      this.srbModal.stateElements.forEach((e, i) => {
        this.rbStates[i] && e.classList.add('active');
      });
      this.srbModal.updateRuleString();
      this.srbModal.update();

      this.trbModal.update();
      this.trbModal.reset();

      // Draw modal
      this.drawModal.reset();

      // Theme modal
      this.themeModal.update();
      this.themeModal.reset();

      // Plugins
      this.pluginModal.update();

      // Custom code modal
      this.customModal.update();

      // Restore plugins
      this.restorePlugins();
    }
    catch (error) {
      console.error(error);
      if (!this.error) {
        this.localStorageObj.clear();
        Board.resize({error});
      }
      else {
        console.error('If error persists, try clearing local storage.');
      }
    }
  }

  // --- ADDERS, IMPORT/EXPORT ---

  addRule(ruleName, fn) {
    this.availableRules[ruleName] = fn;
    this.updateRules();
  }

  deleteRule(ruleName) {
    delete this.availableRules[ruleName];
    this.updateRules();
  }

  mergeRules(newRuleName, ...ruleNames) {
    let rules = ruleNames.map((e) => this.availableRules[e]).filter((e) => e && e.defs);
    let defs = rules.reduce((a, e) => a.concat(e.defs), []);
    let newRule = Hexular.util.templateRuleBuilder(defs);
    this.addRule(newRuleName, newRule);
  }

  updateRules() {
    this.configModal.update();
    this.srbModal.update();
    this.trbModal.update();
    this.setRules();
    this.storeLocalConfigAsync();
  }

  addPreset(presetName, preset) {
    this.presets[presetName] = preset
    this.updatePresets();
  }

  deletePreset(presetName) {
    delete this.presets[presetName];
    this.updatePresets();
  }

  updatePresets() {
    this.configModal.update();
    this.storeLocalConfigAsync();
  }

  addSnippet(snippetName, snippet) {
    this.snippets[snippetName] = snippet;
    this.updateSnippets();
  }

  deleteSnippet(snippetName) {
    delete this.snippets[snippetName];
    if (this.snippetFields.name == snippetName)
      this.snippetFields.name = null;
    this.updateSnippets();
  }

  updateSnippets() {
    this.customModal.update();
    this.storeLocalConfigAsync();
  }

  addTheme(themeName, themeObj) {
    this.themes[themeName] = this.getThemeFromObject(themeObj || this);
    this.updateThemes();
  }

  deleteTheme(themeName) {
    delete this.themes[themeName];
    this.updateThemes();
  }

  updateThemes() {
    this.themeModal.update();
    this.storeLocalConfigAsync();
  }

  exportPreset() {
    return {
      preset: this.preset,
      numStates: this.numStates,
      defaultRule: this.defaultRule,
      rules: this.rules.slice(),
      nh: this.nh,
      filters: Object.assign({}, this.filters),
    };
  }

  resize(order=this.order) {
    this.order = order;
    this.storeSessionConfig();
    Board.resize();
  }

  radioAlts(buttonName) {
    for (let radioGroup of this.radioGroups)
      if (radioGroup.includes(buttonName))
        return radioGroup.filter((e) => e != buttonName);
    return [];
  }

  resetOnDraw() {
    this.drawFunctions = Object.assign({}, Config.defaults.drawFunctions);
    this.setOnDraw();
  }

  restorePlugins() {
    if (this.pluginData) {
      let existingStates = this.plugins.map((e) => e.toString());
      this.pluginData.filter((e) => !existingStates.includes(e)).forEach((pluginState) => {
        PluginControl.restoreFromPluginState(this.board, pluginState);
      });
      delete this.pluginData;
    }
  }

  updateMathPresets() {
    this.cellRadius = this.model.cellRadius;
    this.innerRadius = this.cellRadius - this.cellGap / (2 * Hexular.math.apothem);
    this.flatVertices = Hexular.math.scalarOp(Hexular.math.vertices, this.innerRadius);
    this.pointyVertices = Hexular.math.scalarOp(Hexular.math.vertices.map(([x, y]) => [y, x]), this.innerRadius);
    this.board.draw();
  }

  lock() {
    return this.setLock(true);
  }

  unlock() {
    return this.setLock(false);
  }

  setLock(value=!this.locked) {
    let cur = this.locked;
    this.locked = value;
    let lockButton = this.board.buttons.toggleLock;
    if (value) {
      if (!cur && !this.lockedTool) {
        this.lockedTool = this.tool;
      }
      this._setTool('none');
    }
    else {
      if (cur && this.lockedTool) {
        this._setTool(this.lockedTool);
      }
      this.lockedTool = null;
    }
    document.body.classList.toggle('locked', value);
    lockButton.classList.toggle('active', value);
    lockButton.classList.toggle('icon-lock', value);
    lockButton.classList.toggle('icon-lock-open', !value);
    lockButton.setAttribute('title', value ? 'Unlock' : 'Lock');
    Object.values(this.board.tools).forEach((e) => e.disabled = value);
    document.title = Board.constants.baseTitle  + (value ? ' [LOCKED]' : '');
    this.storeSessionConfigAsync();
    return value;
  }

  // --- SETTERS ---

  setAutopause(value) {
    this.autopause = value;
    this.drawModal.updateAutopause();
    this.storeSessionConfigAsync();
  }

  setCellGap(width) {
    this.cellGap = width != null ? width : this.cellGap;
    this.themeModal.cellGap.value = this.cellGap;
    this.updateMathPresets();
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setCellBorderWidth(width) {
    this.cellBorderWidth = width != null ? width : this.cellBorderWidth;
    this.themeModal.cellBorderWidth.value = this.cellBorderWidth;
    this.updateMathPresets();
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setClearOnDraw(value=this.clearOnDraw) {
    this.clearOnDraw = value;
    value && this.board.draw();
    this.drawModal.updateClearOnDraw();
    this.storeSessionConfigAsync();
  }

  setSnippetFields(snippetFields) {
    this.snippetFields = Object.assign(this.snippetFields, snippetFields);
    this.storeSessionConfigAsync();
  }

  setDrawModelBackground(value=this.drawModelBackground) {
    this.drawModelBackground = value;
    this.board.draw();
    this.drawModal.updateDrawModelBackground();
    this.storeSessionConfigAsync();
  }

  setAlpha(alpha) {
    this.alpha = alpha = Math.max(0, Math.min(1, isNaN(alpha) ? 1 : alpha));
    this.adapter.context.globalAlpha = alpha;
    this.themeModal.alpha.value = alpha;
    this.checkTheme();
    this.board.draw();
    this.storeSessionConfigAsync();
  }

  setBlendMode(mode) {
    this.blendMode = mode;
    this.adapter.context.globalCompositeOperation = mode;
    this.themeModal.selectBlendMode.value = mode;
    this.checkTheme();
    this.board.draw();
    this.storeSessionConfigAsync();
  }

  setColor(idx, color) {
    color = Color(color);
    this.colors[idx] = color;
    if (this.colorMapping.fill)
      this.fillColors[idx] = color;
    if (this.colorMapping.stroke)
      this.strokeColors[idx] = color;
    this.setColorControls(idx);
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setColors(colors=[]) {
    this.colors = Color.from(Hexular.util.merge(this.colors, colors));
    if (this.colorMapping.fill) {
      this.fillColors = this.colors.slice();
    }
    if (this.colorMapping.stroke) {
      this.strokeColors = this.colors.slice();
    }
    for (let i = 0; i < this.colors.length; i++)
      if (this.colors[i])
        this.setColorControls(i);
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setColorControls(idx) {
    let color = this.colors[idx];
    if (this.board.allColorButtons[idx])
      this.board.allColorButtons[idx].style.backgroundColor = color.hex;
    if (this.configModal.ruleMenus[idx])
      this.configModal.ruleMenus[idx].button.style.backgroundColor = color.hex;
    if (this.themeModal.colors[idx]) {
      this.themeModal.colors[idx].jscolor.fromString(color.hex);
    }
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setColorProperty(type, color) {
    let types = type ? [type] : ['backgroundColor', 'modelBackgroundColor', 'defaultColor'];
    types.forEach((key) => {
      let keyColor = this[key] = Color(color || this[key]);
      this.themeModal[key].jscolor.fromString(keyColor.hex);
      if (key == 'backgroundColor')
        document.body.style.backgroundColor = keyColor.hex;
    });
    this.checkTheme();
    this.storeSessionConfigAsync();
  }

  setScaleFactor(scale) {
    this.scaleFactor = parseFloat(scale) || this.scaleFactor || 1;
    this.pixelScaleFactor = this.scaleFactor * window.devicePixelRatio;
    this.drawModal.updateScaleFactor();
    this.board.resetTransform();
    this.storeSessionConfigAsync();
  }

  setZoom(value) {
    this.zoom = value && parseFloat(value) || Config.defaults.zoom;
    this.drawModal.updateZoom();
    this.board.scaleTo(this.zoom);
    this.storeSessionConfigAsync();
  }

  setDrawStepInterval(value) {
    this.drawStepInterval = value && parseFloat(value) || Config.defaults.drawStepInterval;
    this.drawModal.updateDrawStepInterval();
    this.storeSessionConfigAsync();
  }

  setFadeIndex(value) {
    this.fadeIndex = parseFloat(value);
    this.drawModal.updateFadeIndex();
    this.storeSessionConfigAsync();
  }

  setFilter(filter, value) {
    if (this.filters[filter] == value)
      return;
    this.filters[filter] = value;
    this.setFilters();
  }

  setFilters() {
    this.model.filters.keep((e) => this.filters[e.name] === undefined);
    this.model.filters.add(Object.values(Hexular.filters).filter((e) => this.filters[e.name]), 0);
    Object.values(this.configModal.filters).forEach((e) => e.classList.remove('active'));
    Object.entries(this.filters).forEach(([filter, value]) => {
      value && this.configModal.filters[filter].classList.add('active');
    });
    this.checkPreset();
    this.storeSessionConfigAsync();
  }

  setInterval(value=this.interval) {
    this.interval = parseInt(value);
    this.drawModal.updateInterval();
    this.storeSessionConfigAsync();
  }

  setMaxNumStates(num=this.maxNumStates) {
    this.maxNumStates = num;
    if (num < this.numStates)
      this.setNumStates(num);
    this.themeModal.update();
    this.configModal.update();
    this.board.updateColorButtons();
  }

  setNh(nh) {
    this.nh = nh;
    this.model.setNeighborhood(nh);
    this.configModal.selectNh.value = nh;
    this.checkPreset();
    this.storeSessionConfigAsync();
  }

  setNumStates(num) {
    if (num) {
      if (num > this.maxNumStates)
        this.setMaxNumStates(num);
      this.configModal.numStates.value = num = parseInt(num);
    }
    else {
      num = parseInt(this.configModal.numStates.value);
    }
    this.configModal.numStatesIndicator.innerHTML = num;
    this.numStates = this.model.numStates = num;

    this.configModal.ruleMenus.forEach((ruleMenu) => {
      let disabled = ruleMenu.idx >= num;
      ruleMenu.container.setAttribute('data-disabled', disabled);
    });
    this.setRules();
    this.checkPreset();
    this.storeSessionConfigAsync();
  }

  setOnDraw(fnName, value, radio=true) {
    if (!fnName) {
      Object.values(this.drawModal.drawButtons).forEach((e) => e.classList.remove('active'));
      let activeFns = Object.entries(this.drawFunctions).filter(([k, v]) => v).map(([k, v]) => k);
      activeFns.forEach((e) => this.setOnDraw(e, true));
    }
    else if (this.radioMap[fnName]){
      value = value != null ? value : this.drawFunctions[fnName];
      this.radioMap[fnName].set(value ? fnName : null);
      this.storeSessionConfigAsync();
    }
  }

  setPaintColor(idx, color) {
    this.paintColors[idx] = color;
    let className = `active-${idx}`;
    this.board.colorButtons.forEach((e) => e.classList.remove(className));
    this.board.colorButtons[color] && this.board.colorButtons[color].classList.add(className);
    this.storeSessionConfigAsync();
  }

  getPaintColor(idx) {
    let offset = idx ? -1 : 1;
    if (this.colorMode)
      return this.paintColors[idx];
    else if (this.customPaintMap)
      return this.customPaintMap(idx, this.board.selected.state);
    else
      return Hexular.math.mod((this.board.selected.state || 0) + offset, this.numStates);
  }

  setPaintColorMode(mode) {
    this.colorMode = mode != null ? mode : +!this.colorMode;
    if (this.colorMode) {
      this.board.toolMisc.color.classList.add('active');
      this.board.menus.color.classList.remove('hidden');
    }
    else {
      this.board.menus.color.classList.add('hidden');
      this.board.toolMisc.color.classList.remove('active');
    }
    this.storeSessionConfigAsync();
  }

  setPlugins(plugins) {
    if (plugins)
      this.plugins = plugins;
    this.storeSessionConfigAsync();
  }

  setPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) {
      this.configModal.selectPreset.selectedIndex = 0;
      this.configModal.addPreset.disabled = false;
      this.configModal.savePreset.disabled = true;
      this.preset = null;
      this.storeSessionConfig();
      return;
    }
    this.setNumStates(preset.numStates);
    this.setNh(preset.nh);

    this.rules = Object.assign(this.rules, preset.rules);

    this.filters = Object.assign({}, preset.filters);
    this.defaultRule = preset.defaultRule;
    this.setRules();
    this.setFilters();
    this.configModal.selectPreset.value = presetName;
    this.configModal.addPreset.disabled = true;
    this.configModal.savePreset.disabled = false;
    this.preset = presetName;
    this.storeSessionConfigAsync();
    this.board.runHooksAsync('updatePreset');
  }

  setRule(idx, rule) {
    let fn = this.availableRules[rule];
    if (!fn) {
      fn = this.availableRules[this.defaultRule];
      rule = this.defaultRule;
    }
    if (idx != null) {
      if (this.configModal.ruleMenus[idx])
        this.configModal.ruleMenus[idx].select.value = rule;
      this.rules[idx] = rule;
      this.model.rules[idx] = fn;
    }
    else {
      this.configModal.defaultRuleMenu.select.value = rule;
      this.defaultRule = rule;
      this.model.defaultRule = fn;
    }
    this.checkPreset();
    this.storeSessionConfigAsync();
  }

  setRules() {
    this.rules.forEach((rule, idx) => {
      let fn = this.availableRules[rule];
      if (!fn) {
        fn = this.availableRules[this.defaultRule];
        rule = this.defaultRule;
      }
      if (this.configModal.ruleMenus[idx])
        this.configModal.ruleMenus[idx].select.value = rule;
      this.model.rules[idx] = fn;
    });
    this.model.rules = this.model.rules.slice(0, this.numStates);
    this.configModal.defaultRuleMenu.select.value = this.defaultRule;
    this.model.defaultRule = this.availableRules[this.defaultRule];
    this.checkPreset();
    this.storeSessionConfigAsync();
  }

  setRbName(ruleName) {
    ruleName = ruleName || this.srbModal.ruleName.value || this.rbName;
    ruleName = ruleName.length != 0 ? ruleName : null;
    this.rbName = ruleName;
    if (ruleName)
      this.srbModal.ruleName.value = this.rbName;
    this.storeSessionConfigAsync();
  }

  setRbMiss(tuple) {
    let [miss, missRel] = tuple || this._strToTuple(this.srbModal.ruleMiss.value);
    this.rbMiss = miss;
    this.rbMissRel = missRel;
    this.srbModal.ruleMiss.value = this._tupleToStr([miss, missRel]);
    this.srbModal.updateRuleString();
    this.storeSessionConfigAsync();
  }

  setRbMatch(tuple) {
    let [match, matchRel] = tuple || this._strToTuple(this.srbModal.ruleMatch.value);
    this.rbMatch = match;
    this.rbMatchRel = matchRel;
    this.srbModal.ruleMatch.value = this._tupleToStr([match, matchRel]);
    this.srbModal.updateRuleString();
    this.storeSessionConfigAsync();
  }

  setTrb(trbState) {
    this.trb = Hexular.util.merge({}, trbState);
    this.storeSessionConfigAsync();
  }

  setSteps(steps) {
    steps = steps != null ? steps : this.steps;
    this.steps = parseInt(steps);
    this.board.setInfoBox('steps', steps);
    this.storeSessionConfigAsync();
  }

  setTheme(themeName) {
    if (this.themes[themeName]) {
      this.theme = themeName;
      this.themeModal.selectTheme.value = themeName;
      this.themeModal.addTheme.disabled = true;
      let theme = this.getThemeFromObject(this.themes[themeName]);
      Hexular.util.merge(this, theme);
      this.setThemable();
    }
    else {
      this.theme = null;
      this.themeModal.selectTheme.value = null;
      this.themeModal.addTheme.disabled = false;
    }
    this.board.draw();
    this.storeSessionConfigAsync();
    this.board.runHooksAsync('updateTheme');
  }

  setThemable() {
    this.setColorProperty();
    this.setBlendMode(this.blendMode);
    this.setAlpha(this.alpha);
    this.setColors();
    this.setCellGap();
    this.setCellBorderWidth();
  }

  setTool(tool, fallbackTool, force=false) {
    !this.locked && this._setTool(tool, fallbackTool);
  }

  _setTool(tool, fallbackTool) {
    if (tool && this.board.toolClasses[tool]) {
      this.tool = tool;
      this.fallbackTool = fallbackTool || tool;
      this.storeSessionConfigAsync();
    }
    else if (this.shift) {
      this.tool = this.shiftTool;
    }
    else if (this.tool != this.fallbackTool) {
      this.tool = this.fallbackTool;
    }
    Object.values(this.board.tools).forEach((e) => e.classList.remove('active'));
    if (this.board.tools[this.tool])
      this.board.tools[this.tool].classList.add('active');
    this.board.fgCanvas.setAttribute('data-tool', this.tool);
    this.board.drawFg();
  }

  setToolSize(size) {
    this.toolSize = size || 1;
    this.board.toolSizes.forEach((e) => e.classList.remove('active'));
    let selected = this.board.toolSizes[size - 1];
    selected && selected.classList.add('active');
    this.board.drawFg();
    this.storeSessionConfigAsync();
  }

  setUndoStackSize(size) {
    this.undoStackSize = size;
    this.board.undoStack = size ? this.board.undoStack.slice(-size) : [];
    this.board.refreshHistoryButtons();
  }

  // --- VALIDATION ---

  checkPreset() {
    const preset = this.presets[this.preset];
    if (!preset)
      return;
    let dirty = (() => {
      return this.model.numStates != preset.numStates ||
        this.nh != preset.nh ||
        this.defaultRule != preset.defaultRule ||
        this.rules.slice(0, this.model.numStates).reduce((a, rule, idx) => {
          return  a || preset.rules[idx] != rule;
        }, false) ||
        Object.entries(this.filters).reduce((a, [filter, value]) => {
          return a || preset.filters[filter] != value
        });
    })();
    if (dirty) {
      this.setPreset();
    }
    this.board.runHooksAsync('updatePreset');
  }

  checkTheme() {
    let theme = this.themes[this.theme];
    if (!theme || !this.theme) {
      this.setTheme();
      return;
    }
    theme = this.getThemeFromObject(this.themes[this.theme]);
    let dirty = false;
    if (theme.colors)
    for (let i = 0; i < this.maxNumStates; i ++) {
      if (!Color.eq(theme.colors[i], this.colors[i])) {
        dirty = true;
        break;
      }
    }
    dirty = dirty
      || !Color.eq(theme.backgroundColor, this.backgroundColor)
      || !Color.eq(theme.modelBackgroundColor, this.modelBackgroundColor)
      || !Color.eq(theme.defaultColor, this.defaultColor)
      || theme.alpha != this.alpha
      || theme.blendMode != this.blendMode
      || theme.cellGap != this.cellGap
      || theme.cellBorderWidth != this.cellBorderWidth;
    if (dirty) {
      this.setTheme();
    }
    this.board.runHooksAsync('updateTheme');
  }

  getThemeFromObject(obj) {
    let args = [Config.defaults, obj].map((e) => {
      let {
        alpha, blendMode, cellGap, cellBorderWidth, backgroundColor,
        modelBackgroundColor, defaultColor, colors
      } = e;
      return {
        alpha, blendMode, cellGap, cellBorderWidth, backgroundColor,
        modelBackgroundColor, defaultColor, colors
      };
    });
    return Hexular.util.merge(...args);
  }

  // --- STORAGE ---

  getKeyValues(keys) {
    let obj = {};
    for (let key of keys)
      obj[key] = this[key];
    return Hexular.util.merge({}, obj);
  }

  getSessionConfig() {
    let sessionConfig = this.getKeyValues([
      'alpha',
      'autopause',
      'blendMode',
      'blurTool',
      'cellBorderWidth',
      'cellGap',
      'clearOnDraw',
      'colorMapping',
      'colorMode',
      'colors',
      'defaultCap',
      'defaultColor',
      'defaultJoin',
      'defaultRule',
      'drawFunctions',
      'drawDefaultQ',
      'drawModelBackground',
      'drawStepInterval',
      'fadeIndex',
      'fallbackTool',
      'filters',
      'groundState',
      'imageFormat',
      'imageQuality',
      'importMask',
      'interval',
      'locked',
      'lockedTool',
      'maxNumStates',
      'meta',
      'modelBackgroundColor',
      'nh',
      'numStates',
      'backgroundColor',
      'paintColors',
      'preset',
      'order',
      'rbMiss',
      'rbMatch',
      'rbMissRel',
      'rbMatchRel',
      'rbName',
      'rbRel',
      'rbStates',
      'rules',
      'scaleFactor',
      'shiftTool',
      'showModelBackground',
      'snippetFields',
      'steps',
      'theme',
      'tool',
      'toolSize',
      'trb',
      'videoBitsPerSecond',
      'videoCodec',
      'videoFrameRate',
      'videoMimeType',
      'zoom',
    ]);
    sessionConfig.pluginData = this.plugins.map((e) => e.toString());
    return sessionConfig;
  };

  getLocalConfig() {
    let localConfig = this.getKeyValues([
      'availableRules',
      'presets',
      'snippets',
      'themes',
    ]);
    Object.entries(localConfig.availableRules).forEach(([rule, fn]) => {
      localConfig.availableRules[rule] = fn.toString();
    });
    return localConfig;
  }

  retrieveConfig() {
    let sessionConfig = JSON.parse(this.sessionStorageObj.getItem('sessionConfig') || '{}');
    let localConfig = JSON.parse(this.localStorageObj.getItem('localConfig') || '{}');
    localConfig.availableRules = localConfig.availableRules || {};
    return {localConfig, sessionConfig}
  }

  restoreModel() {
    let modelState = this.loadModel('modelState');
    if (modelState) {
      this.board.newHistoryState();
      this.board.model.import(modelState);
      this.board.draw();
    }
  }

  restoreState(config) {
    if (this.model)
      this.restoreModel();
    config = config || this.retrieveConfig();
    let {localConfig, sessionConfig} = config;

    Object.entries(localConfig.availableRules).forEach(([rule, val]) => {
      let fn;
      try {
        val = eval(val);
        fn = val;
        if (Array.isArray(val)) {
          let ruleBuilder = val.length > 1 ? Hexular.util.ruleBuilder : Hexular.util.templateRuleBuilder;
          fn = ruleBuilder(...val);
        }
        else {
          fn = val;
        }
      }
      catch (e) {
        this.board.setMessage(`Error while loading rule "${rule}"`);
        console.error(e);
        console.trace();
      }
      if (typeof fn == 'function')
        localConfig.availableRules[rule] = fn;
      else
        delete localConfig.availableRules[rule];
    });

    let presets = localConfig.presets;
    if (presets) {
      localConfig.presets = {};
      Object.entries(presets).forEach(([presetName, preset]) => {
        localConfig.presets[presetName] = new Preset(preset);
      });
    }

    Hexular.util.merge(this, localConfig, sessionConfig);
    if (sessionConfig.preset !== undefined)
      this.preset = sessionConfig.preset;
  }

  storeSessionState(opts={}) {
    Object.entries(opts).forEach(([key, value]) => {
      this.sessionStorageObj.setItem(key, value);
    });
  }

  storeLocalState(opts={}) {
    Object.entries(opts).forEach(([key, value]) => {
      this.localStorageObj.setItem(key, value);
    });
  }

  getSessionItem(key) {
    return this.sessionStorageObj.getItem(key);
  }

  getLocalItem(key) {
    return this.localStorageObj.getItem(key);
  }

  storeSessionConfig() {
    let config = this.getSessionConfig();
    config.preset = config.preset || '';
    config.theme = config.theme || '';
    this.sessionStorageObj.setItem('sessionConfig', JSON.stringify(config));
  }

  storeSessionConfigAsync() {
    if (!this.pendingStoreSessionAsync) {
      this.pendingStoreSessionAsync = true;
      window.setTimeout(() => {
        this.storeSessionConfig();
        this.pendingStoreSessionAsync = null;
      }, 50);
    }
  }

  storeLocalConfig() {
    let config = this.getLocalConfig();
    this.localStorageObj.setItem('localConfig', JSON.stringify(config));
  }

  storeLocalConfigAsync() {
    if (!this.pendingStoreLocalAsync) {
      this.pendingStoreLocalAsync = true;
      window.setTimeout(() => {
        this.storeLocalConfig();
        this.pendingStoreLocalAsync = null;
      }, 50);
    }
  }

  storeModel(key, bytes, obj={}) {
    obj[key] = Array.from(bytes).map((e) => e.toString(36)).join(',');
    this.storeSessionState(obj);
  }

  loadModel(key) {
    let str = this.sessionStorageObj.getItem(key);
    if (str) {
      let array = str.split(',').map((e) => parseInt(e, 36));
      return new Uint8Array(array);
    }
  }

  clearStorage(session=true, local=true) {
    let modelState = this.loadModel('modelState');
    session && this.sessionStorageObj.clear();
    local && this.localStorageObj.clear();
    modelState && this.storeModel('modelState', modelState);
  }

  _strToTuple(str) {
    return str.split(':').map((e) => parseInt(e)).map((e) => isNaN(e) ? null : e);
  }

  _tupleToStr(tuple) {
    return tuple.join(':');
  }
}

// This is provisional and terrible
class Database {
  constructor(name, version, stores={}) {
    this.open = false;
    this.name = name;
    this.version = version;
    this.pending = [];
    this.factory = window.indexedDB;
    this.stores = Object.entries(stores).map(([storeName, storeOpts]) => {
      let store = new Database.Store(this, storeName, storeOpts);
      if (!this[storeName])
        this[storeName] = store;
      return store;
    });
  }

  connect() {
    if (!window.indexedDB) {
      throw new Hexular.HexError('IndexedDB not available. Too bad.');
    }
    return new Promise((resolve, reject) => {
      let req = this.factory.open(this.name, this.version);
      req.onupgradeneeded = (ev) => {
        let db = ev.target.result;
        this.open = true;
        this.stores.forEach((store) => {
          db.createObjectStore(store.name, store.opts);
        });
      };
      req.onerror = (err) => {
        console.error(err);
        reject();
      }
      req.onsuccess = () => {
        this.db = req.result;
        this.pending.forEach((e) => {
          e.resolve(this.t(...e.args));
        });
        resolve(this);
      }
    });
  }

  async t(...args) {
    if (this.db) {
      return this.db.transaction(...args);
    }
    else {
      return new Promise((resolve, reject) => {
        this.pending.push({resolve, reject, args});
      });
    }
  }

  close() {
    this.db.close();
    this.open = false;
  }

  clear() {
    return new Promise((resolve, reject) => {
      this.open && this.close();
      let req = this.factory.deleteDatabase(this.name);
      req.onerror = () => {
        console.error(req.error);
        reject(req.error);
      }
      req.onsuccess = () => {
        resolve(this.connect());
      }
    });
  }
}

Database.Store = class {
  constructor(db, name, opts={}) {
    this.db = db;
    this.name = name;
    this.opts = opts;
  }

  async t(type='readwrite') {
    let t = await this.db.t(this.name, type);
    return t.objectStore(this.name);
  }

  p(req) {
    return new Promise((resolve, reject) => {
      req.onerror = () => {
        reject(req.error);
      }
      req.onsuccess = () => {
        resolve(req.result);
      }
    });
  }

  async put(obj) {
    let t = await this.t();
    let req = await this.p(t.put(obj));
    return this;
  }

  async get(key) {
    let t = await this.t('readonly');
    let req = await this.p(t.get(key));
    return req;
  }

  async delete(key) {
    let t = await this.t();
    let req = await this.p(t.delete(key));
    return this;
  }

  async move(oldKey, newKey) {
    let t = await this.t();
    let obj = await this.p(t.get(oldKey));
    obj[t.keyPath] = newKey;
    t.put(obj);
    t.delete(oldKey);
    return this;
  }
}

const EventHole = (...events) => {
  let handlerFn = () => {};
  let handler = (ev) => handlerFn(ev);
  events.map((e) => window.addEventListener(e, handler, {passive: false}));
  return (obj, fn) => {
    handlerFn = fn.bind(obj);
  };
};
class FileLoader {
  constructor(accept, ...args) {
    const defaults = {
      reader: 'auto',
      multiple: false,
      readIdx: 0,
      fileTypes: [],
      fileNames: [],
      filterFn: () => Array(this.input.files.length).fill(true),
      loadFn: () => null,
      fileReader: new FileReader(),
      input: document.createElement('input'),
    };
    Object.assign(this, defaults, ...args);
    this.input.type = 'file';
    this.input.accept = accept;
    this.input.multiple = this.multiple;
    this.input.onchange = () => {
      this.readFilter = this.filterFn(Array.from(this.input.files));
      this._readNext();
    };
    this.fileReader.onloadend = (ev) => {
      ++this.readIdx < this.input.files.length && this._readNext();
    }
    this.fileReader.onload = (ev) => {
      let idx = this.readIdx;
      this.loadFn(ev.target.result, this.fileNames[idx], this.fileTypes[idx]);
    };
  }

  prompt() {
    this.input.click();
  }

  set filter(fn) {
    this.filterFn = fn;
  }

  set onload(fn) {
    this.loadFn = fn;
  }

  _readNext() {
    let idx = this.readIdx;
    let file = this.input.files[idx];
    this.fileTypes[idx] = file.type;
    this.fileNames[idx] = file.name;
    let reader = this.reader;
    if (reader == 'auto') {
      let isText = ['text/plain', 'application/javascript', 'application/json'].includes(file.type);
      reader = isText ? 'readAsText' : 'readAsArrayBuffer';
    }
    this.readFilter[idx] && this.fileReader[reader](file);
  }
}

class Media {
  static getImage(name, cb) {
    if (Media.images[name])
      return Media.images[name];
    let image = new Image;
    Media.images[name] = image;
    image.onerror = () => {
      cb && cb(new Hexular.HexError(`Error loading image URL for "${name}"!`));
    };
    image.onload = () => {
      cb && cb();
    };
    (async () => {
      let media = await Media.load(name)
      image.src = media && media.url;
    })();
    return image;
  }
  static async load(name) {
    if (Media.loaded[name])
      return Media.loaded[name];
    let obj = await Board.db.media.get(name);
    if (!obj)
      throw new Hexular.HexError(`Media "${name}" not found!`);
    let media = Media.import(obj);
    let image = Media.images[name];
    if (image && !image.src && media && media.url)
      image.src = media.url;
    return media;
  }

  static import(obj) {
    return new Media(obj.name, obj.blob);
  }

  constructor(name, data, type='application/octet-stream') {
    this.set(data, type);
    this.move(name);
  }

  delete() {
    delete Media.loaded[this.name];
    Board.db.media.delete(this.name);
    URL.revokeObjectURL(this.url);
    this.blob = null;
  }

  set(data, type) {
    if (data instanceof Blob) {
      this.blob = data;
      this.type = data.type;
    }
    else {
      this.blob = new Blob([data], {type});
      this.type = type;
    }
    this.url = URL.createObjectURL(this.blob);
    return this;
  }

  move(name) {
    let oldName = this.name;
    this.name = name;
    if (oldName) {
      delete Media.loaded[oldName];
      Board.db.media.move(oldName, name);
    } else {
      Board.db.media.put(this.export());
    }
    this.name = name;
    Media.loaded[name] = this;
  }

  export() {
    return {name: this.name, blob: this.blob};
  }
}
Media.loaded = {};
Media.images = {};

class Modal {
  constructor(board, name) {
    this.board = board;
    this.config = board.config;
    this.model = board.model;
    this.name = name;
    this.modal = document.querySelector(`.modal.${name}`);
    let title = this.modal.querySelector('.modal-title');
    if (title) {
      let closeBox = document.createElement('div');
      closeBox.className = 'modal-box close-box icon-clear';
      title.appendChild(closeBox);
      closeBox.onclick = (ev) => this.board.toggleModal();
      title.onmousedown = (ev) => this.board.translateModal([ev.pageX, ev.pageY]);
    }
  }

  addRestoreBox(fn) {
    let title = this.modal.querySelector('.modal-title');
    if (!title)
      return;
    let restoreBox = this.restoreBox = document.createElement('div');
    restoreBox.className = 'modal-box restore-box icon-restore';
    title && title.appendChild(restoreBox);
    restoreBox.onclick = (ev) => fn(ev);
  }

  open() {
    this.board.modal = this;
    this.modal.style.left = '0';
    this.modal.style.top = '0';
    this.reset();
    this.modal.classList.remove('hidden');
    this.board.overlay.classList.remove('hidden');
    let focus = this.modal.querySelector('.focus');
    focus && focus.focus();
  }

  close() {
    this.board.modal = null;
    this.board.overlay.classList.add('hidden');
    this.modal.classList.add('hidden');
  }

  reset() {}

  update() {}
}

class OptParser {
  constructor(defaults) {
    this.splitFilter(location.href.split('?')[1] || '', '&').map((e) => e.split('='))
    .forEach(([key, value]) => {
      if (!value)
        return
      let result, match, idx;

      // Check for indicial assignment
      match = key.match(/(.+?)\[(\d+)\]/);
      [key, idx] = match ? [match[1], match[2]] : [key, null];
      let current = idx != null ? defaults[key][idx] : defaults[key];

      // Check if array
      match = value.match(/^\[(.+?)\]$/);
      if (match)
        result = this.merge(current, this.splitFilter(match[1], ',').map((e) => this.parseArg(e)));
      else
        result = this.parseArg(value);

      if (idx != null)
        defaults[key][idx] = result;
      else
        defaults[key] = result;
    });

    Hexular.util.merge(this, defaults);
  }

  splitFilter(str, split) {
    return str && str.split(split).filter((e) => e.trim()).filter((e) => e.length > 0) || [];
  }

  parseArg(arg) {
    let numArg = parseFloat(arg);
    if (!Number.isNaN(numArg))
      return numArg;
    if (arg == 'null' || arg == '-')
      return null
    else if (arg == 'undefined')
      return undefined;
    else if (arg == 'true')
      return true;
    else if (arg == 'false')
      return false;
    else
      return arg;
  }

  merge(a, b) {
    let length = Math.max(a.length, b.length);
    let c = Array(length);
    for (let i = 0; i < length; i++) {
      c[i] = b[i] != null ? b[i] : a[i];
    }
    return c;
  }
}

class PluginControl {
  static restoreFromPluginState(board, pluginState) {
    try {
      let [pluginName, settings, name, enabled] = JSON.parse(pluginState);
      let plugin = new Board.availablePlugins[pluginName](board, settings, name);
      new PluginControl(board, plugin, enabled);
    }
    catch (err) {
      this.board.setMessage('Error restoring plugin', 'error');
      console.error(err);
    }
  }
  constructor(board, plugin, enable=null) {
    this.board = board;
    this.config = board.config;
    let modal = this.modal = board.modals.plugin;
    if (typeof plugin == 'string') {
      let PluginClass = Board.availablePlugins[plugin];
      if (!PluginClass)
        return;
        plugin = new PluginClass(modal.board);
    }
    this.plugin = plugin;
    this.policy = plugin.getPolicy();
    this.name = plugin.name;
    this.copyIdx = 0;
    board.pluginControls.push(this);
    this.config.plugins.push(plugin);

    let controllerPrototype = document.querySelector('.assets .plugin-control');
    this.controller = controllerPrototype.cloneNode(true);
    this.controller.control = this;

    this.enabledButton = this.controller.querySelector('.plugin-enabled');
    this.nameField = this.controller.querySelector('.plugin-name');
    this.editButton = this.controller.querySelector('.plugin-edit');
    this.cloneButton = this.controller.querySelector('.plugin-clone');
    this.deleteButton = this.controller.querySelector('.plugin-delete');

    this.editorField = document.querySelector('#plugin-editor');
    this.resetButton = document.querySelector('#plugin-reset');
    this.revertButton = document.querySelector('#plugin-revert');
    this.saveButton = document.querySelector('#plugin-save');
    this.editorControls = [this.editorField, this.resetButton, this.revertButton, this.saveButton];
    this.settingsBuffer = '';

    this.nameField.value = this.name;
    modal.pluginList.appendChild(this.controller);
    this.controller.ondragstart = (ev) => this.handleDrag(ev);
    this.controller.ondragover = (ev) => this.handleDragOver(ev);
    this.controller.ondrop = (ev) => this.handleDrop(ev);
    this.enabledButton.onclick = (ev) => this.toggleEnabled();
    this.editButton.onclick = (ev) => this.toggleEditor();
    this.cloneButton.onclick = (ev) => this.clone();
    this.deleteButton.onclick = (ev) => {
      this.delete();
      this.config.storeSessionConfigAsync();
    }
    this.nameField.onchange = (ev) => this.setName(this.nameField.value);

    enable = enable != null ? enable : this.policy.autostart;
    this.activate();
    enable && this.enable();
    this.revert();
  }

  get enabled() {
    return this.plugin && this.plugin.enabled;
  }

  get activated() {
    return this.plugin && this.plugin.activated;
  }

  handleDrag(ev) {
    ev.dataTransfer.setData('text/plain', this.board.pluginControls.indexOf(this));
    ev.dataTransfer.dropEffect = 'move';
  }

  handleDragOver(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  }

  handleDrop(ev) {
    let sourceIdx = parseInt(ev.dataTransfer.getData('text/plain'));
    let targetIdx = this.board.pluginControls.indexOf(this);
    if (!isNaN(sourceIdx)) {
      let {y, height} = this.controller.getBoundingClientRect();
      y = ev.pageY - y;
      let newIdx = y < height / 2 ? targetIdx : targetIdx + 1;
      if (newIdx == sourceIdx || newIdx == sourceIdx + 1)
        return;
      if (newIdx > sourceIdx)
        newIdx --;
      let [droppedControl] = this.board.pluginControls.splice(sourceIdx, 1);
      this.board.pluginControls.splice(newIdx, 0, droppedControl);
      while (this.modal.pluginList.firstChild)
        this.modal.pluginList.firstChild.remove();
      this.board.pluginControls.forEach((pluginControl) => {
        this.modal.pluginList.appendChild(pluginControl.controller);
        pluginControl.deactivate() && pluginControl.enable();
      });
      this.config.setPlugins(this.board.pluginControls.map((e) => e.plugin));
    }
  }

  setName(name) {
    name = name || this.name;
    this.nameField.value = name;
    this.name = name;
    this.plugin.name = name;
  }

  toggleEnabled() {
    this.enabled ? this.disable() : this.enable();
    this.config.storeSessionConfigAsync();
  }

  toggleEditor() {
    this.editing ? this.closeEditor() : this.openEditor();
  }

  enable() {
    this.plugin.enable();
    this.enabledButton.classList.add('active');
    this.enabledButton.classList.add('icon-eye');
    this.enabledButton.classList.remove('icon-eye-off');
    this.board.draw();
  }

  disable() {
    if (!this.enabled)
      return false;
    this.plugin.disable();
    this.enabledButton.classList.remove('active');
    this.enabledButton.classList.add('icon-eye-off');
    this.enabledButton.classList.remove('icon-eye');
    this.board.draw();
    return true;
  }

  activate() {
    this.plugin.activate();
  }

  deactivate() {
    let enabled = this.disable();
    this.plugin.deactivate();
    return enabled;
  }

  openEditor() {
    if (this.modal.editing)
      this.modal.editing.closeEditor();
    this.editing = true;
    this.modal.editing = this;
    this.editorField.onchange = (ev) => this.saveBuffer();
    this.resetButton.onclick = (ev) => this.reset();
    this.revertButton.onclick = (ev) => this.revert();
    this.saveButton.onclick = (ev) => this.save();
    this.editorField.value = this.settingsBuffer;
    this.editorControls.forEach((e) => e.disabled = false);
    this.editButton.classList.add('active');
  }

  closeEditor() {
    if (this.modal.editing != this)
      return
    this.saveBuffer();
    this.modal.editing = null;
    this.editing = false;
    this.editorField.value = '';
    this.editorControls.forEach((e) => e.disabled = true);
    this.editButton.classList.remove('active');
  }

  reset() {
    this.plugin.saveSettings(this.plugin.defaultSettings());
    this.revert();
  }

  revert() {
    this.settingsBuffer = this.plugin.getSettings();
    if (this.modal.editing == this)
      Util.execInsert(this.editorField, this.settingsBuffer);
  }

  saveBuffer() {
    this.settingsBuffer = this.editorField.value;
  }

  save() {
    try {
      this.saveBuffer();
      this.plugin.saveSettings(this.settingsBuffer);
      this.board.setMessage(`Settings saved for ${this.name} plugin!`);
      this.board.draw();
    }
    catch (err) {
      this.board.setMessage(err, 'error');
      console.error(err);
    }
  }

  delete() {
    this.closeEditor();
    this.disable();
    this.plugin.deactivate();
    this.config.plugins = this.config.plugins.filter((e) => e != this.plugin);
    this.board.pluginControls = this.board.pluginControls.filter((e) => e != this);
    this.controller.remove();
  }

  to(board) {
    let enabled = this.enabled;
    this.delete();
    return new PluginControl(board, this.plugin.to(board), enabled);
  }

  clone() {
    let newPlugin = new this.plugin.constructor(
      this.board,
      this.plugin.getSettings(),
      `${this.plugin.name}-${('00' + this.copyIdx++).slice(-3)}`
    );
    return new PluginControl(this.board, newPlugin, this.policy.autostart || null);
  }
}

 class Plugin {
  static restore(board, pluginName, settings, name) {
    return new Board.availablePlugins[pluginName](board, settings, name);
  }

  static policy() {
    return {
      autostart: true
    };
  }

  static baseSettings() {
    return {
      stateBlacklist: null,
      stateWhitelist: null,
    };
  }

  static getNewId() {
    Plugin._counter = (Plugin._counter || 0) + 1;
    return Plugin._counter;
  }

  constructor(board, settings, name) {
    this.id = Plugin.getNewId();
    this.name = name || this.constructor.name;
    this.board = board;
    this.model = board.model;
    this.bgAdapter = board.bgAdapter;
    this.adapter = board.adapter;
    this.fgAdapter = board.fgAdapter;
    this.config = board.config;
    this.shared = board.shared;
    this.meta = this.config.meta;
    this.stateWhitelist = null;
    this.stateBlacklist = null;
    this.activated = false;
    this.enabled = false;
    this.fns = [];
    this.globalAlpha = null;
    this.saveSettings(settings || this.defaultSettings());
  }

  _activate() {}

  _deactivate() {}

  _enable() {}

  _disable() {}

  defaultSettings() {
    return `{}`;
  }

  enable() {
    this.activated || this.activate();
    if (!this.enabled) {
      this.enabled = true;
      this._enable();
    }
  }

  disable() {
    this.enabled = false;
    this._disable();
  }

  activate() {
    if (!this.activated) {
      this.activated = true;
      this._activate();
    }
  }

  deactivate() {
    if (this.activated) {
      this.activated = false;
      this.deleteHooks();
      this._deactivate();
    }
  }

  registerFunction(fn) {
    let wrapper = (...args) => {
      let result;
      try {
        result = (this.enabled || undefined) && fn(...args);
      }
      catch (err) {
        this.board.setMessage(err, 'error');
        console.error(err);
      }
      return result;
    };
    wrapper.plugin = this;
    this.fns.push(wrapper);
    return wrapper;
  }

  registerHook(hook, fn) {
    let wrapper = this.registerFunction(fn);
    this.board.addHook(hook, wrapper);
  }

  deleteHooks() {
    Object.entries(this.board.hooks).forEach(([hook, fns]) => {
      this.board.hooks[hook] = fns.filter((e) => e.fn.plugin != this);
    });
    this.fns = [];
  }

  getSettings() {
    return this.settingsString;
  }

  getPolicy() {
    return Hexular.util.merge({}, Plugin.policy, this.constructor.policy());
  }

  saveSettings(settingsString) {
    let fn;
    let settingsObj;
    try {
      fn = new Function('Board', 'Hexular', 'Util', 'settings', `return eval('(' + settings + ')');`);
      settingsObj = fn(Board, Hexular, Util, settingsString);
    }
    catch (e) {
      this.board.setMessage(e, 'error');
      throw e;
    }
    if (typeof settingsObj == 'object') {
      this.settingsString = Util.indentTrim(settingsString);
      this.settings = settingsObj;
      this.setStateLists();
      this._onSaveSettings && this._onSaveSettings();
    }
    else {
      throw new Hexular.HexError('Settings string does not evaluate to an object');
    }
    this.config.setPlugins();
  }

  setStateLists() {
    this.stateWhitelist = this.settings.stateWhitelist && new Set(this.settings.stateWhitelist);
    this.stateBlacklist = this.settings.stateBlacklist && new Set(this.settings.stateBlacklist);
  }

  drawEachCell(...args) {
    let fn = args.pop();
    let ctx = args.pop() || this.adapter.context;
    ctx.save();
    ctx.globalAlpha = this.globalAlpha != null ? this.globalAlpha : this.config.alpha;
    ctx.globalCompositeOperation = this.settings.blendMode;
    this.model.eachCell(fn);
    ctx.restore();
  }

  getPivot(q=this.board.drawStepQ, p=0.5) {
    // Always draw specific step (default 1) when drawStepInterval == 1
    if (this.config.drawStepInterval == this.config.drawDefaultQ)
      return 1;
    // Return q or inverse for 0 or 1 values
    else if (p == 0)
      return (1 - q);
    else if (p == 1)
      return q;
    // Easing functions
    if (typeof p == 'function') {
      return p(q);
    }
    // Single number (original form) or two-element array
    else {
      let [a, b] = typeof p == 'number' ? [p, p] : p;
      if (q < a)
        return q / a;
      else if (q > b)
        return (1 - q) / (1 - b);
      return 1;
    }
  }

  getFade(q=this.board.drawStepQ, f=this.settings.fadeIndex) {
    if (f == null)
      f = 1;
    return q >= f ? 1 : q / f;
  }

  isAllowedState(state) {
    if (this.stateBlacklist)
      return !this.stateBlacklist.has(state);
    else if (this.stateWhitelist)
      return this.stateWhitelist.has(state);
    else return true;
  }

  to(board) {
    return new this.constructor(board, this.getSettings(), this.name);
  }

  toString() {
    return JSON.stringify([this.constructor.name, this.getSettings(), this.name, this.enabled]);
  }
}

class Preset {
  static fromString(str) {
    let obj = JSON.parse(str);
    return new Preset(obj);
  }

  constructor(...args) {
    let defaults = {
      defaultRule: 'identityRule',
      nh: 6,
      filters: {
        binaryFilter: false,
        deltaFilter: false,
        clipBottomFilter: false,
        clipTopFilter: false,
        modFilter: true,
        edgeFilter: false
      },
      rules: [],
    };
    Hexular.util.merge(this, defaults);
    for (let arg of args)
      if (!arg)
        continue;
      else if (arg.length)
        this.rules = arg.slice();
      else
        Hexular.util.merge(this, arg);
    this.numStates = this.numStates || this.rules.length;
  }

  toString() {
    return JSON.stringify(this);
  }
}

class RadioGroup {
  constructor(keys, cb=()=>()=>{}) {
    this.keys = keys.slice();
    this.cb = cb;
    this.active = null;
    this._fn = () => {};
    this.fn = (...args) => this._fn(...args);
    this.fn.radio = this;
  }

  add(key) {
    this.keys.includes(key) || this.keys.push(key);
  }

  has(key) {
    return this.keys.includes(key);
  }

  alts(key=this.active) {
    return this.keys.filter((e) => e != key);
  }

  set(key) {
    this.active = key;
    this._fn = this.cb(this.active, this.alts()) || (() => {});
  }
}

class Recorder {
  constructor(board) {
    this.board = board;
    this.config = board.config;
    this.transferCanvas = new TransferCanvas(this.board);
  }

  draw() {
    this.transferCanvas.draw();
  }

  start() {
    this.stream = this.transferCanvas.canvas.captureStream();
    let constraints = {
      frameRate: this.config.videoFrameRate,
    };
    let opts = {
      videoBitsPerSecond: this.config.videoBitsPerSecond,
    };
    let customCodec = `${this.config.videoMimeType};codecs=${this.config.videoCodec || 'vp9'}`;
    if (MediaRecorder.isTypeSupported(customCodec))
      opts.mimeType = customCodec;
    else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))
      opts.mimeType = 'video/webm;codecs=vp9';
    else
      opts.mimeType = 'video/webm';
    this.stream.getTracks()[0].applyConstraints(constraints);
    this.recorder = new MediaRecorder(this.stream, opts);
    let chunks = [];
    this.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
      }
    };
    this.recorder.onstop = (ev) => {
      let buffer = new Blob(chunks, {type: 'video/webm'});
      let dataUri = window.URL.createObjectURL(buffer);
      this.board.promptDownload(this.config.defaultVideoFilename, dataUri);
      this.board.runHooks('recordStop', chunks);
    };
    this.recorder.start();
  }

  stop() {
    this.recorder.stop();
    this.stream.getTracks()[0].stop();
  }
}

// A wrapper in anticipation of using non-native select boxes at some point

class Select {
  static init(arg, ...args) {
    if (!arg)
      return Select.init(document.querySelectorAll('select'));
    else if (arg instanceof HTMLSelectElement)
      return new Select(arg, ...arg);
    else if (typeof arg == 'string')
      return Select.init(document.querySelectorAll(arg), ...args);
    else if (arg.length)
      return Array.from(arg).map((e) => Select.init(e, ...args));
  }

  constructor(elArg, ...args) {
    this._onchange = () => null;
    this.el = elArg instanceof HTMLSelectElement ? elArg : this._create(elArg);
    this.el.select = this;
    this.el.addEventListener('change', this.onchange);
  }

  set onchange(fn) {
    this.el.onchange = fn;
  }

  set oninput(fn) {
    this.el.oninput = fn;
  }

  set value(value) {
    this.el.value = value;
    if (this.el.selectedIndex == -1)
      this.el.selectedIndex = 0;
  }

  get value() {
    return this.el.value;
  }

  set selectedIndex(idx) {
    this.el.selectedIndex = idx;
  }

  get selectedIndex() {
    return this.el.selectedIndex;
  }

  set disabled(value) {
    this.el.disabled = value;
  }

  get disabled() {
    return this.el.disabled;
  }

  replace(opts, selected, keep=0) {
    let data = opts;
    if (opts.length) {
      data = {};
      opts.forEach((e) => data[e] = e);
    }
    this.el.options.length = keep;
    Object.entries(data).forEach(([key, value]) => {
      let option = document.createElement('option');
      option.value = key;
      option.text = value;
      option.selected = key == selected;
      this.el.appendChild(option);
    });
  }

  _create(...args) {
    let strArgs = [];
    let objArgs = {};
    for (let arg of args)
      if (typeof arg == 'string')
        strArgs.push(arg);
      else if (typeof arg == 'object')
        Object.assign(objArgs, arg);
    let [tag, className] = Object.assign(['div', ''], strArgs);
    let el = document.createElement(tag);
    className && (el.className = className)
    Object.entries(objArgs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
    return el;
  }
}
// Not actually used, but left in b/c it may be needed at some point
class SharedStore {
  // TODO De-dup writes per step
  constructor() {
    this.owners = new Map();
    this.objects = new Map();
  }

  get(owner, key, defaultObject={}) {
    let obj = this.objects.get(key);
    if (obj) {
      this.owners.get(key).add(owner);
    }
    else {
      obj = defaultObject;
      this.objects.set(key, obj);
      this.owners.set(key, new Set());
    }
    return obj;
  }

  delete(owner, key) {
    let owners = this.owners.get(key);
    owners.delete(owner);
    if (!owners.size) {
      this.owners.delete(key);
      this.objects.delete(key);
    }
  }
}

class TransferCanvas {
  constructor(board) {
    this.board = board;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.draw();
  }

  draw() {
    this.canvas.width = this.board.canvasWidth;
    this.canvas.height = this.board.canvasHeight;
    [this.board.bgCanvas, this.board.mainCanvas].forEach((canvas) => {
      this.ctx.drawImage(
        canvas,
        0, 0, canvas.width, canvas.height,
        0, 0, canvas.width, canvas.height
      );
    });
  }
}

const Util = (() => {
  const Util = {};

  Util.binaryRuleFactory = (...args) => {
    args = args.filter((e) => typeof e == 'number' && e >= 0 && Math.floor(e) == e);
    let str = '() => 0';
    if (args.length)
      str = Util.indentTrim(`
        (cell) => {
          let c = cell.count;
          return ${args.map((e) => `c == ${e}`).join(' || ')} ? 1 : 0;
        }
      `);
    return eval(str);
  };

  Util.symmetricRuleFactory = (...args) => {
    args = args.filter((e) => typeof e == 'number' && e >= 0 && Math.floor(e) == e);
    let str = '() => 0';
    if (args.length)
      str = Util.indentTrim(`
        (cell) => {
          let c = cell.count;
          let n = cell.neighborhood;
          if (cell.state) {
            if (${args.map((e) => `c == ${e}`).join(' || ')})
              return 1;
            else
              return 0;
          }
          else {
            if (${args.map((e) => `c == n - ${e}`).join(' || ')})
              return 0;
            else
              return 1;
          }
        }
      `);
    return eval(str);
  };

  Util.setColorRange = (opts={}) => {
    let [min, max] = opts.range || [0, Board.config.maxNumStates];
    let range = max - min;
    let hBase = opts.h || 0;
    let sBase = opts.s != null ? opts.s : 0.5;
    let lBase = opts.l != null ? opts.l : 0.5;
    let aBase = opts.a != null ? opts.a : 1;
    let hDelta = opts.hDelta != null ? opts.hDelta : 360;
    let sDelta = opts.sDelta || 0;
    let lDelta = opts.lDelta || 0;
    let aDelta = opts.aDelta || 0;
    let colors = Board.config.colors.slice();
    for (let i = min; i < max; i++) {
      let q = i - min;
      let h = Hexular.math.mod((hBase + q * hDelta / range), 360);
      let s = sBase + q * sDelta / range;
      let l = lBase + q * lDelta / range;
      let a = aBase + q * aDelta / range;
      colors[i] = Color.hslaToRgba(h, s, l, a);
    }
    Board.config.setColors(colors);
  };

  Util.rotateColors = (offset=1) => {
    let colors = [];
    let len = Math.min(Board.config.maxNumStates, Board.config.colors.length);
    for (let i = 0; i < len; i++) {
      let color = Board.config.colors[(i - offset + len) % len];
      colors.push(color);
    }
    Board.config.setColors(colors);
  };

  Util.pairsToObject = (tuples) => {
    let obj = {};
    tuples.forEach(([key, value]) => obj[key] = value);
    return obj;
  };

  Util.sexToInt = (str, base=60) => {
    let p = str.split(':').map((e) => parseInt(e));
    let num = 0;
    while (p.length) {
      let val = p.shift();
      let col = p.length;
      val *= (base ** col);
      num += val;
    }
    return num;
  }

  // ugghh
  Util.groundStart = (delay=1) => {
    let board = Board.instance;
    if (board.running)
      return;
    let config = Board.config;
    let model = Board.model;
    let states = model.cells.map((cell) => cell.state);
    board.addHook('autopauseStep', () => {
      model.changed = true;
      if (!--delay) {
        model.cells.forEach((e, i) => e.setState(states[i]));
        board.removeHook('Util.groundStart');
      }
    }, {id: 'Util.groundStart'});
    board.clear();
    board.resetDrawStep();
    board.drawSync();
  }

  Util.stateHistogram = () => {
    return Board.model.cells.reduce((a, e) => {
      a[e.state] = a[e.state] || 0;
      a[e.state] += 1;
      return a;
    }, {});
  }

  Util.translateStates = (cubicVector) => {
    for (let i = 0; i < 3; i++) {
      if (cubicVector[i] == null)
        cubicVector[i] = -cubicVector[(i + 1) % 3] - cubicVector[(i + 2) % 3];
    }
    // I feel like these are going to be pretty opaque errors for most ppl
    if (cubicVector.filter((e) => isNaN(parseInt(e))).length)
      throw new Hexular.HexError('Requires at least 2 cubic coordinates');
    if (!cubicVector.reduce((a, e, i, s) => a && e == -s[(i + 1) % 3] - s[(i + 2) % 3], true))
      throw new Hexular.HexError('Inconsistent cubic coordinates');
    let [u, v] = cubicVector.map((e) => Math.abs(e));
    let un = cubicVector[0] > 0 ? 1 : 4;
    let vn = cubicVector[1] > 0 ? 2 : 5;
    let transMap = new Map();
    Board.model.eachCell((cell) => {
      let p = cell;
      for (let i = 0; i < u; i ++)
        p = p.nbrs[un];
      for (let i = 0; i < v; i++)
        p = p.nbrs[vn];
      transMap.set(p, cell.state);
    });
    // Set states
    Board.instance.newHistoryState();
    transMap.forEach((state, cell) => {
      cell.setState(state);
    });
    Board.instance.draw();
  };

  Util.preventClose = () => {
    window.onbeforeunload = (ev) => {
      ev.preventDefault();
      return 'r u sure lol?'
    };
  };

  Util.findDuplicateSteps = (opts={}) => {
    let radius = opts.radius || Board.config.order;
    let cell = opts.cell || Board.instance.debugSelected || Board.model.cells[0];
    let cells = cell.wrap(radius);
    let coord = cell.coord;
    let halt = !!opts.halt;
    let map = window.stateMap = new Map();
    let dups = window.duplicates = [];
    let currentBoard = Board.instance;

    let getStateKey = () => {
      if (currentBoard != Board.instance) {
        currentBoard = Board.instance;
        cell = Board.model.cellAtCubic(coord);
        cells = cell.wrap(radius);
      }
      return cells.map((e) => ('0' + e.state.toString(16)).slice(-2)).join('');
    }

    let fn = () => {
      let stateKey = getStateKey();
      let cur = map.get(stateKey);
      if (cur != null) {
        window.testmap = map;
        dups.push([cur, Board.config.steps, stateKey]);
        Board.instance.setMessage(`Duplicate at ${cur}, ${Board.config.steps}!`);
        console.log(`Duplicate at ${cur}, ${Board.config.steps}!`);
        if (halt)
          Board.instance.stop();
      }
      map.set(stateKey, Board.config.steps);
    }
    return Board.instance.addHook('step', fn, {id: 'Util.findDuplicateSteps', map, dups});
  };

  Util.setBreakpoints = (breakpoints) => {
    Board.config.meta.breakpoints = breakpoints || Board.config.meta.breakpoints || [];
    return Board.instance.addHook('step', () => {
      if (Board.config.meta.breakpoints.includes(Board.config.steps)) {
        Board.instance.stop();
      }
    }, {id: 'Util.setBreakpoints'});
  };

  Util.debugTimer = (log=true) => {
    let intervals = window.debugIntervals = [];
    let t;
    let fn = () => {
      let oldT = t;
      t = Date.now();
      if (oldT) {
        let delta = t - oldT;
        log && console.log(delta);
        intervals.push(delta);
      }
    }
    return Board.instance.addHook('step', fn, {id: 'Util.debugTimer', intervals});
  };

  Util.clearUtilHooks = () => {
    let ids = [
      'Util.findDuplicateSteps',
      'Util.setBreakpoints',
      'Util.debugTimer',
      'Util.groundStart',
    ];
    ids.forEach((e) => Board.instance.removeHook(e));
  },

  Util.debugCell = (cell, fn) => {
    if (cell == Board.instance.debugSelected)
      fn(cell);
  };

  Util.indentTrim = (string) => {
    let lines = string.split('\n');
    let min = Infinity;
    for (let line of lines) {
      let indent = line.match(/^( *?)[^ ].*$/)
      if (indent) {
        min = Math.min(indent[1].length, min);
      }
    }
    min = min < Infinity ? min : 0;
    return lines.map((e) => e.substring(min)).filter((e) => e.length > 0).join('\n');
  };

  Util.execCommandBroken = () => { // *sigh*
    if (!document.execCommand || !document.queryCommandSupported)
      return true;
    let lastFocus = document.activeElement;
    let elem = document.createElement('textarea');
    elem.style.position = 'fixed';
    elem.style.left = '0';
    elem.style.top = '0';
    elem.style.opacity = '0';
    document.body.appendChild(elem);
    elem.value = `Looking at you Firefox`;
    elem.focus();
    elem.setSelectionRange(0, 15);
    document.execCommand('delete', false);
    document.execCommand('insertText', false, 'Wtf ');
    let str = elem.value;
    lastFocus && lastFocus.focus();
    elem.remove();
    return str.length == 22 ? true : false;
  };

  Util.handleTextFormat = (elem, ev) => {
    let cursor = elem.selectionStart;
    let text = elem.value;
    let beforeCursor = text.slice(0, cursor);
    let afterCursor = text.slice(cursor);
    if (
      ev.inputType == 'insertLineBreak' ||
      text[cursor -1] == '\n' && ev.inputType == 'insertText' && !ev.data // wtf
    ) {
      let rows = beforeCursor.split('\n');
      let lastRow = rows.slice(-2)[0];
      let match = lastRow && lastRow.match(/^\s+/);
      let spaces = match && match[0] || '';
      Util.execInsert(elem, spaces, cursor);
      elem.setSelectionRange(cursor + spaces.length, cursor + spaces.length);
    }
  };

  Util.execInsert = (elem, str, startIdx, endIdx) => {
    endIdx = endIdx || startIdx;
    if (!Board.instance.execCommandBroken) {
      elem.focus();
      if (startIdx) {
        elem.setSelectionRange(startIdx, endIdx);
      }
      else {
        elem.select();
        document.execCommand("delete", false);
      }
      document.execCommand("insertText", false, str);
    }
    else {
      if (!startIdx)
        elem.value = str;
      else
        elem.value = elem.value.slice(0, startIdx) + str + elem.value.slice(endIdx);
    }
  };

  Util.fit = (parent, child, action='cover') => {
    let w, h;
    if (!action) {
      [w, h] = child;
    }
    else if (action == 'stretch') {
      [w, h] = parent;
    }
    else {
      let [wp, hp] = parent;
      let [wc, hc] = child;
      let ap = wp / hp;
      let ac = wc / hc;
      let cover = action == 'cover';
      if (cover == ac < ap) {
        w = wp;
        h = wp * hc / wc;
      }
      else { // action == 'contain'
        h = hp;
        w = hp * wc / hc;
      }
    }
    return [w, h];
  }

  Util.shallowPrettyJson = (data, maxLevels=2, indentText='  ') => {
    let json = JSON.stringify(data);
    let str = '';
    let level = 0;
    let openers = ['[', '{'];
    let closers = [']', '}'];
    let quote = false;
    let indent = (level) => '\n' + indentText.repeat(level);
    for (let i = 0; i < json.length; i++) {
      let char = json[i];
      let next = json[i + 1];
      str += char;
      if (char == '"' && json[i - 1] != '\\')
        quote = !quote;
      if (quote)
        continue;
      let opener = openers.includes(char);
      let closer = closers.includes(char);
      let closerNext = closers.includes(next);
      opener && ++level;
      closer && --level;
      let indentable = level <= maxLevels;

      if (char == ':') {
        str += ' ';
      }
      else if (indentable) {
        if (opener && !closerNext) {
          str += indent(level);
        }
        else if (closer || char == ',') {
          if (next == ',') {
            i ++;
            str += ',';
          }
          str += indent(closerNext ? level - 1 : level);
        }
        else if (closerNext) {
          str += indent(level - 1);
        }
      }
      else if (char == ',') {
        str += ' ';
      }
    }
    return str;
  };

  Util.loadImageAsUrl = () => {
    return new Promise((resolve, reject) => {
      let board = Board.instance;
      let fileLoader = new FileLoader('.jpg,.jpeg,.gif,.png,.svg,.bmp', {reader: 'readAsArrayBuffer'});
      fileLoader.onload = (result) => {
        if (result) {
          let blob = new Blob([result], {type: fileLoader.fileTypes[0]});
          resolve(window.URL.createObjectURL(blob));
        }
      };
      fileLoader.prompt();
    });
  }

  return Util;
})();


class ConfigModal extends Modal {
  constructor(...args) {
    super(...args);
    this.ruleMenus = [];
    this.defaultRuleMenu = null;
    this.filters = {
      clipBottomFilter: document.querySelector('#filter-clip-bottom'),
      clipTopFilter: document.querySelector('#filter-clip-top'),
      binaryFilter: document.querySelector('#filter-binary'),
      deltaFilter: document.querySelector('#filter-delta'),
      modFilter: document.querySelector('#filter-mod'),
      edgeFilter: document.querySelector('#filter-edge'),
    };
    this.checkState = null;
    this.ruleGroup = document.querySelector('#rule-group');
    this.numStates = document.querySelector('#num-states');
    this.numStatesIndicator = document.querySelector('#num-states-indicator');
    this.addPreset = document.querySelector('#add-preset');
    this.savePreset = document.querySelector('#save-preset');
    this.loadPreset = document.querySelector('#load-preset');
    this.selectPreset = document.querySelector('#select-preset').select;
    this.checkAll = document.querySelector('#check-all');
    this.setAll = document.querySelector('#set-all').select;
    this.selectNh = document.querySelector('#select-neighborhood').select

    this.modal.onmouseup = (ev) => this._handleCheckState(ev);
    this.modal.onmousemove = (ev) => this._handleCheckState(ev);
    this.modal.onmouseleave = (ev) => this._handleCheckState(ev);
    this.numStates.oninput = (ev) => this._handleNumStates();
    this.addPreset.onclick = (ev) => this._handleAddPreset();
    this.savePreset.onclick = (ev) => this._handleSavePreset();
    this.loadPreset.onclick = (ev) => this._handleLoadPreset();
    this.selectPreset.onchange = (ev) => this._handlePreset();
    this.checkAll.onclick = (ev) => this._handleCheckAll();
    this.setAll.oninput = (ev) => this._handleSetAll(ev);
    this.selectNh.onchange = (ev) => this.handleNh(ev);
    Object.entries(this.filters).forEach(([filter, button]) => {
      button.onclick = (ev) => this._handleFilter(filter);
    });
  }

  update() {
    this._updateMenus();
    this.numStates.max = this.config.maxNumStates;
  }

  _handleNumStates() {
    this.config.setNumStates(this.numStates.value);
    this.board.setMessage(`Set model to ${this.config.numStates} states`);
  }

  _handlePreset() {
    this.config.setPreset(this.selectPreset.value);
    this.board.setMessage(`Selected preset "${this.config.preset}"`);
  }

  _handleAddPreset() {
    // TODO: Replace native prompt
    let presetName = window.prompt('Please enter a preset name:');
    if (presetName) {
      let preset = new Preset(this.config.exportPreset());
      this.config.addPreset(presetName, preset);
      this.config.setPreset(presetName);
    }
  }

  _handleSavePreset() {
    let obj = {};
    let presetName = this.config.preset;
    obj[presetName] = this.config.exportPreset();
    let dataUri = `data:application/json,${encodeURIComponent(JSON.stringify(obj))}`;
    this.board.promptDownload(`${presetName.replace(/ /g, '_')}.json`, dataUri);
  }

  _handleLoadPreset() {
    let fileLoader = new FileLoader('.json');
    fileLoader.onload =  (result) => {
      try {
        let obj = JSON.parse(result);
        let presets = Object.entries(obj).map(([presetName, presetObj]) => {
          this.config.addPreset(presetName, new Preset(presetObj));
          return presetName;
        });

        if (presets.length > 1) {
          this.board.setMessage('Presets imported!');
        }
        else if (presets.length == 1) {
          this.board.setMessage('Preset imported!');
          this.config.setPreset(presets[0]);
        }
      }
      catch (e) {
        this.board.setMessage(e.toString(), 'error');
      }

    };
    fileLoader.filter = (files) => {
      let result = files.map((file) => file.type.indexOf('json') >= 0);
      result.some((e) => !e) && this.setMessage('Not all selected files are JSON files', 'error');
      return result;
    };
    fileLoader.prompt();
  }

  _handleCheckState(ev) {
    if (ev.buttons ^ 1)
      this.checkState = null;
  }

  _handleCheckAll() {
    let ruleMenus = this.ruleMenus.concat(this.defaultRuleMenu);
    let check = !ruleMenus.every((ruleMenu) => ruleMenu.checked);
    if (check)
      this.checkAll.classList.add('checked');
    else
      this.checkAll.classList.remove('checked');
    ruleMenus.forEach((ruleMenu) => {
      ruleMenu.checked = check;
    });
  }

  _handleSetAll(ev) {
    let rule = this.setAll.value;
    if (this.config.availableRules[rule]) {
      this.ruleMenus.concat(this.defaultRuleMenu)
      .filter((e) =>  e.checked)
      .forEach((ruleMenu) => {
        this.config.setRule(ruleMenu.idx, rule);
      });
    }
    this.setAll.value = null;
  }

  handleNh(ev) {
    this.config.setNh(parseInt(this.selectNh.value));
    this.board.setMessage(`Set neighborhood to N${this.config.nh}`)
  }

  _handleFilter(filter) {
    let state = !this.config.filters[filter];
    this.config.setFilter(filter, state);
  }

  _updateMenus() {
    this.availableRuleNames = Object.keys(this.config.availableRules);
    this.presetNames = Object.keys(this.config.presets);

    this.selectPreset.replace(this.presetNames, this.config.preset, 1);
    this.setAll.replace(this.availableRuleNames, null, 1);

    this.defaultRuleMenu = new RuleMenu(this, document.querySelector('#default-rule-menu'));
    while (this.ruleGroup.firstChild)
      this.ruleGroup.firstChild.remove();
    this.ruleMenus = [];
    for (let i = 0; i < this.config.maxNumStates; i++) {
      let ruleMenu = new RuleMenu(this, i);
      this.ruleMenus.push(ruleMenu);
      this.ruleGroup.appendChild(ruleMenu.container);
    }
  }

}

class RuleMenu {
  constructor(modal, arg) {
    this.modal = modal;
    this.board = modal.board;
    this.config = modal.config;
    if (typeof arg == 'number') {
      let prototype = document.querySelector('.assets .rule-menu');
      this.container = this.container = prototype.cloneNode(true);
      this.idx = arg;
    }
    else {
      this.container = arg;
      this.idx = null;
    }
    let container = this.container;
    let idx = this.idx;
    let select = this.select = new Select(container.querySelector('select'));
    let button = this.button = container.querySelector('button.checkable');
    select.ruleMenu = this;
    select.onchange = (ev) => this.config.setRule(idx, select.value);
    if (idx != null) {
      container.title = idx;
      button.style.backgroundColor = this.config.colors[idx] && this.config.colors[idx].toString();
      select.replace(this.modal.availableRuleNames, this.config.rules[idx]);
    }
    else {
      container.title = 'Default rule';
      button.classList.add('icon-infinity');
      select.replace(this.modal.availableRuleNames, this.config.defaultRule);
    }
    container.setAttribute('data-disabled',  idx >= this.config.numStates);

    button.onmousedown = (ev) => {
      this.checked = !this.checked;
      this.modal.checkState = this.checked;
      ev.preventDefault();
    };
    button.onmousemove = (ev) => {
      if (this.modal.checkState != null)
        this.checked = this.modal.checkState;
    };
  }

  set checked(val) {
    if (val)
      this.container.classList.add('checked');
    else
      this.container.classList.remove('checked');
  }

  get checked() {
    return this.container.classList.contains('checked');
  }
}

class ConfirmModal extends Modal {
  constructor(...args) {
    super(...args);
    this.resolve = null;
    this.text = document.querySelector('#confirmation-text');
    this.buttonContainer = document.querySelector('#confirmation-buttons');
    this.buttons = new Map();
  }

  close() {
    super.close();
    this.resolve && this.resolve();
  }

  async ask(msg, buttons={No: false, Yes: true}, focus=0) {
    this.text.innerHTML = msg;
    let focused;
    Object.entries(buttons).forEach(([buttonText, buttonValue], idx) => {
      let button = document.createElement('button');
      button.innerHTML = buttonText;
      if (idx == focus)
        focused = button;
      button.onclick = 
      this.buttonContainer.appendChild(button);
      this.buttons.set(button, buttonValue);
    });
    focused && focused.focus();
    this.board.toggleModal(this.name);
    return await this._awaitButtons();
  }

  _resolve() {
    this.resolve = null;
    this.close();
    this.buttons.clear();
    this.text.innerHTML = '';
    while (this.buttonContainer.firstChild)
      this.buttonContainer.firstChild.remove();
  }

  _awaitButtons() {
    return new Promise((resolve, reject) => {
      this.buttons.forEach((value, button) => {
        button.onclick = () => {
          this.resolve(value);
        }
      });
      this.resolve = (value=null) => {
        resolve(value);
        this._resolve();
      };
    });
  }

}

class CustomModal extends Modal {
  constructor(...args) {
    super(...args);
    this.selectSnippet = document.querySelector('#select-snippet').select;
    this.input = document.querySelector('#snippet-input');
    this.output = document.querySelector('#snippet-output');
    this.import = document.querySelector('#import');
    this.addButton = document.querySelector('#add-snippet');
    this.runButton = document.querySelector('#run-custom-code');
    this.snippetFields = {};
    this.editMode = true;

    this.selectSnippet.onchange = (ev) => {
      let text = this.config.snippets[this.selectSnippet.value];
      this.addButton.disabled = !!text;
      if (text) {
        this.editMode = false; // ugh
        Util.execInsert(this.input, text);
        this.setSnippetFields({name: this.selectSnippet.value, text});
        this.editMode = true;
      }
    };

    this.input.oninput = (ev) => {
      Util.handleTextFormat(this.input, ev);
      if (this.editMode) {
        this.selectSnippet.value = null;
        this.addButton.disabled = false;
      }
    };

    this.input.onchange = (ev) => {
      this.setSnippetFields({text: this.input.value});
    }

    this.output.onclick = (ev) => this.output.select();

    this.import.onclick = (ev) => this.board.import();

    this.addButton.onclick = (ev) => this.handleAddSnippet();

    this.runButton.onclick = (ev) => {
      if (this.input.value == '') {
        this.board.setMessage('Nothing to run!', 'warning');
        return;
      }
      try {
        let evalFn = new Function('Hexular', 'Board', 'Util', 'value', 'return eval(value)')
        let output = evalFn(Hexular, Board, Util, this.input.value);
        this.output.value = output && output.toString();
        if (typeof output != 'function') {
          try {
            this.output.value = JSON.stringify(output);
          }
          catch {}
        }
        this.board.setMessage('Done!');
      }
      catch (err) {
        this.board.setMessage(`Error: ${err}.`, 'error');
      }
    }
  }

  update() {
    this.selectSnippet.replace(Object.keys(this.config.snippets).sort(), null, 1);
    this.reset();
  }

  reset() {
    this.snippetFields = Hexular.util.merge({}, this.config.snippetFields);
    this.addButton.disabled = !!this.snippetFields.name;
    this.selectSnippet.value = this.snippetFields.name;
    this.input.value = this.snippetFields.text;
  }

  setSnippetFields(fields) {
    if (!fields.name && fields.text && fields.text != this.snippetFields.text)
      fields.name = null;
    this.snippetFields = Object.assign(this.snippetFields, fields);
    this.config.setSnippetFields(this.snippetFields);
  }

  handleAddSnippet() {
    // TODO: Replace native prompt
    let snippetName = window.prompt('Please enter a snippet name:');
    if (snippetName) {
      this.config.addSnippet(snippetName, this.config.snippetFields.text);
      this.config.setSnippetFields({name: snippetName});
      this.reset();
    }
  }
}

class DrawModal extends Modal {
  constructor(...args) {
    super(...args);
    this.defaultInterval = Config.defaults.interval;
    this.drawButtons = {
      sortCellsAsc: document.querySelector('#sort-cells-asc'),
      sortCellsDesc: document.querySelector('#sort-cells-desc'),
      drawFilledPointyHex: document.querySelector('#draw-filled-pointy-hex'),
      drawOutlinePointyHex: document.querySelector('#draw-outline-pointy-hex'),
      drawFilledFlatHex: document.querySelector('#draw-filled-flat-hex'),
      drawOutlineFlatHex: document.querySelector('#draw-outline-flat-hex'),
      drawFilledCircle: document.querySelector('#draw-filled-circle'),
      drawOutlineCircle: document.querySelector('#draw-outline-circle'),
    };
    this.sortFunctions = ['sortCellsAsc', 'sortCellsDesc'];
    this.autopause = document.querySelector('#autopause');
    this.clearOnDraw = document.querySelector('#clear-on-draw');
    this.drawModelBackground = document.querySelector('#draw-model-background');
    this.interval = document.querySelector('#interval-slider');
    this.intervalIndicator = document.querySelector('#interval-indicator');
    this.drawStepInterval = document.querySelector('#draw-step-slider');
    this.drawStepIndicator = document.querySelector('#draw-step-indicator');
    this.fadeIndex = document.querySelector('#fade-index-slider');
    this.fadeIndicator = document.querySelector('#fade-indicator');
    this.zoom = document.querySelector('#zoom-slider');
    this.zoomIndicator = document.querySelector('#zoom-indicator');
    this.scaleFactor = document.querySelector('#scale-slider');
    this.scaleIndicator = document.querySelector('#scale-indicator');

    Object.entries(this.drawButtons).forEach(([fnName, button]) => button.onclick = () => this._setOnDraw(fnName));
    this.autopause.onclick = (ev) => this.config.setAutopause(!this.config.autopause);
    this.clearOnDraw.onclick = (ev) => this.config.setClearOnDraw(!this.config.clearOnDraw);
    this.drawModelBackground.onclick = (ev) => this.config.setDrawModelBackground(!this.config.drawModelBackground);
    this.interval.oninput = (ev) => this.config.setInterval(this.interval.value);
    this.drawStepInterval.oninput = (ev) => this.config.setDrawStepInterval(this.drawStepInterval.value);
    this.fadeIndex.oninput = (ev) => this.config.setFadeIndex(this.fadeIndex.value);
    this.zoom.oninput = (ev) => this.config.setZoom(this.zoom.value);
    this.scaleFactor.oninput = (ev) => this.config.setScaleFactor(this.scaleFactor.value);

    this.addRestoreBox(() => {
      this.config.setAutopause(true);
      this.config.setClearOnDraw(true);
      this.config.setDrawModelBackground(true);
      this.config.resetOnDraw();
      this.config.setInterval(Config.defaults.interval);
      this.config.setDrawStepInterval(Config.defaults.drawStepInterval);
      this.config.setFadeIndex(Config.defaults.fadeIndex);
      this.config.setZoom(Config.defaults.zoom);
      this.config.setScaleFactor(Config.defaults.scaleFactor);
    });
  }

  reset() {
    this.updateAutopause();
    this.updateClearOnDraw();
    this.updateDrawModelBackground();
    this.updateInterval();
    this.updateDrawStepInterval();
    this.updateFadeIndex();
    this.updateZoom();
  }

  updateAutopause() {
    this.autopause.classList.toggle('active', this.config.autopause);
  }

  updateClearOnDraw() {
    this.clearOnDraw.classList.toggle('active', this.config.clearOnDraw);
  }

  updateDrawModelBackground() {
    this.drawModelBackground.classList.toggle('active', this.config.drawModelBackground);
  }

  updateInterval() {
    this.interval.value = this.config.interval;
    this.intervalIndicator.innerHTML = this.config.interval;
  }

  updateDrawStepInterval() {
    this.drawStepInterval.value = this.config.drawStepInterval;
    this.drawStepIndicator.innerHTML = this.config.drawStepInterval;
  }

  updateFadeIndex() {
    this.fadeIndex.value = this.config.fadeIndex;
    this.fadeIndicator.innerHTML = this.config.fadeIndex;
  }

  updateZoom() {
    this.zoom.value = this.config.zoom;
    this.zoomIndicator.innerHTML = this.config.zoom;
  }

  updateScaleFactor() {
    this.scaleFactor.value = this.config.scaleFactor;
    this.scaleIndicator.innerHTML = this.config.scaleFactor;
  }

  _setOnDraw(fnName) {
    let lastState = this.config.drawFunctions[fnName];
    this.config.setOnDraw(fnName, !lastState);
    // TODO: This is still hacky but somewhat less so than alternative
    if (this.sortFunctions.includes(fnName) && lastState)
      this.model.sortCells();
    this.board.draw();
  }
}

class PluginModal extends Modal {
  constructor(...args) {
    super(...args);
    this.selectPlugin = document.querySelector('#select-plugin').select;
    this.addPlugin = document.querySelector('#add-plugin');
    this.pluginList = document.querySelector('#plugin-list');
    this.pluginEditor = document.querySelector('#plugin-editor');
    this.pluginReset = document.querySelector('#plugin-reset');
    this.pluginRevert = document.querySelector('#plugin-revert');
    this.pluginSave = document.querySelector('#plugin-save');

    this.editing = null;

    this.selectPlugin.onchange = (ev) => this.updatePlugins();
    this.addPlugin.onclick = (ev) => this._addPlugin(this.selectPlugin.value);
    this.pluginEditor.oninput = (ev) => Util.handleTextFormat(this.pluginEditor, ev);
  }

  reset() {
    this.updatePlugins();
  }

  update() {
    this.selectPlugin.replace(Object.keys(Board.availablePlugins), this.selectPlugin.value, 1);
  }

  _addPlugin(pluginName) {
    let plugin = new PluginControl(this.board, pluginName);
    plugin && this.board.setMessage(`Added ${pluginName} plugin!`);
  }

  updatePlugins() {
    this.addPlugin.disabled = !this.selectPlugin.value;
  }
}

class ResizeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.order = this.defaultRadius = Config.defaults.order;
    this.resize = document.querySelector('#resize-slider');
    this.resizeIndicator = document.querySelector('#resize-indicator');
    this.resizeButton = document.querySelector('#resize-set');

    this.resize.oninput = (ev) => this._updateResize(this.resize.value);
    this.resizeButton.onclick = (ev) => this._resize();

    this.addRestoreBox(() => {
      this._updateResize(this.defaultRadius);
    });
  }

  reset() {
    this._updateResize();
  }

  _updateResize(value) {
    if (value != null)
      this.order = value != null ? parseInt(value) : this.defaultRadius;
    else
      this.order = this.config.order;
    this.resize.value = this.order;
    this.resizeIndicator.innerHTML = this.order;
    let labelMatch = this.resizeButton.innerHTML.match(/^(.+?)([\d\,\.]+)(.+?)$/);
    if (labelMatch) {
      let cells = this.order * (this.order + 1) * 3 + 1;
      let newLabel = labelMatch[1] + cells.toLocaleString() + labelMatch[3];
      this.resizeButton.innerHTML = newLabel;
    }
  }

  _resize() {
    this.config.resize(this.order);
    Board.instance.setMessage(`Set board size to ${Board.config.order}`);
  }
}

class SrbModal extends Modal {
  constructor(...args) {
    super(...args);
    this.ruleName = document.querySelector('#rule-name');
    this.selectAvailable = document.querySelector('#select-available').select;
    this.checkAll = document.querySelector('#rule-select-all');
    this.ruleMiss = document.querySelector('#rule-miss').select;
    this.ruleMatch = document.querySelector('#rule-match').select;
    this.stateGrid = document.querySelector('#state-grid');
    this.ruleString = document.querySelector('#rule-string');
    this.resetButton = document.querySelector('#reset-rule');
    this.addButton = document.querySelector('#add-rule');
    this.stateElements = [];
    this.settingState = null;
    this.updateRuleStringPending = false;

    while (this.stateGrid.firstChild)
      this.stateGrid.firstChild.remove();
    let template = document.querySelector('.statemask');
    this.config.rbStates.forEach((state, i) => {
      let item = template.cloneNode(true);
      this.stateElements.push(item);
      item.setAttribute('title', i);
      let nbrs = item.querySelectorAll('polygon');

      Array.from(nbrs).slice(1).forEach((nbr, j) => {
        let bit = (i >>> (5 - j)) % 2;
        if (!bit)
          nbr.classList.add('off');
      });
      this.stateGrid.appendChild(item);
      item.onmousedown = () => {
        this.settingState = !this.config.rbStates[i];
        this.setState(i);
      };
      item.onkeydown = (ev) => {
        if (ev.key == ' ' || ev.key == 'Enter') {
          this.setState(i, !this.config.rbStates[i]);
          this.updateRuleString();
          this.config.storeSessionConfigAsync();
        }
      }
      item.onmousemove = () => {
        this.settingState != null && this.setState(i);
      }
    });

    this.modal.onmouseup = this.modal.onmouseleave = () => {
      this.settingState = null;
      this.updateRuleString();
      this.config.storeSessionConfigAsync();
    };

    this.selectAvailable.onchange = () => {
      let rule = this.selectAvailable.value;
      this.config.setRbName(rule);
      let fn = this.config.availableRules[rule];
      if (fn) {
        let obj = JSON.parse(fn);
        delete obj[1].range;
        fn = JSON.stringify(obj);
        this.ruleString.value = fn.toString();
      }
      this.parseRuleString();
    };

    this.checkAll.onclick = () => this._handleCheckAll();

    this.ruleName.onchange = () => this.config.setRbName();

    this.ruleName.oninput = () => {
      if (this.ruleName.value.length > 0)
        this.addButton.disabled = false;
      else
        this.addButton.disabled = true;
    };

    this.ruleMiss.onchange = () => this.config.setRbMiss();
    this.ruleMatch.onchange = () => this.config.setRbMatch();

    this.ruleString.oninput = () => this.parseRuleString();
    this.ruleString.onfocus = () => this.ruleString.select();

    this.resetButton.onclick = () => this.clear();

    this.addButton.onclick = () => {
      let [rule, opts] = this.getRuleString();
      if (!rule) {
        rule = this._getMasks();
        opts = this._getOpts();
      }
      let fn = Hexular.util.ruleBuilder(rule, opts);
      this.config.addRule(this.ruleName.value, fn);
      this.board.setMessage(`Rule #${fn.n} added!`);
      console.log('Rule added:', [rule, opts]);
    };
  }

  clear() {
    this.config.setRbMiss([Config.defaults.rbMiss, Config.defaults.rbMissRel]);
    this.config.setRbMatch([Config.defaults.rbMatch, Config.defaults.rbMatchRel]);
    this.config.setRbName(Config.defaults.rbName);
    this.config.rbRel = Config.defaults.rbRel;
    this.setStates([], false);
    this.updateRuleString();
  }

  update() {
    let rbRules = Object.entries(this.config.availableRules)
    .filter(([rule, fn]) => fn.n != null).map(([rule, fn]) => rule);
    this.selectAvailable.replace(rbRules, this.ruleName.value, 1);
  }

  setState(idx, value=this.settingState) {
    let states = this.config.rbStates;
    states[idx] = value
    let item = this.stateElements[idx];
    if (value) {
      item.classList.add('active');
      if (!states.some((e) => !e)) {
        this.checkAll.classList.add('active');
      }
    }
    else {
      item.classList.remove('active');
      this.checkAll.classList.remove('active');
    }
  }

  setStates(array, value=this.settingState) {
    let states = this.config.rbStates;
    states.fill(false);
    this.stateElements.forEach((e) => e.classList.remove('active'));
    array.forEach((idx) => {
      if (states[idx] == null)
        return;
      states[idx] = value;
      if (value)
        this.stateElements[idx].classList.add('active');
      else
        this.stateElements[idx].classList.remove('active');
    });
    if (states.filter((e) => e).length == 64)
      this.checkAll.classList.add('active');
    else
      this.checkAll.classList.remove('active');
  }

  getRuleString() {
    let rule, opts;
    try {
      [rule, opts] = JSON.parse(this.ruleString.value);
    }
    catch {};
    if (!Array.isArray(rule))
      rule = null;
    opts = opts || {};
    return [rule, opts];
  }

  updateRuleString() {
    if (!this.updateRuleStringPending) {
      this.updateRuleStringPending = true;
      requestAnimationFrame(() => {
        let [strRule, strOpts] = this.getRuleString();
        let configRule = this._getMasks();
        let [miss, missRel] = [this.config.rbMiss, this.config.rbMissRel];
        let [match, matchRel] = [this.config.rbMatch, this.config.rbMatchRel];
        let rel = this.config.rbRel;
        let rule = configRule ? configRule : strRule;
        let opts = Hexular.util.merge({}, strOpts, {miss, match, missRel, matchRel, rel});
        let ruleString  = JSON.stringify([rule, opts]);
        if (this.ruleString.value != ruleString) {
          this.ruleString.value = ruleString;
          this.selectAvailable.value = null;
        }
        this.updateRuleStringPending = false;
      });
    }

  }

  parseRuleString() {
    let [rules, opts] = this.getRuleString();
    if (rules) {
      this.setStates(rules, true);
      let {miss, match, missRel, matchRel, rel} = opts;
      this.config.rbRel = rel;
      this.config.setRbMiss([miss, missRel]);
      this.config.setRbMatch([match, matchRel]);
      this.config.storeSessionConfigAsync();
    }
  }

  _handleCheckAll() {
    this.settingState = this.checkAll.classList.toggle('active');
    for (let i = 0; i < 64; i++)
      this.setState(i);
    this.settingState = null;
    this.updateRuleString();
    this.config.storeSessionConfigAsync();
  }

  _getMasks() {
    return this.config.rbStates.map((e, i) => e && i).filter((e) => e !== false);
  }

  _getOpts() {
    return {
      miss: this.config.rbMiss,
      missRel: this.config.rbMissRel,
      match: this.config.match,
      matchRel: this.config.matchRel,
    };
  }
}

class ThemeModal extends Modal {
  constructor(...args) {
    super(...args);
    this.selectTheme = document.querySelector('#select-theme').select;
    this.addTheme = document.querySelector('#add-theme');

    this.colors = Array.from(document.querySelectorAll('#color-controllers input'));
    this.backgroundColor = document.querySelector('#page-bg');
    this.modelBackgroundColor = document.querySelector('#model-bg');
    this.defaultColor = document.querySelector('#default-color');
    this.selectBlendMode = document.querySelector('#select-blend').select;
    this.alpha = document.querySelector('#alpha');
    this.cellGap = document.querySelector('#cell-gap');
    this.cellBorderWidth = document.querySelector('#cell-border-width');

    this.colors.forEach((el, idx) => {
      el.onchange = () => this.config.setColor(idx, el.value);
    });
    ['backgroundColor', 'modelBackgroundColor', 'defaultColor'].forEach((key) => {
      let el = this[key];
      el.onchange = () => this.config.setColorProperty(key, el.value);
    });
    this.selectBlendMode.onchange = (ev) => this._setBlendMode(this.selectBlendMode.value);
    this.alpha.onchange = (ev) => this._setAlpha(this.alpha.value);
    this.cellGap.onchange = (ev) => this._setCellGap(this.cellGap.value);
    this.cellBorderWidth.onchange = (ev) => this._setCellBorderWidth(this.cellBorderWidth.value);

    this.selectTheme.onchange = (ev) => this._handleSelectTheme();
    this.addTheme.onclick = (ev) => this._handleAddTheme();
  }

  reset() {
    this.selectTheme.value = this.config.theme;
    this._setAlpha(this.config.alpha);
    this._setBlendMode(this.config.blendMode);
    this._setCellGap(this.config.cellGap);
    this._setCellBorderWidth(this.config.cellBorderWidth);
  }

  update() {
    let themeNames = Object.keys(this.config.themes).sort();
    let defaultIdx = themeNames.indexOf('default');
    if (defaultIdx > 0) {
      themeNames.splice(defaultIdx, 1);
      themeNames.unshift('default');
    }
    this.selectTheme.replace(themeNames, this.config.theme, 1);
    for (let i = 0; i < this.colors.length; i++) {
      let color = this.colors[i];
      if (i < this.config.maxNumStates)
        color.classList.remove('hidden');
      else
        color.classList.add('hidden');
    }
  }

  _handleSelectTheme() {
    this.config.setTheme(this.selectTheme.value);
  }

  _handleAddTheme() {
    // TODO: Replace native prompt
    let themeName = window.prompt('Please enter a theme name:');
    if (themeName) {
      this.config.addTheme(themeName, this.config);
      this.config.setTheme(themeName);
    }
  }

  _setAlpha(value) {
    this.config.setAlpha(value != null ? value : this.config.alpha);
  }

  _setBlendMode(value) {
    this.config.setBlendMode(value != null ? value : this.config.blendMode);
  }

  _setCellGap(value) {
    this.config.setCellGap(parseFloat(value || 0));
    this.board.draw();
  }

  _setCellBorderWidth(value) {
    this.config.setCellBorderWidth(parseFloat(value || 0));
    this.board.draw();
  }
}

class TrbModal extends Modal {
  constructor(...args) {
    super(...args);
    this.ruleNameField = document.querySelector('#trb-rule-name');
    this.selectAvailable = document.querySelector('#trb-select-available').select;
    this.templateList = document.querySelector('#template-list');
    this.templateControls = [];
    this.templateStringField = document.querySelector('#template-string');
    this.templateMask = document.querySelector('#template-mask');
    this.templateButtons = Array(19).fill().map((_, i) => {
      let button = this.templateMask.querySelector(`#cell-${('0' + i).slice(-2)}`);
      button.idx = i;
      let title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.innerHTML = i.toString();
      button.appendChild(title);
      return button;
    });
    this.syms = [0, 1, 2, 3];
    this.symButtons = this.syms.map((e) => {
      let button = document.querySelector(`#trb-sym-${e}`)
      button.sym = e;
      return button;
    });
    this.deleteTemplateButton = document.querySelector('#trb-delete-template');
    this.clearTemplateButton = document.querySelector('#trb-clear-template');
    this.saveTemplateButton = document.querySelector('#trb-save-template');
    this.resetRuleButton = document.querySelector('#trb-reset-rule');
    this.saveRuleButton = document.querySelector('#trb-save-rule');

    this.ruleName = null;
    this.selectedName = null;
    this.selectedRuleDef = null;
    this.selectedControl = null;
    this.selectedControlIdx = null;
    this.templateDef = Hexular.util.merge({}, Config.defaults.trb.templateDef);
    this.buttonMode = null;

    this.ruleNameField.onchange = () => {
      this.setRuleName(this.ruleNameField.value);
      if (this.ruleNameField.value != this.selectAvailable.value)
        this.selectAvailable.value = null;
      this.saveConfig();
    }

    this.selectAvailable.onchange = () => {
      let rule = this.selectAvailable.value;
      this.loadRule(rule);
      this.saveConfig();
    };

    this.templateStringField.onchange = () => {
      this.parseTemplateString();
      this.saveConfig();
    }

    // Radio symmetry buttons
    let symButtonCb = (active, alts) => {
      for (let alt of alts)
        this.symButtons[alt].classList.remove('active');
      this.symButtons[active].classList.add('active');
      this.templateDef.sym = active;
      this.updateTemplateString();
      this.saveConfig();
    };
    this.symRadioGroup = new RadioGroup(this.syms, symButtonCb);
    this.symButtons.forEach((e) => e.onclick = () => this.symRadioGroup.set(e.sym));

    this.templateMask.onmousedown =
      this.templateMask.onmouseup =
      this.templateMask.onmouseover =
      this.templateMask.onmouseleave = (ev) => this.handleTemplateMouse(ev);
    this.templateMask.oncontextmenu = (ev) => ev.preventDefault();

    this.deleteTemplateButton.onclick = () => {
      this.selectedControl && this.selectedControl.delete();
    };
    this.clearTemplateButton.onclick = () => {
      this.clearTemplate();
      this.saveConfig();
    };
    this.saveTemplateButton.onclick = () => {
      this.saveTemplate();
      this.saveConfig();
    };
    this.resetRuleButton.onclick = () => {
      this.clear();
      this.saveConfig();
    };
    this.saveRuleButton.onclick = () => {
      this.saveRule();
    };
  }

  clear() {
    this.config.setTrb(Config.defaults.trb);
    this.loadConfig();
    this.updateTemplates();
  }

  update() {
    let rbRules = Object.entries(this.config.availableRules).filter(([rule, fn]) => fn.templates).map(([rule, fn]) => rule);
    this.selectAvailable.replace(rbRules, this.ruleName, 1);
    this.loadConfig();
  }

  reset() {
    this.loadConfig();
  }

  loadConfig() {
    let obj = this.config.trb;
    this.setRuleName(obj.ruleName);
    this.loadRule(obj.ruleName);
    this.updateTemplates(obj.templateDefs);
    this.loadTemplate(this.templateControls[obj.selectedControlIdx]);
    this.parseTemplateString(obj.templateDef);
  }

  saveConfig() {
    let keys = [
      'ruleName',
      'selectedControlIdx',
      'selectedName',
      'selectedRuleDef',
      'templateDefs',
      'templateDef',
    ];
    let obj = Hexular.util.extract(this, keys);
    obj.templateDefs = this.templateControls.map((e) => e.def);
    this.config.setTrb(obj);
  }

  setRuleName(name) {
    name = name || this.config.trb.ruleName;
    this.ruleName = name;
    this.ruleNameField.value = name;
  }

  loadRule(rule) {
    this.ruleNameField.value = rule;
    this.selectAvailable.value = rule;
    let fn = this.config.availableRules[rule];
    if (fn) {
      this.selectedRuleDef = fn.toObject()[0];
      this.selectedName = rule;
      this.setRuleName(rule);
      this.selectAvailable.value = rule;
      this.updateTemplates(this.selectedRuleDef);
    }
    else {
      this.selectedRuleDef = null;
      this.selectedName = null;
      this.setRuleName(null);
    }
  }

  saveRule() {
    let ruleName = this.ruleName;
    let ruleDef = this.templateControls.map((e) => e.def);
    let ruleFn = Hexular.util.templateRuleBuilder(ruleDef);
    this.config.addRule(ruleName, ruleFn);
    this.board.setMessage(`Rule "${ruleName}" saved!`)
  }

  checkRuleDirty() {
    if (!this.selectedRuleDef)
      return;
    let curString = JSON.stringify(this.templateControls.map((e) => e.def));
    let ruleString = JSON.stringify(this.selectedRuleDef);
    if (curString != ruleString) {
      this.loadRule();
    }
  }

  clearTemplate() {
    this.parseTemplateString(Config.defaults.trb.templateDef);
  }

  saveTemplate() {
    let templateDef = this.getTemplateDef();
    if (this.selectedControl) {
      this.selectedControl.update(templateDef);
    }
    else {
      let templateControl = new TemplateControl(this, templateDef)
      this.templateControls.push(templateControl);
      this.loadTemplate(templateControl);
    }
    this.checkRuleDirty();
  }

  loadTemplate(control) {
    this.templateControls.forEach((e) => e.controller.classList.remove('active'));
    this.deleteTemplateButton.disabled = true;
    this.selectedControl = control;
    this.selectedControlIdx = this.templateControls.indexOf(control);
    if (control) {
      control.controller.classList.add('active');
      this.parseTemplateString(control.def);
      this.deleteTemplateButton.disabled = false;
    }
  }

  getTemplateDef(newDef={}) {
    let def = {};
    try {
      def = JSON.parse(this.templateStringField.value);
    }
    catch {}
    let mergedDef = Hexular.util.merge({}, Config.defaults.trb.templateDef, def, newDef);
    if (!this.syms.includes(mergedDef.sym))
      mergedDef.sym = this.templateDef.sym
    return mergedDef;
  }

  updateTemplateString() {
    let def = this.getTemplateDef();
    def = Hexular.util.merge({}, def, this.templateDef);
    this.setTemplateDef(def);
  }

  parseTemplateString(newDef={}) {
    let def = this.getTemplateDef(newDef);
    this.setTemplateDef(def);
    this.setTemplateCells(def.states);
    this.symRadioGroup.set(def.sym);
  }

  setTemplateDef(def) {
    this.templateDef = def;
    this.templateString = this.templateStringField.value = Util.shallowPrettyJson(def, 1);
  }

  updateTemplates(defs=[]) {
    this.templateList.querySelectorAll('.template-controller').forEach((e) => e.remove());
    this.templateControls = defs.map((e) => new TemplateControl(this, e));
    this.checkRuleDirty();
  }

  setTemplateCell(idx) {
    if (this.buttonMode == null)
      return;
    this.templateDef.states[idx] = this.buttonMode;
    this.setTemplateButton(idx);
    this.updateTemplateString();
  }

  setTemplateCells(templateStates) {
    if (templateStates)
      this.templateDef.states = templateStates;
    this.templateButtons.forEach((e) => this.setTemplateButton(e.idx));
    this.updateTemplateString();
  }

  setTemplateButton(idx) {
    let button = this.templateButtons[idx];
    let state = this.templateDef.states[idx];
    button.setAttribute('class', null);
    if (state == 0)
      button.classList.add('inactive');
    else if (state == 1)
      button.classList.add('active');
  }

  handleTemplateMouse(ev) {
    if (ev.buttons & 4)
      return;
    // Remove buttonMode when cursor goes out of mask area
    if (ev.type == 'mouseleave' && this.buttonMode != null) {
      this._endButtonMode();
    }
    else if (ev.type == 'mouseup') {
      this._endButtonMode();
    }
    else if (this.templateButtons.includes(ev.target)) {
      let button = ev.target;
      if (ev.type == 'mousedown' && this.buttonMode == null) {
        let inc;
        if (ev.buttons & 1)
          inc = -1;
        else if (ev.buttons & 2)
          inc = 1;
        else
          return;
        this._startButtonModeFrom(button, inc);
      }
      this.setTemplateCell(button.idx);
      ev.preventDefault();
    }
  }

  _endButtonMode() {
    if (this.buttonMode == null)
      return;
    this.buttonMode = null;
    this.saveConfig();
  }

  _startButtonMode(mode) {
    this.buttonMode = mode;
  }

  _startButtonModeFrom(button, inc = -1) {
    let cur = this.config.trb.templateDef.states[button.idx];
    let mode = Hexular.math.mod(cur + 1 + inc, 3) - 1;
    this.buttonMode = mode;
  }
}

class TemplateControl {

  constructor(modal, def) {
    this.modal = modal;
    this.def = def;
    this.controller = document.createElement('div');
    this.controller.classList.add('template-controller');
    this.controller.draggable = true;
    this.controller.control = this;
    this.thumb = modal.templateMask.cloneNode(true);
    this.thumb.setAttribute('id', '');
    this.updateThumb();
    this.controller.appendChild(this.thumb);
    this.controller.onclick = () => {
      this.modal.loadTemplate(this.modal.selectedControl != this && this);
      this.modal.saveConfig();
    };
    modal.templateList.appendChild(this.controller);
    this.controller.ondragstart = (ev) => this.handleDrag(ev);
    this.controller.ondragover = (ev) => this.handleDragOver(ev);
    this.controller.ondrop = (ev) => this.handleDrop(ev);
  }

  delete() {
    this.modal.selectedControl == this && this.modal.loadTemplate();
    this.controller.remove();
    this.modal.templateControls = this.modal.templateControls.filter((e) => e != this);
    this.modal.saveConfig();
  }

  update(def={}) {
    this.def = Hexular.util.merge({}, this.def, def);
    this.updateThumb();
  }

  updateThumb() {
    this.thumb.querySelectorAll('polygon').forEach((polygon, elemIdx) => {
      let idx = 18 - elemIdx;
      polygon.setAttribute('id', '');
      polygon.setAttribute('class', '');
      let state = this.def.states[idx];
      if (state == 1)
        polygon.classList.add('active');
      else if (state == 0)
        polygon.classList.add('inactive');
    })
  }

  handleDrag(ev) {
    ev.dataTransfer.setData('text/plain', this.modal.templateControls.indexOf(this));
    ev.dataTransfer.dropEffect = 'move';
  }

  handleDragOver(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  }

  handleDrop(ev) {
    let sourceIdx = parseInt(ev.dataTransfer.getData('text/plain'));
    let targetIdx = this.modal.templateControls.indexOf(this);
    if (!isNaN(sourceIdx)) {
      let {y, height} = this.controller.getBoundingClientRect();
      y = ev.pageY - y;
      let newIdx = y < height / 2 ? targetIdx : targetIdx + 1;
      if (newIdx == sourceIdx || newIdx == sourceIdx + 1)
        return;
      if (newIdx > sourceIdx)
        newIdx --;
      let [droppedControl] = this.modal.templateControls.splice(sourceIdx, 1);
      this.modal.templateControls.splice(newIdx, 0, droppedControl);
      while (this.modal.templateList.firstChild)
        this.modal.templateList.firstChild.remove();
      this.modal.templateControls.forEach((control) => {
        this.modal.templateList.appendChild(control.controller);
      });
      this.modal.selectedControlIdx = this.modal.templateControls.indexOf(this.modal.selectedControl);
      this.modal.checkRuleDirty();
      this.modal.saveConfig();
    }
  }
}

// In light of the plugin system these are now mostly obsolete but should still work
const Examples = (() => {
  let fnCount = 0;

  let snippets = {
    addRule: `
      Board.config.addRule('newRule', (cell) =>
        cell.max > 2 ? cell.state + 1 : 0
      );
    `,
    deleteRule: `Board.config.deleteRule('ruleName');`,
    binaryRuleFactory: `Board.config.addRule('binary135', Util.binaryRuleFactory(1, 3, 5));`,
    symmetricRuleFactory: `Board.config.addRule('symmetric26', Util.symmetricRuleFactory(2, 6));`,
    drawCellImage: `
      Examples.drawCellImage(null, {
        clipType: Hexular.enums.TYPE_POINTY,
        fit: 'cover',
        translate: [0, 0],
        states: [1, 2],
      });
    `,
    drawBackgroundImage: `
      Examples.drawBackgroundImage(null, {
        fit: 'cover',
        scale: [1, 1],
      });
    `,
    rotateColors: `Examples.rotateColors();`,
    scaleTo: `Board.instance.scaleTo(Board.instance.scale * 2, 1000);`,
    maxNumStates: `Board.config.setMaxNumStates(64);`,
    setColorRange: `Util.setColorRange({range: [1, 12], h: 0, hDelta: 360});`,
    debugTimer: `
      // Writes interval to console and window.debugIntervals
      Util.debugTimer();
    `,
    findDuplicateSteps: `Util.findDuplicateSteps({halt: true});`,
    clearHooks: `
      // Hook used for e.g. debugTimer, findDuplicateSteps
      Board.instance.clearHooks('step');
    `,
    deleteSnippet: `
      // Reload page to restore built-in snippets
      Board.config.deleteSnippet('deleteSnippet');
    `,
    stateHistogram: `
      Util.stateHistogram();
    `,
    blurTool: `
      // Sets tool when window loses focus
      Board.config.blurTool = 'none';
    `,
    translateStates: `
      Util.translateStates([0, 1, -1]);
    `,
    preventClose: `Util.preventClose();`,
    setBreakpoints: `
      // Sets/reads the Board.config.meta.breakpoints value
      Util.setBreakpoints([100, 200, 300]);
    `,
    clearUtilHooks: `Util.clearUtilHooks();`,
    setLock: `Board.config.setLock();`,
  };

  Object.entries(snippets).forEach(([k, v]) => {
    snippets[k] = Util.indentTrim(v);
  });

  function remove(...idxs) {
    Object.entries(Board.instance.hooks).forEach(([key, values]) => {
      Board.instance.hooks[key] = values.filter((e) => !idxs.includes(e.fn.idx));
    });
    Board.instance.draw();
  }

  function removeAll() {
    let adapter = Board.adapter;
    let idxs = Array(fnCount + 1).fill().map((_, i) => i);
    remove(...idxs);
  }

  let examples = {
    snippets,
    remove,
    removeAll,

    drawBackgroundImage: (url, opts={}) => {
      let fnIdx = ++fnCount;
      (async () => {
        let defaults = {
          fit: 'cover',
          scale: [1, 1],
          translate: [0, 0],
          blend: 'source-over',
          alpha: 1,
          cb: null,
          adapter: null,
          insertionIndex: 0,
        }
        url = url || await Util.loadImageAsUrl();
        opts = Object.assign(defaults, opts);
        let img = new Image();
        img.src = url;
        img.onload = () => {
          let fn = (adapter) => {
            adapter = opts.adapter || adapter;
            let viewW = Board.instance.canvasWidth;
            let viewH = Board.instance.canvasHeight;
            let [w, h] = Util.fit([viewW, viewH], [img.width, img.height], opts.fit);
            w *= opts.scale[0];
            h *= opts.scale[1];
            let x = (viewW - w) / 2;
            let y = (viewH - h) / 2;
            opts = {...opts, x, y, w, h};
            adapter.context.save();
            adapter.context.setTransform(1, 0, 0, 1, ...opts.translate);
            opts.cb && opts.cb(opts, Board.instance);
            adapter.context.globalCompositeOperation = opts.blend;
            adapter.context.globalAlpha = opts.alpha,
            adapter.context.drawImage(img, opts.x, opts.y, opts.w, opts.h);
            adapter.context.restore();
          };
          fn.idx = fnIdx;
          Board.instance.addHook('draw', fn, {index: opts.insertionIndex});
          Board.instance.draw();
        };
      })();
      return fnIdx;
    },

    drawCellImage: (url, opts={}) => {
      let fnIdx = ++fnCount;
      (async () => {
        let defaults = {
          clipType: Hexular.enums.TYPE_POINTY,
          clipScale: 1,
          fit: 'cover',
          scale: [1, 1],
          translate: [0, 0],
          blend: 'source-over',
          alpha: 1,
          states: [1],
          cb: null,
          adapter: null,
        };
        if (!url);
        url = url || await Util.loadImageAsUrl();
        opts = Object.assign(defaults, opts);
        let img = new Image();
        img.src = url;
        img.onload = () => {
          let config = Board.config;
          let fn = (adapter) => {
            adapter = opts.adapter || adapter;
            let parent = [config.innerRadius * 2, config.innerRadius * 2];
            let [w, h] = Util.fit(parent, [img.width, img.height], opts.fit);
            w *= opts.scale[0];
            h *= opts.scale[1];
            Board.model.eachCell((cell) => {
              if (!opts.states.includes(cell.state))
                return;
              adapter.context.save();
              adapter.context.translate(...Board.model.cellMap.get(cell));
              adapter.context.translate(...opts.translate);
              opts = {...opts, x: -w / 2, y: -h / 2, w, h};
              opts.cb && opts.cb(cell, opts, Board.instance);
              adapter.context.globalCompositeOperation = opts.blend;
              adapter.context.globalAlpha = opts.alpha;
              if (opts.clipType) {
                let clipR = adapter.config.innerRadius * opts.clipScale;
                adapter.drawShape([0, 0], clipR, {type: opts.clipType, clip: true});
              }
              adapter.context.drawImage(img, 0, 0, img.width, img.height, opts.x, opts.y, opts.w, opts.h);
              adapter.context.restore();
            });
          };
          fn.idx = ++fnCount;
          Board.instance.addHook('draw', fn, {index: opts.insertionIndex});
          Board.instance.draw();
        }
      })();
      return fnIdx;
    },

     rotateColors: (offset=1) => {
      Board.instance.addHook('step', () => {
        Util.rotateColors(offset);
      });
    },
  }

  return examples;
})();

const Presets = {
  default: new Preset(Array(12).fill('ennead')),

  bicameralJellyfish: new Preset(
    {
      defaultRule: 'average',
      filters: {clipBottomFilter: true, modFilter: false, edgeFilter: true}
    },
    Object.assign(Array(12).fill('average'), Array(6).fill('bicameral'))
  ),

  binaryFlake: new Preset(Object.assign(Array(10).fill('stepUp'), ['binary1'])),

  enneadPlus: new Preset(
    {filters: {clipBottomFilter: true, modFilter: true, edgeFilter: true}},
    Array(12).fill('enneadPlus')
  ),

  squiggletownClassic: new Preset(Array(13).fill('squiggle6')),

  gliderWorld: new Preset({filters: {binaryFilter: true, edgeFilter: true}}, [
    'ennead',
    'ennead',
  ]),

  grayGoo: new Preset({nh: 19}, Object.assign(Array(10).fill('average'), ['total', 'total'])),

  rainbowRoad: new Preset(Object.assign(Array(12).fill('stepUp'), ['fractalLeft'])),

  rhombicLife: new Preset({filters: {modFilter: false}}, ['rhombicLife', 'rhombicLife']),

  averager: new Preset({filters: {edgeFilter: true}}, Object.assign(Array(12).fill('average'), ['stepDown'])),
  count18: new Preset(
    {filters: {edgeFilter: true, modFilter: false}, nh: 18},
    Object.assign(Array(19).fill('average'), ['count'])
  ),
  identity: new Preset({defaultRule: 'identityRule'}, Array(12).fill('identityRule')),
};

const Rules = (() => {
  const coreRules = Hexular.rules;
  const customRules = {
    binary1: Util.binaryRuleFactory(1),

    binary2: Util.binaryRuleFactory(2),

    binary3: Util.binaryRuleFactory(3),

    binary12: Util.binaryRuleFactory(1, 2),

    binary23: Util.binaryRuleFactory(2, 3),

    binary34: Util.binaryRuleFactory(3, 4),

    symmetric36: Util.symmetricRuleFactory(3, 6),

    stepDown: (cell) => cell.state - 1,

    stepUp: (cell) => cell.state + 1,

    xor: (cell) => cell.map.reduce((a, e) => e ^ a, 0),

    xorCount: (cell) => cell.count % 2,

    average: (cell) => cell.average,

    count: (cell) => cell.count,

    total: (cell) => cell.total,

    min: (cell) => cell.min,

    max: (cell) => cell.max,

    minUp: (cell) => cell.min + 1,

    maxDown: (cell) => cell.max - 1,

    rhombicLife: (cell) => {
      let t = cell.with[6].total + cell.nbrs[7].state + cell.nbrs[10].state;
      return cell.state && (t == 2 || t == 3) || t == 3 ? 1 : 0;
    },

    squiggle6: (cell) => {
      let h = cell.histogram;
      for (let i = cell.state; i < 7; i++)
        if (i && h[i])
          return cell.state + i;
      return cell.average;
    },

    sub1: (cell) => {
      let m = cell.map;
      let c = 0;
      for (let i = 0; i < m.length; i++) {
        if (m[i] > cell.state) {
          c ++;
          if (c > 1) {
            return cell.average;
          }
        }
      }
      if (c == 1)
        return cell.state - 1;
      return cell.average;
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

    // SRB rules

    bicameral: Hexular.util.ruleBuilder([
      0b000011,
      0b000110,
      0b001011,
      0b001100,
      0b001110,
      0b010010,
      0b010011,
      0b010110,
      0b011000,
      0b011001,
      0b011010,
      0b011011,
      0b011100,
      0b011101,
      0b011110,
      0b011111,
      0b100001,
      0b100011,
      0b100110,
      0b101011,
      0b101101,
      0b101110,
      0b110000,
      0b110001,
      0b110010,
      0b110011,
      0b110100,
      0b110101,
      0b110110,
      0b110111,
      0b111011,
      0b111110,
      0b111111,
    ], {matchRel: true, rel: true}),

    bicameralite: Hexular.util.ruleBuilder([
      0b000011,
      0b000110,
      0b001100,
      0b001110,
      0b010010,
      0b011000,
      0b011011,
      0b011100,
      0b011110,
      0b011111,
      0b100001,
      0b100011,
      0b101101,
      0b110000,
      0b110001,
      0b110011,
      0b110110,
      0b110111,
      0b111011,
      0b111110,
      0b111111,
    ], {matchRel: true, rel: true}),

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
    ], {matchRel: true}),

    enneadPlus: Hexular.util.ruleBuilder([
      0b001001,
      0b010010,
      0b100100,
      0b000011,
      0b000110,
      0b001100,
      0b011000,
      0b110000,
      0b100001,
    ], {miss: -1, missRel: true, matchRel: true, rel: true}),

    hexad: Hexular.util.ruleBuilder([
      0b000011,
      0b000110,
      0b001100,
      0b011000,
      0b110000,
      0b100001,
    ], {miss: -1, missRel: true, matchRel: true}),

    expander: Hexular.util.ruleBuilder([
      0b000001,
      0b000010,
      0b000011,
      0b000100,
      0b000110,
      0b000111,
      0b001000,
      0b001100,
      0b001110,
      0b001111,
      0b010000,
      0b011000,
      0b011100,
      0b011110,
      0b100000,
      0b100001,
      0b100011,
      0b100111,
      0b110000,
      0b110001,
      0b110011,
      0b111000,
      0b111001,
      0b111100,
      0b111111,
    ], {miss: -1, match: 1, missRel: true, matchRel: true}),

    probe: Hexular.util.ruleBuilder([
      0b000011,
      0b000110,
      0b001001,
      0b001100,
      0b001111,
      0b010010,
      0b011000,
      0b011011,
      0b011110,
      0b100001,
      0b100100,
      0b100111,
      0b101101,
      0b110000,
      0b110011,
      0b110110,
      0b111001,
      0b111100,
      0b111111,
    ]),

    triforce: Hexular.util.ruleBuilder([
      0b000101,
      0b000110,
      0b001001,
      0b001010,
      0b001011,
      0b001101,
      0b001111,
      0b010001,
      0b010010,
      0b010011,
      0b010100,
      0b010110,
      0b011000,
      0b011001,
      0b011010,
      0b011011,
      0b011110,
      0b100001,
      0b100010,
      0b100100,
      0b100101,
      0b100110,
      0b100111,
      0b101000,
      0b101001,
      0b101100,
      0b101101,
      0b110010,
      0b110011,
      0b110100,
      0b110110,
      0b111001,
      0b111100,
      0b111111,
    ]),

    fractalLeft: Hexular.util.ruleBuilder([
      0b010000,
      0b000100,
      0b000001,
    ]),

    fractalRight: Hexular.util.ruleBuilder([
      0b100000,
      0b001000,
      0b000010,
    ]),

    lineFilter: Hexular.util.ruleBuilder([
      0b000000,
      0b001001,
      0b010010,
      0b100100,
    ], {miss: 1, match: 0}),

    retractor: Hexular.util.ruleBuilder([
      0b000111,
      0b001110,
      0b011100,
      0b111000,
      0b110001,
      0b100011,
      0b100111,
      0b001111,
      0b011110,
      0b111100,
      0b111001,
      0b110011,
    ], {match: -1, missRel: true, matchRel: true}),

    uncial: Hexular.util.ruleBuilder([
      0b000011,
      0b000110,
      0b000111,
      0b001100,
      0b001110,
      0b011000,
      0b011100,
      0b100001,
      0b100011,
      0b110000,
      0b110001,
      0b111000,
    ], {miss: -1, missRel: true, matchRel: true, rel: true}),

    // TRB Rules

    tripleReactor: Hexular.util.templateRuleBuilder([{
      applyFn: (a, b) => a == b,
      matchFn: (c, a, b) => c,
      match: 1,
      miss: 0,
      matchRel: 1,
      missRel: 1,
      sym: 1,
      states: [-1, 0, 0, 0, 0, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    },
    {
      applyFn: (a, b) => a == b,
      matchFn: (c, a, b) => c,
      match: 1,
      miss: 0,
      matchRel: 1,
      missRel: 1,
      sym: 1,
      states: [-1, 1, 1, 0, 1, 1, 0, -1, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, 0],
    },
    {
      applyFn: (a, b) => a == b,
      matchFn: (c, a, b) => c,
      match: 1,
      miss: 0,
      matchRel: 1,
      missRel: 1,
      sym: 1,
      states: [-1, -1, 1, -1, -1, 1, -1, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, 1, -1],
    },
    {
      applyFn: (a, b) => a == b,
      matchFn: (c, a, b) => c,
      match: -1,
      miss: 0,
      matchRel: 1,
      missRel: 1,
      sym: 0,
      states: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    }]),
  };
  let entries = Object.entries(customRules);
  entries.sort((a, b) => {
    let strOrder = a[0].localeCompare(b[0]);
    let [an, bn] = [a[1], b[1]].map((e) => e.n != null ? 1 : -1);
    return an ^ bn == -2 ? an - bn : strOrder;
  });
  let rules = Object.assign({}, coreRules, Config.toObject(entries));
  return rules;
})();

const Themes = (() => {
  // Original 2017 color palette
  let classicColors = Object.assign([], Config.defaults.colors, [
    'transparent',
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
  ]);

  let fruitcake = Object.assign([], Config.defaults.colors, [
    null,
    '#b7bb95',
    '#8e996d',
    '#796d53',
    '#68873b',
    '#8a3731',
    '#d4872e',
    '#ddc734',
    '#89c828',
    '#64a8ab',
    '#4973bb',
    '#aa5ebb',
  ]);

  let rainbow = Object.assign([], Config.defaults.colors, [
    'transparent',
    '#ff0000',
    '#ffaa00',
    '#aaff00',
    '#00ff00',
    '#00ffff',
    '#00aaff',
    '#0066ff',
    '#0000ff',
    '#aa00ff',
    '#ff00ff',
    '#ff00aa',
  ]);

  let themes = {
    default: {
    },
    smooth: {
      cellGap: -0.5,
    },
    mango: {
      colors: [
        null,
        null,
        null,
        null,
        null,
        '#cc5555',
        '#ef9f00',
        '#eedd00',
        '#6fbf44',
        '#33cccc',
        '#3366ee',
        '#cc33ee',
      ],
    },
    beige: {
      modelBackgroundColor: '#efefe7',
    },
    beigeBlobular: {
      modelBackgroundColor: '#efefe7',
      cellGap: -12.75,
    },
    dark: {
      backgroundColor: '#111111',
      modelBackgroundColor: '#000000',
      cellGap: -0.5,
      colors: Hexular.util.merge([], classicColors, [
        null,
        '#888888',
        '#aaaaaa',
        '#cccccc',
        '#eeeeee',
      ]),
    },
    darkRainbow: {
      backgroundColor: '#111111',
      modelBackgroundColor: '#000000',
      cellGap: -0.5,
      colors: rainbow,
    },
    darkLight: {
      backgroundColor: '#24222d',
      modelBackgroundColor: '#3a3545',
      colors: Hexular.util.merge(Config.defaults.colors.slice(), [
        null,
        '#5d524b',
        '#666655',
        '#99998f',
        '#ccccbb',
      ]),
    },
    smoothChalkRainbow: {
      backgroundColor: '#111111',
      modelBackgroundColor: '#001122',
      cellGap: -13,
      cellBorderWidth: 2,
      colors: [
        null,
        '#664466',
        '#dd2200',
        '#ffaa00',
        '#ddee00',
        '#00ee00',
        '#00dddd',
        '#00aaff',
        '#0066cc',
        '#3333ff',
        '#dd00dd',
        '#eeeedd',
      ],
    },
    vegetableGarden: {
      colors: [
        null,
        '#ddd7c3',
        '#bdbaa4',
        '#8b9e62',
        '#63a55c',
        '#54a298',
        '#47496e',
        '#6e5765',
        '#6a5f58',
        '#474743',
        '#393a31',
        '#39423a',
      ],
    },
    hardRainbow: {
      backgroundColor: '#111111',
      modelBackgroundColor: '#000000',
      colors: [
        null,
        '#ffffff',
        '#ff00ff',
        '#0000ff',
        '#00ffff',
        '#00ff00',
        '#ffff00',
        '#ff0000',
        'transparent',
        'transparent',
        'transparent',
        'transparent',
      ],
    },
    monogram: {
      backgroundColor: '#cce5e2',
      modelBackgroundColor: '#eeeedd',
      cellGap: 1.33,
      colors: Hexular.util.merge(new Array(64).fill('#33332f'), ['#eed']),
    },
    sovietFruitcake: {
      backgroundColor: '#f8f8f8',
      modelBackgroundColor: '#edf0e7',
      cellGap: 5,
      cellBorder: 1,
      colors: [
        null,
        '#b7bb95',
        '#8e996d',
        '#796d53',
        '#68873b',
        '#8a3731',
        '#d4872e',
        '#ddc734',
        '#89c828',
        '#64a8ab',
        '#4973bb',
        '#aa5ebb',
      ],
    },
    extendedDarkFruitcake: {
      backgroundColor: '#4e4e47',
      modelBackgroundColor: '#3e413a',
      cellGap: 0,
      cellBorder: 1,
      colors: [
        null,
        '#9b8c65',
        '#8e996d',
        '#796d53',
        '#68873b',
        '#8a3731',
        '#d4872e',
        '#ddc734',
        '#89c828',
        '#64a8ab',
        '#4973bb',
        '#aa5ebb',
        '#374a65',
        '#5d5b70',
        '#3a2e2e',
        '#342d0a',
      ],
    },

    spectral64: {
      backgroundColor: '#223030',
      modelBackgroundColor: '#182b2e',
      defaultColor: '#e7e7e7',
      cellGap: 4.33,
      colors: [null].concat(Color.from(Array(63).fill().map((_, i) => Color.hslaToRgba(i * 360 / 63, 0.5, 0.5)))),
    },

    transparent: {
      backgroundColor: '#0000',
      modelBackgroundColor: '#0000',
      cellGap: -0.5,
    }
  };
  return themes;
})();

/**
 * jscolor - JavaScript Color Picker
 *
 * @link    http://jscolor.com
 * @license For open source use: GPLv3
 *          For commercial use: JSColor Commercial License
 * @author  Jan Odvarko
 * @version 2.0.5
 *
 * See usage examples at http://jscolor.com/examples/
 */

 /* Modified 2020 for use with Hexular by Graham Steele */


"use strict";


if (!window.jscolor) { window.jscolor = (function () {


var jsc = {


  register : function () {
    jsc.attachDOMReadyEvent(jsc.init);
    jsc.attachEvent(document, 'mousedown', jsc.onDocumentMouseDown);
    jsc.attachEvent(document, 'touchstart', jsc.onDocumentTouchStart);
    jsc.attachEvent(window, 'resize', jsc.onWindowResize);
  },


  init : function () {
    if (jsc.jscolor.lookupClass) {
      jsc.jscolor.installByClassName(jsc.jscolor.lookupClass);
    }
  },


  tryInstallOnElements : function (elms, className) {
    var matchClass = new RegExp('(^|\\s)(' + className + ')(\\s*(\\{[^}]*\\})|\\s|$)', 'i');

    for (var i = 0; i < elms.length; i += 1) {
      if (elms[i].type !== undefined && elms[i].type.toLowerCase() == 'color') {
        if (jsc.isColorAttrSupported) {
          // skip inputs of type 'color' if supported by the browser
          continue;
        }
      }
      var m;
      if (!elms[i].jscolor && elms[i].className && (m = elms[i].className.match(matchClass))) {
        var targetElm = elms[i];
        var optsStr = null;

        var dataOptions = jsc.getDataAttr(targetElm, 'jscolor');
        if (dataOptions !== null) {
          optsStr = dataOptions;
        } else if (m[4]) {
          optsStr = m[4];
        }

        var opts = {};
        if (optsStr) {
          try {
            opts = (new Function ('return (' + optsStr + ')'))();
          } catch(eParseError) {
            jsc.warn('Error parsing jscolor options: ' + eParseError + ':\n' + optsStr);
          }
        }
        targetElm.jscolor = new jsc.jscolor(targetElm, opts);
      }
    }
  },


  isColorAttrSupported : (function () {
    var elm = document.createElement('input');
    if (elm.setAttribute) {
      elm.setAttribute('type', 'color');
      if (elm.type.toLowerCase() == 'color') {
        return true;
      }
    }
    return false;
  })(),


  isCanvasSupported : (function () {
    var elm = document.createElement('canvas');
    return !!(elm.getContext && elm.getContext('2d'));
  })(),


  fetchElement : function (mixed) {
    return typeof mixed === 'string' ? document.getElementById(mixed) : mixed;
  },


  isElementType : function (elm, type) {
    return elm.nodeName.toLowerCase() === type.toLowerCase();
  },


  getDataAttr : function (el, name) {
    var attrName = 'data-' + name;
    var attrValue = el.getAttribute(attrName);
    if (attrValue !== null) {
      return attrValue;
    }
    return null;
  },


  attachEvent : function (el, evnt, func) {
    if (el.addEventListener) {
      el.addEventListener(evnt, func, {capture: false, passive: false});
    } else if (el.attachEvent) {
      el.attachEvent('on' + evnt, func);
    }
  },


  detachEvent : function (el, evnt, func) {
    if (el.removeEventListener) {
      el.removeEventListener(evnt, func, {capture: false, passive: false});
    } else if (el.detachEvent) {
      el.detachEvent('on' + evnt, func);
    }
  },


  _attachedGroupEvents : {},


  attachGroupEvent : function (groupName, el, evnt, func) {
    if (!jsc._attachedGroupEvents.hasOwnProperty(groupName)) {
      jsc._attachedGroupEvents[groupName] = [];
    }
    jsc._attachedGroupEvents[groupName].push([el, evnt, func]);
    jsc.attachEvent(el, evnt, func);
  },


  detachGroupEvents : function (groupName) {
    if (jsc._attachedGroupEvents.hasOwnProperty(groupName)) {
      for (var i = 0; i < jsc._attachedGroupEvents[groupName].length; i += 1) {
        var evt = jsc._attachedGroupEvents[groupName][i];
        jsc.detachEvent(evt[0], evt[1], evt[2]);
      }
      delete jsc._attachedGroupEvents[groupName];
    }
  },


  attachDOMReadyEvent : function (func) {
    var fired = false;
    var fireOnce = function () {
      if (!fired) {
        fired = true;
        func();
      }
    };

    if (document.readyState === 'complete') {
      setTimeout(fireOnce, 1); // async
      return;
    }

    if (document.addEventListener) {
      document.addEventListener('DOMContentLoaded', fireOnce, false);

      // Fallback
      window.addEventListener('load', fireOnce, false);

    } else if (document.attachEvent) {
      // IE
      document.attachEvent('onreadystatechange', function () {
        if (document.readyState === 'complete') {
          document.detachEvent('onreadystatechange', arguments.callee);
          fireOnce();
        }
      })

      // Fallback
      window.attachEvent('onload', fireOnce);

      // IE7/8
      if (document.documentElement.doScroll && window == window.top) {
        var tryScroll = function () {
          if (!document.body) { return; }
          try {
            document.documentElement.doScroll('left');
            fireOnce();
          } catch (e) {
            setTimeout(tryScroll, 1);
          }
        };
        tryScroll();
      }
    }
  },


  warn : function (msg) {
    if (window.console && window.console.warn) {
      window.console.warn(msg);
    }
  },


  preventDefault : function (e) {
    if (e.preventDefault) { e.preventDefault(); }
    e.returnValue = false;
  },


  captureTarget : function (target) {
    // IE
    if (target.setCapture) {
      jsc._capturedTarget = target;
      jsc._capturedTarget.setCapture();
    }
  },


  releaseTarget : function () {
    // IE
    if (jsc._capturedTarget) {
      jsc._capturedTarget.releaseCapture();
      jsc._capturedTarget = null;
    }
  },


  fireEvent : function (el, evnt) {
    if (!el) {
      return;
    }
    if (document.createEvent) {
      var ev = document.createEvent('HTMLEvents');
      ev.initEvent(evnt, true, true);
      el.dispatchEvent(ev);
    } else if (document.createEventObject) {
      var ev = document.createEventObject();
      el.fireEvent('on' + evnt, ev);
    } else if (el['on' + evnt]) { // alternatively use the traditional event model
      el['on' + evnt]();
    }
  },


  classNameToList : function (className) {
    return className.replace(/^\s+|\s+$/g, '').split(/\s+/);
  },


  // The className parameter (str) can only contain a single class name
  hasClass : function (elm, className) {
    if (!className) {
      return false;
    }
    return -1 != (' ' + elm.className.replace(/\s+/g, ' ') + ' ').indexOf(' ' + className + ' ');
  },


  // The className parameter (str) can contain multiple class names separated by whitespace
  setClass : function (elm, className) {
    var classList = jsc.classNameToList(className);
    for (var i = 0; i < classList.length; i += 1) {
      if (!jsc.hasClass(elm, classList[i])) {
        elm.className += (elm.className ? ' ' : '') + classList[i];
      }
    }
  },


  // The className parameter (str) can contain multiple class names separated by whitespace
  unsetClass : function (elm, className) {
    var classList = jsc.classNameToList(className);
    for (var i = 0; i < classList.length; i += 1) {
      var repl = new RegExp(
        '^\\s*' + classList[i] + '\\s*|' +
        '\\s*' + classList[i] + '\\s*$|' +
        '\\s+' + classList[i] + '(\\s+)',
        'g'
      );
      elm.className = elm.className.replace(repl, '$1');
    }
  },


  getStyle : function (elm) {
    return window.getComputedStyle ? window.getComputedStyle(elm) : elm.currentStyle;
  },


  setStyle : (function () {
    var helper = document.createElement('div');
    var getSupportedProp = function (names) {
      for (var i = 0; i < names.length; i += 1) {
        if (names[i] in helper.style) {
          return names[i];
        }
      }
    };
    var props = {
      borderRadius: getSupportedProp(['borderRadius', 'MozBorderRadius', 'webkitBorderRadius']),
      boxShadow: getSupportedProp(['boxShadow', 'MozBoxShadow', 'webkitBoxShadow'])
    };
    return function (elm, prop, value) {
      switch (prop.toLowerCase()) {
      case 'opacity':
        var alphaOpacity = Math.round(parseFloat(value) * 100);
        elm.style.opacity = value;
        elm.style.filter = 'alpha(opacity=' + alphaOpacity + ')';
        break;
      default:
        elm.style[props[prop]] = value;
        break;
      }
    };
  })(),


  setBorderRadius : function (elm, value) {
    jsc.setStyle(elm, 'borderRadius', value || '0');
  },


  setBoxShadow : function (elm, value) {
    jsc.setStyle(elm, 'boxShadow', value || 'none');
  },


  getElementPos : function (e, relativeToViewport) {
    var x=0, y=0;
    var rect = e.getBoundingClientRect();
    x = rect.left;
    y = rect.top;
    if (!relativeToViewport) {
      var viewPos = jsc.getViewPos();
      x += viewPos[0];
      y += viewPos[1];
    }
    return [x, y];
  },


  getElementSize : function (e) {
    return [e.offsetWidth, e.offsetHeight];
  },


  // get pointer's X/Y coordinates relative to viewport
  getAbsPointerPos : function (e) {
    if (!e) { e = window.event; }
    var x = 0, y = 0;
    if (typeof e.changedTouches !== 'undefined' && e.changedTouches.length) {
      // touch devices
      x = e.changedTouches[0].clientX;
      y = e.changedTouches[0].clientY;
    } else if (typeof e.clientX === 'number') {
      x = e.clientX;
      y = e.clientY;
    }
    return { x: x, y: y };
  },


  // get pointer's X/Y coordinates relative to target element
  getRelPointerPos : function (e) {
    if (!e) { e = window.event; }
    var target = e.target || e.srcElement;
    var targetRect = target.getBoundingClientRect();

    var x = 0, y = 0;

    var clientX = 0, clientY = 0;
    if (typeof e.changedTouches !== 'undefined' && e.changedTouches.length) {
      // touch devices
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else if (typeof e.clientX === 'number') {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    x = clientX - targetRect.left;
    y = clientY - targetRect.top;
    return { x: x, y: y };
  },


  getViewPos : function () {
    var doc = document.documentElement;
    return [
      (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0),
      (window.pageYOffset || doc.scrollTop) - (doc.clientTop || 0)
    ];
  },


  getViewSize : function () {
    var doc = document.documentElement;
    return [
      (window.innerWidth || doc.clientWidth),
      (window.innerHeight || doc.clientHeight),
    ];
  },


  redrawPosition : function () {

    if (jsc.picker && jsc.picker.owner) {
      var thisObj = jsc.picker.owner;

      var tp, vp;

      if (thisObj.fixed) {
        // Fixed elements are positioned relative to viewport,
        // therefore we can ignore the scroll offset
        tp = jsc.getElementPos(thisObj.targetElement, true); // target pos
        vp = [0, 0]; // view pos
      } else {
        tp = jsc.getElementPos(thisObj.targetElement); // target pos
        vp = jsc.getViewPos(); // view pos
      }

      var ts = jsc.getElementSize(thisObj.targetElement); // target size
      var vs = jsc.getViewSize(); // view size
      var ps = jsc.getPickerOuterDims(thisObj); // picker size
      var a, b, c;
      switch (thisObj.position.toLowerCase()) {
        case 'left': a=1; b=0; c=-1; break;
        case 'right':a=1; b=0; c=1; break;
        case 'top':  a=0; b=1; c=-1; break;
        default:     a=0; b=1; c=1; break;
      }
      var l = (ts[b]+ps[b])/2;

      // compute picker position
      if (!thisObj.smartPosition) {
        var pp = [
          tp[a],
          tp[b]+ts[b]-l+l*c
        ];
      } else {
        var pp = [
          -vp[a]+tp[a]+ps[a] > vs[a] ?
            (-vp[a]+tp[a]+ts[a]/2 > vs[a]/2 && tp[a]+ts[a]-ps[a] >= 0 ? tp[a]+ts[a]-ps[a] : tp[a]) :
            tp[a],
          -vp[b]+tp[b]+ts[b]+ps[b]-l+l*c > vs[b] ?
            (-vp[b]+tp[b]+ts[b]/2 > vs[b]/2 && tp[b]+ts[b]-l-l*c >= 0 ? tp[b]+ts[b]-l-l*c : tp[b]+ts[b]-l+l*c) :
            (tp[b]+ts[b]-l+l*c >= 0 ? tp[b]+ts[b]-l+l*c : tp[b]+ts[b]-l-l*c)
        ];
      }

      var x = pp[a];
      var y = pp[b];
      var positionValue = thisObj.fixed ? 'fixed' : 'absolute';
      var contractShadow =
        (pp[0] + ps[0] > tp[0] || pp[0] < tp[0] + ts[0]) &&
        (pp[1] + ps[1] < tp[1] + ts[1]);

      jsc._drawPosition(thisObj, x, y, positionValue, contractShadow);
    }
  },


  _drawPosition : function (thisObj, x, y, positionValue, contractShadow) {
    var vShadow = contractShadow ? 0 : thisObj.shadowBlur; // px

    jsc.picker.wrap.style.position = positionValue;
    jsc.picker.wrap.style.left = x + 'px';
    jsc.picker.wrap.style.top = y + 'px';

    jsc.setBoxShadow(
      jsc.picker.boxS,
      thisObj.shadow ?
        new jsc.BoxShadow(0, vShadow, thisObj.shadowBlur, 0, thisObj.shadowColor) :
        null);
  },


  getPickerDims : function (thisObj) {
    var displaySlider = !!jsc.getSliderComponent(thisObj);
    var dims = [
      2 * thisObj.insetWidth + 2 * thisObj.padding + thisObj.width +
        (displaySlider ? 2 * thisObj.insetWidth + jsc.getPadToSliderPadding(thisObj) + thisObj.sliderSize : 0),
      2 * thisObj.insetWidth + 2 * thisObj.padding + thisObj.height +
        (thisObj.closable ? 2 * thisObj.insetWidth + thisObj.padding + thisObj.buttonHeight : 0)
    ];
    return dims;
  },


  getPickerOuterDims : function (thisObj) {
    var dims = jsc.getPickerDims(thisObj);
    return [
      dims[0] + 2 * thisObj.borderWidth,
      dims[1] + 2 * thisObj.borderWidth
    ];
  },


  getPadToSliderPadding : function (thisObj) {
    return Math.max(thisObj.padding, 1.5 * (2 * thisObj.pointerBorderWidth + thisObj.pointerThickness));
  },


  getPadYComponent : function (thisObj) {
    switch (thisObj.mode.charAt(1).toLowerCase()) {
      case 'v': return 'v'; break;
    }
    return 's';
  },


  getSliderComponent : function (thisObj) {
    if (thisObj.mode.length > 2) {
      switch (thisObj.mode.charAt(2).toLowerCase()) {
        case 's': return 's'; break;
        case 'v': return 'v'; break;
      }
    }
    return null;
  },


  onDocumentMouseDown : function (e) {
    if (!e) { e = window.event; }
    var target = e.target || e.srcElement;

    if (target._jscLinkedInstance) {
      if (target._jscLinkedInstance.showOnClick) {
        target._jscLinkedInstance.show();
      }
    } else if (target._jscControlName) {
      jsc.onControlPointerStart(e, target, target._jscControlName, 'mouse');
    } else {
      // Mouse is outside the picker controls -> hide the color picker!
      if (jsc.picker && jsc.picker.owner) {
        jsc.picker.owner.hide();
      }
    }
  },


  onDocumentTouchStart : function (e) {
    if (!e) { e = window.event; }
    var target = e.target || e.srcElement;

    if (target._jscLinkedInstance) {
      if (target._jscLinkedInstance.showOnClick) {
        target._jscLinkedInstance.show();
      }
    } else if (target._jscControlName) {
      jsc.onControlPointerStart(e, target, target._jscControlName, 'touch');
    } else {
      if (jsc.picker && jsc.picker.owner) {
        jsc.picker.owner.hide();
      }
    }
  },


  onWindowResize : function (e) {
    jsc.redrawPosition();
  },


  onParentScroll : function (e) {
    // hide the picker when one of the parent elements is scrolled
    if (jsc.picker && jsc.picker.owner) {
      jsc.picker.owner.hide();
    }
  },


  _pointerMoveEvent : {
    mouse: 'mousemove',
    touch: 'touchmove'
  },
  _pointerEndEvent : {
    mouse: 'mouseup',
    touch: 'touchend'
  },


  _pointerOrigin : null,
  _capturedTarget : null,


  onControlPointerStart : function (e, target, controlName, pointerType) {
    var thisObj = target._jscInstance;

    jsc.preventDefault(e);
    jsc.captureTarget(target);

    var registerDragEvents = function (doc, offset) {
      jsc.attachGroupEvent('drag', doc, jsc._pointerMoveEvent[pointerType],
        jsc.onDocumentPointerMove(e, target, controlName, pointerType, offset));
      jsc.attachGroupEvent('drag', doc, jsc._pointerEndEvent[pointerType],
        jsc.onDocumentPointerEnd(e, target, controlName, pointerType));
    };

    registerDragEvents(document, [0, 0]);

    if (window.parent && window.frameElement) {
      var rect = window.frameElement.getBoundingClientRect();
      var ofs = [-rect.left, -rect.top];
      registerDragEvents(window.parent.window.document, ofs);
    }

    var abs = jsc.getAbsPointerPos(e);
    var rel = jsc.getRelPointerPos(e);
    jsc._pointerOrigin = {
      x: abs.x - rel.x,
      y: abs.y - rel.y
    };

    switch (controlName) {
    case 'pad':
      // if the slider is at the bottom, move it up
      switch (jsc.getSliderComponent(thisObj)) {
      case 's': if (thisObj.hsv[1] === 0) { thisObj.fromHSV(null, 100, null); }; break;
      case 'v': if (thisObj.hsv[2] === 0) { thisObj.fromHSV(null, null, 100); }; break;
      }
      jsc.setPad(thisObj, e, 0, 0);
      break;

    case 'sld':
      jsc.setSld(thisObj, e, 0);
      break;
    }

    jsc.dispatchFineChange(thisObj);
  },


  onDocumentPointerMove : function (e, target, controlName, pointerType, offset) {
    return function (e) {
      var thisObj = target._jscInstance;
      switch (controlName) {
      case 'pad':
        if (!e) { e = window.event; }
        jsc.setPad(thisObj, e, offset[0], offset[1]);
        jsc.dispatchFineChange(thisObj);
        break;

      case 'sld':
        if (!e) { e = window.event; }
        jsc.setSld(thisObj, e, offset[1]);
        jsc.dispatchFineChange(thisObj);
        break;
      }
    }
  },


  onDocumentPointerEnd : function (e, target, controlName, pointerType) {
    return function (e) {
      var thisObj = target._jscInstance;
      jsc.detachGroupEvents('drag');
      jsc.releaseTarget();
      // Always dispatch changes after detaching outstanding mouse handlers,
      // in case some user interaction will occur in user's onchange callback
      // that would intrude with current mouse events
      jsc.dispatchChange(thisObj);
    };
  },


  dispatchChange : function (thisObj) {
    if (thisObj.valueElement) {
      if (jsc.isElementType(thisObj.valueElement, 'input')) {
        jsc.fireEvent(thisObj.valueElement, 'change');
      }
    }
  },


  dispatchFineChange : function (thisObj) {
    if (thisObj.onFineChange) {
      var callback;
      if (typeof thisObj.onFineChange === 'string') {
        callback = new Function (thisObj.onFineChange);
      } else {
        callback = thisObj.onFineChange;
      }
      callback.call(thisObj);
    }
  },


  setPad : function (thisObj, e, ofsX, ofsY) {
    var pointerAbs = jsc.getAbsPointerPos(e);
    var x = ofsX + pointerAbs.x - jsc._pointerOrigin.x - thisObj.padding - thisObj.insetWidth;
    var y = ofsY + pointerAbs.y - jsc._pointerOrigin.y - thisObj.padding - thisObj.insetWidth;

    var xVal = x * (360 / (thisObj.width - 1));
    var yVal = 100 - (y * (100 / (thisObj.height - 1)));

    switch (jsc.getPadYComponent(thisObj)) {
    case 's': thisObj.fromHSV(xVal, yVal, null, jsc.leaveSld); break;
    case 'v': thisObj.fromHSV(xVal, null, yVal, jsc.leaveSld); break;
    }
  },


  setSld : function (thisObj, e, ofsY) {
    var pointerAbs = jsc.getAbsPointerPos(e);
    var y = ofsY + pointerAbs.y - jsc._pointerOrigin.y - thisObj.padding - thisObj.insetWidth;

    var yVal = 100 - (y * (100 / (thisObj.height - 1)));

    switch (jsc.getSliderComponent(thisObj)) {
    case 's': thisObj.fromHSV(null, yVal, null, jsc.leavePad); break;
    case 'v': thisObj.fromHSV(null, null, yVal, jsc.leavePad); break;
    }
  },


  _vmlNS : 'jsc_vml_',
  _vmlCSS : 'jsc_vml_css_',
  _vmlReady : false,


  initVML : function () {
    if (!jsc._vmlReady) {
      // init VML namespace
      var doc = document;
      if (!doc.namespaces[jsc._vmlNS]) {
        doc.namespaces.add(jsc._vmlNS, 'urn:schemas-microsoft-com:vml');
      }
      if (!doc.styleSheets[jsc._vmlCSS]) {
        var tags = ['shape', 'shapetype', 'group', 'background', 'path', 'formulas', 'handles', 'fill', 'stroke', 'shadow', 'textbox', 'textpath', 'imagedata', 'line', 'polyline', 'curve', 'rect', 'roundrect', 'oval', 'arc', 'image'];
        var ss = doc.createStyleSheet();
        ss.owningElement.id = jsc._vmlCSS;
        for (var i = 0; i < tags.length; i += 1) {
          ss.addRule(jsc._vmlNS + '\\:' + tags[i], 'behavior:url(#default#VML);');
        }
      }
      jsc._vmlReady = true;
    }
  },


  createPalette : function () {

    var paletteObj = {
      elm: null,
      draw: null
    };

    if (jsc.isCanvasSupported) {
      // Canvas implementation for modern browsers

      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');

      var drawFunc = function (width, height, type) {
        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var hGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        hGrad.addColorStop(0 / 6, '#F00');
        hGrad.addColorStop(1 / 6, '#FF0');
        hGrad.addColorStop(2 / 6, '#0F0');
        hGrad.addColorStop(3 / 6, '#0FF');
        hGrad.addColorStop(4 / 6, '#00F');
        hGrad.addColorStop(5 / 6, '#F0F');
        hGrad.addColorStop(6 / 6, '#F00');

        ctx.fillStyle = hGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        var vGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        switch (type.toLowerCase()) {
        case 's':
          vGrad.addColorStop(0, 'rgba(255,255,255,0)');
          vGrad.addColorStop(1, 'rgba(255,255,255,1)');
          break;
        case 'v':
          vGrad.addColorStop(0, 'rgba(0,0,0,0)');
          vGrad.addColorStop(1, 'rgba(0,0,0,1)');
          break;
        }
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };

      paletteObj.elm = canvas;
      paletteObj.draw = drawFunc;

    } else {
      // VML fallback for IE 7 and 8

      jsc.initVML();

      var vmlContainer = document.createElement('div');
      vmlContainer.style.position = 'relative';
      vmlContainer.style.overflow = 'hidden';

      var hGrad = document.createElement(jsc._vmlNS + ':fill');
      hGrad.type = 'gradient';
      hGrad.method = 'linear';
      hGrad.angle = '90';
      hGrad.colors = '16.67% #F0F, 33.33% #00F, 50% #0FF, 66.67% #0F0, 83.33% #FF0'

      var hRect = document.createElement(jsc._vmlNS + ':rect');
      hRect.style.position = 'absolute';
      hRect.style.left = -1 + 'px';
      hRect.style.top = -1 + 'px';
      hRect.stroked = false;
      hRect.appendChild(hGrad);
      vmlContainer.appendChild(hRect);

      var vGrad = document.createElement(jsc._vmlNS + ':fill');
      vGrad.type = 'gradient';
      vGrad.method = 'linear';
      vGrad.angle = '180';
      vGrad.opacity = '0';

      var vRect = document.createElement(jsc._vmlNS + ':rect');
      vRect.style.position = 'absolute';
      vRect.style.left = -1 + 'px';
      vRect.style.top = -1 + 'px';
      vRect.stroked = false;
      vRect.appendChild(vGrad);
      vmlContainer.appendChild(vRect);

      var drawFunc = function (width, height, type) {
        vmlContainer.style.width = width + 'px';
        vmlContainer.style.height = height + 'px';

        hRect.style.width =
        vRect.style.width =
          (width + 1) + 'px';
        hRect.style.height =
        vRect.style.height =
          (height + 1) + 'px';

        // Colors must be specified during every redraw, otherwise IE won't display
        // a full gradient during a subsequential redraw
        hGrad.color = '#F00';
        hGrad.color2 = '#F00';

        switch (type.toLowerCase()) {
        case 's':
          vGrad.color = vGrad.color2 = '#FFF';
          break;
        case 'v':
          vGrad.color = vGrad.color2 = '#000';
          break;
        }
      };

      paletteObj.elm = vmlContainer;
      paletteObj.draw = drawFunc;
    }

    return paletteObj;
  },


  createSliderGradient : function () {

    var sliderObj = {
      elm: null,
      draw: null
    };

    if (jsc.isCanvasSupported) {
      // Canvas implementation for modern browsers

      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');

      var drawFunc = function (width, height, color1, color2) {
        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        var grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };

      sliderObj.elm = canvas;
      sliderObj.draw = drawFunc;

    } else {
      // VML fallback for IE 7 and 8

      jsc.initVML();

      var vmlContainer = document.createElement('div');
      vmlContainer.style.position = 'relative';
      vmlContainer.style.overflow = 'hidden';

      var grad = document.createElement(jsc._vmlNS + ':fill');
      grad.type = 'gradient';
      grad.method = 'linear';
      grad.angle = '180';

      var rect = document.createElement(jsc._vmlNS + ':rect');
      rect.style.position = 'absolute';
      rect.style.left = -1 + 'px';
      rect.style.top = -1 + 'px';
      rect.stroked = false;
      rect.appendChild(grad);
      vmlContainer.appendChild(rect);

      var drawFunc = function (width, height, color1, color2) {
        vmlContainer.style.width = width + 'px';
        vmlContainer.style.height = height + 'px';

        rect.style.width = (width + 1) + 'px';
        rect.style.height = (height + 1) + 'px';

        grad.color = color1;
        grad.color2 = color2;
      };

      sliderObj.elm = vmlContainer;
      sliderObj.draw = drawFunc;
    }

    return sliderObj;
  },


  leaveValue : 1<<0,
  leaveStyle : 1<<1,
  leavePad : 1<<2,
  leaveSld : 1<<3,


  BoxShadow : (function () {
    var BoxShadow = function (hShadow, vShadow, blur, spread, color, inset) {
      this.hShadow = hShadow;
      this.vShadow = vShadow;
      this.blur = blur;
      this.spread = spread;
      this.color = color;
      this.inset = !!inset;
    };

    BoxShadow.prototype.toString = function () {
      var vals = [
        Math.round(this.hShadow) + 'px',
        Math.round(this.vShadow) + 'px',
        Math.round(this.blur) + 'px',
        Math.round(this.spread) + 'px',
        this.color
      ];
      if (this.inset) {
        vals.push('inset');
      }
      return vals.join(' ');
    };

    return BoxShadow;
  })(),


  //
  // Usage:
  // var myColor = new jscolor(<targetElement> [, <options>])
  //

  jscolor : function (targetElement, options) {

    // General options
    //
    this.value = null; // initial HEX color. To change it later, use methods fromString(), fromHSV() and fromRGBA()
    this.valueElement = targetElement; // element that will be used to display and input the color code
    this.styleElement = targetElement; // element that will preview the picked color using CSS backgroundColor
    this.required = true; // whether the associated text <input> can be left empty
    this.refine = false; // whether to refine the entered color code (e.g. uppercase it and remove whitespace)
    this.hash = true; // whether to prefix the HEX color code with # symbol
    this.uppercase = false; // whether to show the color code in upper case
    this.onFineChange = null; // called instantly every time the color changes (value can be either a function or a string with javascript code)
    this.activeClass = 'jscolor-active'; // class to be set to the target element when a picker window is open on it
    this.overwriteImportant = false; // whether to overwrite colors of styleElement using !important
    this.minS = 0; // min allowed saturation (0 - 100)
    this.maxS = 100; // max allowed saturation (0 - 100)
    this.minV = 0; // min allowed value (brightness) (0 - 100)
    this.maxV = 100; // max allowed value (brightness) (0 - 100)

    // Accessing the picked color
    //
    this.hsv = [0, 0, 100]; // read-only  [0-360, 0-100, 0-100]
    this.rgb = [255, 255, 255]; // read-only  [0-255, 0-255, 0-255]
    this.alpha = null;

    // Color Picker options
    //
    this.width = 120; // width of color palette (in px)
    this.height = 90; // height of color palette (in px)
    this.showOnClick = true; // whether to display the color picker when user clicks on its target element
    this.mode = 'HSV'; // HSV | HVS | HS | HV - layout of the color picker controls
    this.position = 'bottom'; // left | right | top | bottom - position relative to the target element
    this.smartPosition = true; // automatically change picker position when there is not enough space for it
    this.sliderSize = 20; // px
    this.crossSize = 10; // px
    this.closable = false; // whether to display the Close button
    this.closeText = 'Close';
    this.buttonColor = '#333333'; // CSS color
    this.buttonHeight = 20; // px
    this.padding = 15; // px
    this.backgroundColor = '#ffffff'; // CSS color
    this.borderWidth = 0; // px
    this.borderColor = '#eeeeee'; // CSS color
    this.borderRadius = 0.5; // em
    this.insetWidth = 1; // px
    this.insetColor = '#eeeeee'; // CSS color
    this.shadow = true; // whether to display shadow
    this.shadowBlur = 15; // px
    this.shadowColor = 'rgba(0,0,0,0.1)'; // CSS color
    this.pointerColor = '#333333'; // px
    this.pointerBorderColor = '#ffffff'; // px
        this.pointerBorderWidth = 1; // px
        this.pointerThickness = 2; // px
    this.zIndex = 1000;
    this.container = null; // where to append the color picker (BODY element by default)


    for (var opt in options) {
      if (options.hasOwnProperty(opt)) {
        this[opt] = options[opt];
      }
    }


    this.hide = function () {
      if (isPickerOwner()) {
        detachPicker();
      }
    };


    this.show = function () {
      drawPicker();
    };


    this.redraw = function () {
      if (isPickerOwner()) {
        drawPicker();
      }
    };


    this.importColor = function () {
      if (!this.valueElement) {
        this.exportColor();
      } else {
        if (jsc.isElementType(this.valueElement, 'input')) {
          if (!this.refine) {
            if (!this.fromString(this.valueElement.value, jsc.leaveValue)) {
              if (this.styleElement) {
                this.styleElement.style.backgroundImage = this.styleElement._jscOrigStyle.backgroundImage;
                this.styleElement.style.backgroundColor = this.styleElement._jscOrigStyle.backgroundColor;
                this.styleElement.style.color = this.styleElement._jscOrigStyle.color;
              }
              this.exportColor(jsc.leaveValue | jsc.leaveStyle);
            }
          } else if (!this.required && /^\s*$/.test(this.valueElement.value)) {
            this.valueElement.value = '';
            if (this.styleElement) {
              this.styleElement.style.backgroundImage = this.styleElement._jscOrigStyle.backgroundImage;
              this.styleElement.style.backgroundColor = this.styleElement._jscOrigStyle.backgroundColor;
              this.styleElement.style.color = this.styleElement._jscOrigStyle.color;
            }
            this.exportColor(jsc.leaveValue | jsc.leaveStyle);

          } else if (this.fromString(this.valueElement.value)) {
            // managed to import color successfully from the value -> OK, don't do anything
          } else {
            this.exportColor();
          }
        } else {
          // not an input element -> doesn't have any value
          this.exportColor();
        }
      }
    };


    this.exportColor = function (flags) {
      if (!(flags & jsc.leaveValue) && this.valueElement) {
        var value = this.toString();
        if (this.uppercase) { value = value.toUpperCase(); }
        if (this.hash) { value = '#' + value; }

        if (jsc.isElementType(this.valueElement, 'input')) {
          this.valueElement.value = value;
        } else {
          this.valueElement.innerHTML = value;
        }
      }
      if (!(flags & jsc.leaveStyle)) {
        if (this.styleElement) {
          var bgColor = '#' + this.toString();
          var fgColor = this.isLight() ? '#333' : '#FFF';

          this.styleElement.style.backgroundImage = 'none';
          this.styleElement.style.backgroundColor = bgColor;
          this.styleElement.style.color = fgColor;

          if (this.overwriteImportant) {
            this.styleElement.setAttribute('style',
              'background: ' + bgColor + ' !important; ' +
              'color: ' + fgColor + ' !important;'
            );
          }
        }
      }
      if (!(flags & jsc.leavePad) && isPickerOwner()) {
        redrawPad();
      }
      if (!(flags & jsc.leaveSld) && isPickerOwner()) {
        redrawSld();
      }
    };


    // h: 0-360
    // s: 0-100
    // v: 0-100
    //
    this.fromHSV = function (h, s, v, flags) { // null = don't change
      if (h !== null) {
        if (isNaN(h)) { return false; }
        h = Math.max(0, Math.min(360, h));
      }
      if (s !== null) {
        if (isNaN(s)) { return false; }
        s = Math.max(0, Math.min(100, this.maxS, s), this.minS);
      }
      if (v !== null) {
        if (isNaN(v)) { return false; }
        v = Math.max(0, Math.min(100, this.maxV, v), this.minV);
      }

      this.rgb = HSV_RGB(
        h===null ? this.hsv[0] : (this.hsv[0]=h),
        s===null ? this.hsv[1] : (this.hsv[1]=s),
        v===null ? this.hsv[2] : (this.hsv[2]=v)
      );

      this.exportColor(flags);
    };


    // r: 0-255
    // g: 0-255
    // b: 0-255
    //
    this.fromRGBA = function (r, g, b, a, flags) { // null = don't change
      if (r !== null) {
        if (isNaN(r)) { return false; }
        r = Math.max(0, Math.min(255, r));
      }
      if (g !== null) {
        if (isNaN(g)) { return false; }
        g = Math.max(0, Math.min(255, g));
      }
      if (b !== null) {
        if (isNaN(b)) { return false; }
        b = Math.max(0, Math.min(255, b));
      }
      if (a !== null) {
        a = isNaN(a) ? null : Math.max(0, Math.min(255, a));
      }

      var hsv = RGB_HSV(
        r===null ? this.rgb[0] : r,
        g===null ? this.rgb[1] : g,
        b===null ? this.rgb[2] : b
      );
      if (hsv[0] !== null) {
        this.hsv[0] = Math.max(0, Math.min(360, hsv[0]));
      }
      if (hsv[2] !== 0) {
        this.hsv[1] = hsv[1]===null ? null : Math.max(0, this.minS, Math.min(100, this.maxS, hsv[1]));
      }
      this.hsv[2] = hsv[2]===null ? null : Math.max(0, this.minV, Math.min(100, this.maxV, hsv[2]));

      // update RGB according to final HSV, as some values might be trimmed
      var rgb = HSV_RGB(this.hsv[0], this.hsv[1], this.hsv[2]);
      this.rgb[0] = rgb[0];
      this.rgb[1] = rgb[1];
      this.rgb[2] = rgb[2];
      this.alpha = a;

      this.exportColor(flags);
    };


    this.fromString = function (str, flags) {
      var m;
      if (m = str.match(/\#([abcdef0-9]{3,9})/i)) {
        // HEX notation
        if (m[1].length === 6 || m[1].length === 8) {
          // 6-char notation
          this.fromRGBA(
            parseInt(m[1].substr(0,2),16),
            parseInt(m[1].substr(2,2),16),
            parseInt(m[1].substr(4,2),16),
            parseInt(m[1].substr(6,2),16),
            flags
          );
        } else {
          // 3-char notation
          this.fromRGBA(
            parseInt(m[1].charAt(0) + m[1].charAt(0),16),
            parseInt(m[1].charAt(1) + m[1].charAt(1),16),
            parseInt(m[1].charAt(2) + m[1].charAt(2),16),
            parseInt(m[1].charAt(2) + m[1].charAt(3),16),
            flags
          );
        }
        return true;

      } else if (m = str.match(/^\W*rgba?\(([^)]*)\)\W*$/i)) {
        var params = m[1].split(',');
        var re = /^\s*(\d*)(\.\d+)?\s*$/;
        var mR, mG, mB;
        if (
          params.length >= 3 &&
          (mR = params[0].match(re)) &&
          (mG = params[1].match(re)) &&
          (mB = params[2].match(re))
        ) {
          var r = parseFloat((mR[1] || '0') + (mR[2] || ''));
          var g = parseFloat((mG[1] || '0') + (mG[2] || ''));
          var b = parseFloat((mB[1] || '0') + (mB[2] || ''));
          this.fromRGBA(r, g, b, flags);
          return true;
        }
      }
      return false;
    };


    this.toString = function () {
      let str =
        (0x100 | Math.round(this.rgb[0])).toString(16).substr(1) +
        (0x100 | Math.round(this.rgb[1])).toString(16).substr(1) +
        (0x100 | Math.round(this.rgb[2])).toString(16).substr(1);
      if (this.alpha != null && this.alpha != 255)
        str += ('0' + this.alpha.toString(16)).slice(-2);
      return str;
    };


    this.toHEXString = function () {
      return '#' + this.toString().toUpperCase();
    };


    this.toRGBString = function () {
      return ('rgb(' +
        Math.round(this.rgb[0]) + ',' +
        Math.round(this.rgb[1]) + ',' +
        Math.round(this.rgb[2]) + ')'
      );
    };


    this.isLight = function () {
      return (
        0.213 * this.rgb[0] +
        0.715 * this.rgb[1] +
        0.072 * this.rgb[2] >
        255 / 2
      ) || this.alpha != null && this.alpha < 64;
    };


    this._processParentElementsInDOM = function () {
      if (this._linkedElementsProcessed) { return; }
      this._linkedElementsProcessed = true;

      var elm = this.targetElement;
      do {
        // If the target element or one of its parent nodes has fixed position,
        // then use fixed positioning instead
        //
        // Note: In Firefox, getComputedStyle returns null in a hidden iframe,
        // that's why we need to check if the returned style object is non-empty
        var currStyle = jsc.getStyle(elm);
        if (currStyle && currStyle.position.toLowerCase() === 'fixed') {
          this.fixed = true;
        }

        if (elm !== this.targetElement) {
          // Ensure to attach onParentScroll only once to each parent element
          // (multiple targetElements can share the same parent nodes)
          //
          // Note: It's not just offsetParents that can be scrollable,
          // that's why we loop through all parent nodes
          if (!elm._jscEventsAttached) {
            jsc.attachEvent(elm, 'scroll', jsc.onParentScroll);
            elm._jscEventsAttached = true;
          }
        }
      } while ((elm = elm.parentNode) && !jsc.isElementType(elm, 'body'));
    };


    // r: 0-255
    // g: 0-255
    // b: 0-255
    //
    // returns: [ 0-360, 0-100, 0-100 ]
    //
    function RGB_HSV (r, g, b) {
      r /= 255;
      g /= 255;
      b /= 255;
      var n = Math.min(Math.min(r,g),b);
      var v = Math.max(Math.max(r,g),b);
      var m = v - n;
      if (m === 0) { return [ null, 0, 100 * v ]; }
      var h = r===n ? 3+(b-g)/m : (g===n ? 5+(r-b)/m : 1+(g-r)/m);
      return [
        60 * (h===6?0:h),
        100 * (m/v),
        100 * v
      ];
    }


    // h: 0-360
    // s: 0-100
    // v: 0-100
    //
    // returns: [ 0-255, 0-255, 0-255 ]
    //
    function HSV_RGB (h, s, v) {
      var u = 255 * (v / 100);

      if (h === null) {
        return [ u, u, u ];
      }

      h /= 60;
      s /= 100;

      var i = Math.floor(h);
      var f = i%2 ? h-i : 1-(h-i);
      var m = u * (1 - s);
      var n = u * (1 - s * f);
      switch (i) {
        case 6:
        case 0: return [u,n,m];
        case 1: return [n,u,m];
        case 2: return [m,u,n];
        case 3: return [m,n,u];
        case 4: return [n,m,u];
        case 5: return [u,m,n];
      }
    }


    function detachPicker () {
      jsc.unsetClass(THIS.targetElement, THIS.activeClass);
      jsc.picker.wrap.parentNode.removeChild(jsc.picker.wrap);
      delete jsc.picker.owner;
    }


    function drawPicker () {

      // At this point, when drawing the picker, we know what the parent elements are
      // and we can do all related DOM operations, such as registering events on them
      // or checking their positioning
      THIS._processParentElementsInDOM();

      if (!jsc.picker) {
        jsc.picker = {
          owner: null,
          wrap : document.createElement('div'),
          box : document.createElement('div'),
          boxS : document.createElement('div'), // shadow area
          boxB : document.createElement('div'), // border
          pad : document.createElement('div'),
          padB : document.createElement('div'), // border
          padM : document.createElement('div'), // mouse/touch area
          padPal : jsc.createPalette(),
          cross : document.createElement('div'),
          crossBY : document.createElement('div'), // border Y
          crossBX : document.createElement('div'), // border X
          crossLY : document.createElement('div'), // line Y
          crossLX : document.createElement('div'), // line X
          sld : document.createElement('div'),
          sldB : document.createElement('div'), // border
          sldM : document.createElement('div'), // mouse/touch area
          sldGrad : jsc.createSliderGradient(),
          sldPtrS : document.createElement('div'), // slider pointer spacer
          sldPtrIB : document.createElement('div'), // slider pointer inner border
          sldPtrMB : document.createElement('div'), // slider pointer middle border
          sldPtrOB : document.createElement('div'), // slider pointer outer border
          btn : document.createElement('div'),
          btnT : document.createElement('span') // text
        };

        jsc.picker.pad.appendChild(jsc.picker.padPal.elm);
        jsc.picker.padB.appendChild(jsc.picker.pad);
        jsc.picker.cross.appendChild(jsc.picker.crossBY);
        jsc.picker.cross.appendChild(jsc.picker.crossBX);
        jsc.picker.cross.appendChild(jsc.picker.crossLY);
        jsc.picker.cross.appendChild(jsc.picker.crossLX);
        jsc.picker.padB.appendChild(jsc.picker.cross);
        jsc.picker.box.appendChild(jsc.picker.padB);
        jsc.picker.box.appendChild(jsc.picker.padM);

        jsc.picker.sld.appendChild(jsc.picker.sldGrad.elm);
        jsc.picker.sldB.appendChild(jsc.picker.sld);
        jsc.picker.sldB.appendChild(jsc.picker.sldPtrOB);
        jsc.picker.sldPtrOB.appendChild(jsc.picker.sldPtrMB);
        jsc.picker.sldPtrMB.appendChild(jsc.picker.sldPtrIB);
        jsc.picker.sldPtrIB.appendChild(jsc.picker.sldPtrS);
        jsc.picker.box.appendChild(jsc.picker.sldB);
        jsc.picker.box.appendChild(jsc.picker.sldM);

        jsc.picker.btn.appendChild(jsc.picker.btnT);
        jsc.picker.box.appendChild(jsc.picker.btn);

        jsc.picker.boxB.appendChild(jsc.picker.box);
        jsc.picker.wrap.appendChild(jsc.picker.boxS);
        jsc.picker.wrap.appendChild(jsc.picker.boxB);
      }

      var p = jsc.picker;

      var displaySlider = !!jsc.getSliderComponent(THIS);
      var dims = jsc.getPickerDims(THIS);
      var crossOuterSize = (2 * THIS.pointerBorderWidth + THIS.pointerThickness + 2 * THIS.crossSize);
      var padToSliderPadding = jsc.getPadToSliderPadding(THIS);
      var borderRadius = Math.min(
        THIS.borderRadius,
        Math.round(THIS.padding * Math.PI)); // px
      var padCursor = 'crosshair';

      // wrap
      p.wrap.style.clear = 'both';
      p.wrap.style.width = (dims[0] + 2 * THIS.borderWidth) + 'px';
      p.wrap.style.height = (dims[1] + 2 * THIS.borderWidth) + 'px';
      p.wrap.style.zIndex = THIS.zIndex;

      // picker
      p.box.style.width = dims[0] + 'px';
      p.box.style.height = dims[1] + 'px';

      p.boxS.style.position = 'absolute';
      p.boxS.style.left = '0';
      p.boxS.style.top = '0';
      p.boxS.style.width = '100%';
      p.boxS.style.height = '100%';
      jsc.setBorderRadius(p.boxS, borderRadius + 'em');

      // picker border
      p.boxB.style.position = 'relative';
      p.boxB.style.border = THIS.borderWidth + 'px solid';
      p.boxB.style.borderColor = THIS.borderColor;
      p.boxB.style.background = THIS.backgroundColor;
      jsc.setBorderRadius(p.boxB, borderRadius + 'em');

      // IE hack:
      // If the element is transparent, IE will trigger the event on the elements under it,
      // e.g. on Canvas or on elements with border
      p.padM.style.background =
      p.sldM.style.background =
        '#FFF';
      jsc.setStyle(p.padM, 'opacity', '0');
      jsc.setStyle(p.sldM, 'opacity', '0');

      // pad
      p.pad.style.position = 'relative';
      p.pad.style.width = THIS.width + 'px';
      p.pad.style.height = THIS.height + 'px';

      // pad palettes (HSV and HVS)
      p.padPal.draw(THIS.width, THIS.height, jsc.getPadYComponent(THIS));

      // pad border
      p.padB.style.position = 'absolute';
      p.padB.style.left = THIS.padding + 'px';
      p.padB.style.top = THIS.padding + 'px';
      p.padB.style.border = THIS.insetWidth + 'px solid';
      p.padB.style.borderColor = THIS.insetColor;

      // pad mouse area
      p.padM._jscInstance = THIS;
      p.padM._jscControlName = 'pad';
      p.padM.style.position = 'absolute';
      p.padM.style.left = '0';
      p.padM.style.top = '0';
      p.padM.style.width = (THIS.padding + 2 * THIS.insetWidth + THIS.width + padToSliderPadding / 2) + 'px';
      p.padM.style.height = dims[1] + 'px';
      p.padM.style.cursor = padCursor;

      // pad cross
      p.cross.style.position = 'absolute';
      p.cross.style.left =
      p.cross.style.top =
        '0';
      p.cross.style.width =
      p.cross.style.height =
        crossOuterSize + 'px';

      // pad cross border Y and X
      p.crossBY.style.position =
      p.crossBX.style.position =
        'absolute';
      p.crossBY.style.background =
      p.crossBX.style.background =
        THIS.pointerBorderColor;
      p.crossBY.style.width =
      p.crossBX.style.height =
        (2 * THIS.pointerBorderWidth + THIS.pointerThickness) + 'px';
      p.crossBY.style.height =
      p.crossBX.style.width =
        crossOuterSize + 'px';
      p.crossBY.style.left =
      p.crossBX.style.top =
        (Math.floor(crossOuterSize / 2) - Math.floor(THIS.pointerThickness / 2) - THIS.pointerBorderWidth) + 'px';
      p.crossBY.style.top =
      p.crossBX.style.left =
        '0';

      // pad cross line Y and X
      p.crossLY.style.position =
      p.crossLX.style.position =
        'absolute';
      p.crossLY.style.background =
      p.crossLX.style.background =
        THIS.pointerColor;
      p.crossLY.style.height =
      p.crossLX.style.width =
        (crossOuterSize - 2 * THIS.pointerBorderWidth) + 'px';
      p.crossLY.style.width =
      p.crossLX.style.height =
        THIS.pointerThickness + 'px';
      p.crossLY.style.left =
      p.crossLX.style.top =
        (Math.floor(crossOuterSize / 2) - Math.floor(THIS.pointerThickness / 2)) + 'px';
      p.crossLY.style.top =
      p.crossLX.style.left =
        THIS.pointerBorderWidth + 'px';

      // slider
      p.sld.style.overflow = 'hidden';
      p.sld.style.width = THIS.sliderSize + 'px';
      p.sld.style.height = THIS.height + 'px';

      // slider gradient
      p.sldGrad.draw(THIS.sliderSize, THIS.height, '#000', '#000');

      // slider border
      p.sldB.style.display = displaySlider ? 'block' : 'none';
      p.sldB.style.position = 'absolute';
      p.sldB.style.right = THIS.padding + 'px';
      p.sldB.style.top = THIS.padding + 'px';
      p.sldB.style.border = THIS.insetWidth + 'px solid';
      p.sldB.style.borderColor = THIS.insetColor;

      // slider mouse area
      p.sldM._jscInstance = THIS;
      p.sldM._jscControlName = 'sld';
      p.sldM.style.display = displaySlider ? 'block' : 'none';
      p.sldM.style.position = 'absolute';
      p.sldM.style.right = '0';
      p.sldM.style.top = '0';
      p.sldM.style.width = (THIS.sliderSize + padToSliderPadding / 2 + THIS.padding + 2 * THIS.insetWidth) + 'px';
      p.sldM.style.height = dims[1] + 'px';
      p.sldM.style.cursor = 'default';

      // slider pointer inner and outer border
      p.sldPtrIB.style.border =
      p.sldPtrOB.style.border =
        THIS.pointerBorderWidth + 'px solid ' + THIS.pointerBorderColor;

      // slider pointer outer border
      p.sldPtrOB.style.position = 'absolute';
      p.sldPtrOB.style.left = -(2 * THIS.pointerBorderWidth + THIS.pointerThickness) + 'px';
      p.sldPtrOB.style.top = '0';

      // slider pointer middle border
      p.sldPtrMB.style.border = THIS.pointerThickness + 'px solid ' + THIS.pointerColor;

      // slider pointer spacer
      p.sldPtrS.style.width = THIS.sliderSize + 'px';
      p.sldPtrS.style.height = sliderPtrSpace + 'px';

      // the Close button
      function setBtnBorder () {
        var insetColors = THIS.insetColor.split(/\s+/);
        var outsetColor = insetColors.length < 2 ? insetColors[0] : insetColors[1] + ' ' + insetColors[0] + ' ' + insetColors[0] + ' ' + insetColors[1];
        p.btn.style.borderColor = outsetColor;
      }
      p.btn.style.display = THIS.closable ? 'block' : 'none';
      p.btn.style.position = 'absolute';
      p.btn.style.left = THIS.padding + 'px';
      p.btn.style.bottom = THIS.padding + 'px';
      p.btn.style.padding = '0 15px';
      p.btn.style.height = THIS.buttonHeight + 'px';
      p.btn.style.border = THIS.insetWidth + 'px solid';
      setBtnBorder();
      p.btn.style.color = THIS.buttonColor;
      p.btn.style.font = '12px sans-serif';
      p.btn.style.textAlign = 'center';
      try {
        p.btn.style.cursor = 'pointer';
      } catch(eOldIE) {
        p.btn.style.cursor = 'hand';
      }
      p.btn.onmousedown = function () {
        THIS.hide();
      };
      p.btnT.style.lineHeight = THIS.buttonHeight + 'px';
      p.btnT.innerHTML = '';
      p.btnT.appendChild(document.createTextNode(THIS.closeText));

      // place pointers
      redrawPad();
      redrawSld();

      // If we are changing the owner without first closing the picker,
      // make sure to first deal with the old owner
      if (jsc.picker.owner && jsc.picker.owner !== THIS) {
        jsc.unsetClass(jsc.picker.owner.targetElement, THIS.activeClass);
      }

      // Set the new picker owner
      jsc.picker.owner = THIS;

      // The redrawPosition() method needs picker.owner to be set, that's why we call it here,
      // after setting the owner
      if (jsc.isElementType(container, 'body')) {
        jsc.redrawPosition();
      } else {
        jsc._drawPosition(THIS, 0, 0, 'relative', false);
      }

      if (p.wrap.parentNode != container) {
        container.appendChild(p.wrap);
      }

      jsc.setClass(THIS.targetElement, THIS.activeClass);
    }


    function redrawPad () {
      // redraw the pad pointer
      switch (jsc.getPadYComponent(THIS)) {
      case 's': var yComponent = 1; break;
      case 'v': var yComponent = 2; break;
      }
      var x = Math.round((THIS.hsv[0] / 360) * (THIS.width - 1));
      var y = Math.round((1 - THIS.hsv[yComponent] / 100) * (THIS.height - 1));
      var crossOuterSize = (2 * THIS.pointerBorderWidth + THIS.pointerThickness + 2 * THIS.crossSize);
      var ofs = -Math.floor(crossOuterSize / 2);
      jsc.picker.cross.style.left = (x + ofs) + 'px';
      jsc.picker.cross.style.top = (y + ofs) + 'px';

      // redraw the slider
      switch (jsc.getSliderComponent(THIS)) {
      case 's':
        var rgb1 = HSV_RGB(THIS.hsv[0], 100, THIS.hsv[2]);
        var rgb2 = HSV_RGB(THIS.hsv[0], 0, THIS.hsv[2]);
        var color1 = 'rgb(' +
          Math.round(rgb1[0]) + ',' +
          Math.round(rgb1[1]) + ',' +
          Math.round(rgb1[2]) + ')';
        var color2 = 'rgb(' +
          Math.round(rgb2[0]) + ',' +
          Math.round(rgb2[1]) + ',' +
          Math.round(rgb2[2]) + ')';
        jsc.picker.sldGrad.draw(THIS.sliderSize, THIS.height, color1, color2);
        break;
      case 'v':
        var rgb = HSV_RGB(THIS.hsv[0], THIS.hsv[1], 100);
        var color1 = 'rgb(' +
          Math.round(rgb[0]) + ',' +
          Math.round(rgb[1]) + ',' +
          Math.round(rgb[2]) + ')';
        var color2 = '#000';
        jsc.picker.sldGrad.draw(THIS.sliderSize, THIS.height, color1, color2);
        break;
      }
    }


    function redrawSld () {
      var sldComponent = jsc.getSliderComponent(THIS);
      if (sldComponent) {
        // redraw the slider pointer
        switch (sldComponent) {
        case 's': var yComponent = 1; break;
        case 'v': var yComponent = 2; break;
        }
        var y = Math.round((1 - THIS.hsv[yComponent] / 100) * (THIS.height - 1));
        jsc.picker.sldPtrOB.style.top = (y - (2 * THIS.pointerBorderWidth + THIS.pointerThickness) - Math.floor(sliderPtrSpace / 2)) + 'px';
      }
    }


    function isPickerOwner () {
      return jsc.picker && jsc.picker.owner === THIS;
    }


    function blurValue () {
      THIS.importColor();
    }


    // Find the target element
    if (typeof targetElement === 'string') {
      var id = targetElement;
      var elm = document.getElementById(id);
      if (elm) {
        this.targetElement = elm;
      } else {
        jsc.warn('Could not find target element with ID \'' + id + '\'');
      }
    } else if (targetElement) {
      this.targetElement = targetElement;
    } else {
      jsc.warn('Invalid target element: \'' + targetElement + '\'');
    }

    if (this.targetElement._jscLinkedInstance) {
      jsc.warn('Cannot link jscolor twice to the same element. Skipping.');
      return;
    }
    this.targetElement._jscLinkedInstance = this;

    // Find the value element
    this.valueElement = jsc.fetchElement(this.valueElement);
    // Find the style element
    this.styleElement = jsc.fetchElement(this.styleElement);

    var THIS = this;
    var container =
      this.container ?
      jsc.fetchElement(this.container) :
      document.getElementsByTagName('body')[0];
    var sliderPtrSpace = 3; // px

    // For BUTTON elements it's important to stop them from sending the form when clicked
    // (e.g. in Safari)
    if (jsc.isElementType(this.targetElement, 'button')) {
      if (this.targetElement.onclick) {
        var origCallback = this.targetElement.onclick;
        this.targetElement.onclick = function (evt) {
          origCallback.call(this, evt);
          return false;
        };
      } else {
        this.targetElement.onclick = function () { return false; };
      }
    }

    /*
    var elm = this.targetElement;
    do {
      // If the target element or one of its offsetParents has fixed position,
      // then use fixed positioning instead
      //
      // Note: In Firefox, getComputedStyle returns null in a hidden iframe,
      // that's why we need to check if the returned style object is non-empty
      var currStyle = jsc.getStyle(elm);
      if (currStyle && currStyle.position.toLowerCase() === 'fixed') {
        this.fixed = true;
      }

      if (elm !== this.targetElement) {
        // attach onParentScroll so that we can recompute the picker position
        // when one of the offsetParents is scrolled
        if (!elm._jscEventsAttached) {
          jsc.attachEvent(elm, 'scroll', jsc.onParentScroll);
          elm._jscEventsAttached = true;
        }
      }
    } while ((elm = elm.offsetParent) && !jsc.isElementType(elm, 'body'));
    */

    // valueElement
    if (this.valueElement) {
      if (jsc.isElementType(this.valueElement, 'input')) {
        var updateField = function () {
          THIS.fromString(THIS.valueElement.value, jsc.leaveValue);
          jsc.dispatchFineChange(THIS);
        };
        jsc.attachEvent(this.valueElement, 'keyup', updateField);
        jsc.attachEvent(this.valueElement, 'input', updateField);
        jsc.attachEvent(this.valueElement, 'blur', blurValue);
        this.valueElement.setAttribute('autocomplete', 'off');
      }
    }

    // styleElement
    if (this.styleElement) {
      this.styleElement._jscOrigStyle = {
        backgroundImage : this.styleElement.style.backgroundImage,
        backgroundColor : this.styleElement.style.backgroundColor,
        color : this.styleElement.style.color
      };
    }

    if (this.value) {
      // Try to set the color from the .value option and if unsuccessful,
      // export the current color
      this.fromString(this.value) || this.exportColor();
    } else {
      this.importColor();
    }
  }

};


//================================
// Public properties and methods
//================================


// By default, search for all elements with class="jscolor" and install a color picker on them.
//
// You can change what class name will be looked for by setting the property jscolor.lookupClass
// anywhere in your HTML document. To completely disable the automatic lookup, set it to null.
//
jsc.jscolor.lookupClass = 'jscolor';


jsc.jscolor.installByClassName = function (className) {
  var inputElms = document.getElementsByTagName('input');
  var buttonElms = document.getElementsByTagName('button');

  jsc.tryInstallOnElements(inputElms, className);
  jsc.tryInstallOnElements(buttonElms, className);
};


jsc.register();


return jsc.jscolor;


})(); }

const OnMouseEvent = EventHole('mousedown', 'mouseup', 'mouseout', 'mousemove');
const OnTouchEvent = EventHole('touchstart', 'touchmove', 'touchend');

// Let us populate some HTML why not
window.addEventListener('DOMContentLoaded',(e) => {
  let paintButtonGroup = document.querySelector('#color-menu .group');
  let colorControllerGroup = document.querySelector('#color-controllers');
  let paintButtonPrototype = document.querySelector('.assets .paint-button');
  let ruleButtonPrototype = document.querySelector('.assets .color-controller');
  for (let i = 0; i < 256; i++) {
    let paintButton = paintButtonPrototype.cloneNode();
    let ruleButton = ruleButtonPrototype.cloneNode();
    paintButton.setAttribute('title', i);
    ruleButton.setAttribute('title', i);
    paintButtonGroup.appendChild(paintButton);
    colorControllerGroup.appendChild(ruleButton);
  }
  jscolor.installByClassName('jscolor');
});

// Do the stuff
window.addEventListener('load', (e) => {
  Board.constants.baseTitle = document.title;
  // Build select wrappers
  Select.init('.modal select');
  // Set up board
  Board.resize();
});


class CubicExpander extends Plugin {
  defaultSettings() {
    return `
      {
        drawCurrent: true,
        drawLast: true,
        drawTerminal: true,
        minRadius: 0,
        maxRadius: 1,
        flip: false,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  drawCube(cell, r, flipOffset=1, state='state') {
    let adapter = this.adapter;
    let ctx = adapter.context;
    let colors = this.config.fillColors;
    let verts = Hexular.math.pointyVertices;
    for (let i = 0; i < 6; i += 2) {
      let n0 = cell.nbrs[(i + flipOffset - 1) % 6 + 1];
      let n1 = cell.nbrs[(i + flipOffset) % 6 + 1];
      let v1 = Hexular.math.scalarOp(verts[(i + 2 + flipOffset) % 6], r);
      let v2 = Hexular.math.scalarOp(verts[(i + 3 + flipOffset) % 6], r);
      let v3 = Hexular.math.scalarOp(verts[(i + 4 + flipOffset) % 6], r);
      adapter.drawPath(cell, [[0, 0], v1, v2, v3]);
      let stateColors = [
        colors[cell[state]] || Color.t,
        colors[n0[state]] || Color.t,
        colors[n1[state]] || Color.t,
      ];
      adapter.fillColor = Color.blend(...stateColors);
      ctx.fill();
    }
  }

  onDraw(adapter) {
    // Setup
    let min = this.settings.minRadius;
    let max = this.settings.maxRadius;
    let r = this.config.innerRadius;
    let q = this.board.drawStepQInc;
    let radius = r * ((max - min) * q + min);
    let invRadius = r * ((max - min) * (1 - q) + min);
    let flipOffset = 1 + this.settings.flip;

    // Draw
    this.drawEachCell((cell) => {
      let allowed = this.isAllowedState(cell.state);
      let lastAllowed = this.isAllowedState(cell.lastState);
      if (lastAllowed) {
        if (!allowed && this.settings.drawTerminal) {
          this.drawCube(cell, invRadius, flipOffset, 'lastState');
        }
        else if (allowed && this.settings.drawLast) {
          this.drawCube(cell,  this.config.innerRadius, flipOffset, 'lastState');
        }
      }
      if (allowed && this.settings.drawCurrent) {
        this.drawCube(cell, radius, flipOffset);
      }
    });
  }
}
Board.registerPlugin(CubicExpander);

class ExpanderContractor extends Plugin {
  defaultSettings() {
    return `
      {
        shapeType: Hexular.enums.TYPE_POINTY,
        fadeIndex: 0, // 0-1
        fadeInclusive: false,
        minRadius: 0,
        baseRadius: 0.5,
        maxRadius: 1,
        radiusPivot: 0.5,
        minAlpha: 1,
        baseAlpha: 1,
        maxAlpha: 1,
        alphaPivot: 0.5,
        minAngle: 0,
        baseAngle: 0,
        maxAngle: 0,
        anglePivot: 0.5,
        fill: true,
        stroke: false,
        color: null,
        lineWidth: null,
        lineJoin: null,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {

    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let {
      shapeType, fadeInclusive, minRadius, baseRadius, maxRadius, radiusPivot,
      minAlpha, baseAlpha, maxAlpha, alphaPivot, minAngle, baseAngle, maxAngle, anglePivot,
      fill, stroke, color, lineWidth, lineJoin, blendMode
    } = this.settings;
    let q = this.board.drawStepQInc;
    let radiusQ = this.getPivot(q, radiusPivot);
    let alphaQ = this.getPivot(q, alphaPivot);
    let angleQ = this.getPivot(q, anglePivot);
    let fadeQ = this.getFade(q);
    let r = this.config.innerRadius;
    let deltaRadius = this.settings.maxRadius - this.settings.minRadius;
    let contR = r * (baseRadius + (maxRadius - baseRadius) * radiusQ);
    let startR = r * (minRadius + (baseRadius - minRadius) * q);
    let endR = r * (baseRadius - (baseRadius - minRadius) * q);
    let contA = baseAlpha + (maxAlpha - baseAlpha) * alphaQ;
    let startA = minAlpha + (baseAlpha - minAlpha) * q;
    let endA = baseAlpha - (baseAlpha - minAlpha) * q;
    let contP, startP, endP;
    if (this.settings.shapeType != Hexular.enums.TYPE_CIRCLE) {
      let {cos, sin} = Math;
      let path = adapter.shapes[this.settings.shapeType];
      path = path != null ? path : adapter.shapes[Hexular.enums.TYPE_POINTY];
      let contT = baseAngle + (maxAngle - baseAngle) * angleQ;
      let startT = minAngle + (baseAngle - minAngle) * q;
      let endT = baseAngle - (baseAngle - minAngle) * q;
      [contP, startP, endP] = [contT, startT, endT].map((t) => {
        let matrix = Hexular.math.rotationMatrix(t);
        return path.map((e) => Hexular.math.matrixMult(matrix, e));
      });
    }
    let opts = {
      path: null,
      type: this.settings.shapeType,
      fill: this.settings.fill,
      stroke: this.settings.stroke,
      lineWidth: this.settings.lineWidth != null ? this.settings.lineWidth : this.config.cellBorderWidth,
      lineJoin: this.settings.lineJoin || this.config.defaultJoin,
    };
    let fillColors = this.config.fillColors.slice();
    let strokeColors = this.config.strokeColors.slice();
    if (color) {
      fillColors.fill(Color(this.settings.color));
      strokeColors.fill(Color(this.settings.color));
    }

    // Draw
    this.drawEachCell((cell) => {
      let r;
      let allowed = this.isAllowedState(cell.state);
      let lastAllowed = this.isAllowedState(cell.lastState);
      if (allowed) {
        opts.fillStyle = fillColors[cell.state] || Color.t;
        opts.strokeStyle = strokeColors[cell.state] || Color.t;
        if (lastAllowed) {
          r = contR;
          opts.path = contP;
          opts.alpha = contA;
        }
        else {
          r = startR;
          opts.path = startP;
          opts.alpha = startA;
        }
        if (fadeQ < 1 && (lastAllowed || this.settings.fadeInclusive)) {
          opts.fillStyle = opts.fillStyle.blend(fillColors[cell.lastState], fadeQ);
          opts.strokeStyle = opts.strokeStyle.blend(strokeColors[cell.lastState], fadeQ);
        }
      }
      else if (lastAllowed) {
        r = endR;
        opts.path = endP;
        opts.alpha = endA;
        if (this.settings.fadeInclusive) {
          opts.fillStyle = fillColors[cell.state] || Color.t;
          opts.strokeStyle = strokeColors[cell.state] || Color.t;
          if (fadeQ < 1) {
            opts.fillStyle = opts.fillStyle.blend(fillColors[cell.lastState], fadeQ);
            opts.strokeStyle = opts.strokeStyle.blend(strokeColors[cell.lastState], fadeQ);
          }
        }
        else {
          opts.fillStyle = fillColors[cell.lastState] || Color.t;
          opts.strokeStyle = strokeColors[cell.lastState] || Color.t;
        }
      }
      else {
        return;
      }
      adapter.drawShape(cell, r, opts);
    });
  }
}
Board.registerPlugin(ExpanderContractor);

class FaderExpander extends Plugin {
  defaultSettings() {
    return `
      {
        shapeType: Hexular.enums.TYPE_POINTY,
        fadeIndex: 0, // 0-1
        minAlpha: 0,
        maxAlpha: 1,
        minRadius: 0,
        maxRadius: 1,
        fill: true,
        stroke: false,
        color: null,
        lineWidth: null,
        lineJoin: null,
        pivot: 0.5,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let {
      shapeType, fill, stroke, color, lineWidth, minRadius,
      maxRadius, minAlpha, maxAlpha, pivot
    } = this.settings;
    let q = this.board.drawStepQInc;
    let fadeQ = this.getFade(q);
    let pivotQ = this.getPivot(q, pivot);
    let radius = this.config.innerRadius * ((maxRadius - minRadius) * pivotQ + minRadius);
    this.globalAlpha = (maxAlpha - minAlpha) * pivotQ + minAlpha;
    let opts = {
      type: shapeType,
      fill: fill,
      stroke: stroke,
      lineWidth: lineWidth != null ? lineWidth : this.config.cellBorderWidth,
      lineJoin: this.settings.lineJoin || this.config.defaultJoin,
    };
    let fillColors = this.config.fillColors.slice();
    let strokeColors = this.config.strokeColors.slice();
    if (color) {
      fillColors.fill(Color(this.settings.color));
      strokeColors.fill(Color(this.settings.color));
    }

    // Draw
    this.drawEachCell((cell) => {
      if (!this.isAllowedState(cell.state)) return;
      let fade = fadeQ < 1;
      if (opts.fill) {
        opts.fillStyle = fillColors[cell.state] || Color.t;
        if (fade) opts.fillStyle = opts.fillStyle.blend(fillColors[cell.lastState], fadeQ)
      }
      if (opts.stroke) {
        opts.strokeStyle = strokeColors[cell.state] || Color.t;
        if (fade) opts.strokeStyle = opts.strokeStyle.blend(strokeColors[cell.lastState], fadeQ);
      }
      adapter.drawShape(cell, radius, opts);
    });
  }
}
Board.registerPlugin(FaderExpander);

class FrameClient extends Plugin {
  static policy() {
    return {
      autostart: false
    };
  }

  defaultSettings() {
    return `
      {
        // This requires ffmpeg and running "npm run imageserver" locally
        endpoint: 'http://localhost:8008/',
        frameOnActivate: true,
      }
    `;
  }

  _activate() {
    this.registerHook('drawStep', () => this.onDrawStep());
  }

  _enable() {
    this.settings.frameOnActivate && this.onDrawStep();
    this.board.startRecordingMode('frameClient_' + this.id);
  }

  _disable() {
    this.board.endRecordingMode('frameClient_' + this.id);
  }

  async onDrawStep() {
    let dataUrl = await this.board.getImage();
    try {
      await fetch(this.settings.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: {'Content-Type': `text/plain`},
        body: dataUrl
      });
    }
    catch (err) {
      this.board.setMessage(err, 'error');
      console.error(err);
    }
  }
}
Board.registerPlugin(FrameClient);

class Hexagrams extends Plugin {
  defaultSettings() {
    return `
      {
        drawRings: true,
        blendMode: null,
      }
    `;
  }

  _activate() {
    let setLines = (cell) => cell.lines = cell.newLines = this.toLines(cell.state);
    let clearLines = () => {
      if (!this.enabled) return;
      this.model.eachCell(setLines);
    };
    let paintLines = (cells) => {
      if (!this.enabled) return;
      cells.forEach(setLines);
    };
    this.registerHook('clear', clearLines);
    this.registerHook('paint', paintLines);
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  _enable() {

    this.initializeLines();
    this.oldNumStates = this.config.maxNumStates;
    this.config.setMaxNumStates(64);
  }

  _disable() {
    // This is problematic for obvious reasons and was only included when changing maxNumStates was still, to my mind,
    // sort of esoteric functionality. But it's now become more "mainstreamed" in my usage so whatever.
    // this.oldNumStates && this.config.setMaxNumStates(this.oldNumStates);
  }

  initializeLines() {
    this.model.eachCell((cell) => {
      let lastLines = cell.lines;
      cell.lines = this.toLines(cell.state);
      cell.lastLines = lastLines || cell.lines;
    });
  }

  toLines(state) {
    return [
      state % 2,
      (state >> 1) % 2,
      (state >> 2) % 2,
      (state >> 3) % 2,
      (state >> 4) % 2,
      (state >> 5) % 2,
    ];
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let q = this.board.drawStepQInc;
    if (this.board.drawStep == 0)
      this.initializeLines();
    let colors = this.config.fillColors;

    // Draw
    if (this.settings.drawRings) {
      this.drawEachCell((cell) => {
        if (!this.isAllowedState(cell.state)) return;
        let r = this.config.innerRadius;
        let color, cur, next = 1;
        for (let i = 5; i >= 0; i--) {
          cur = next;
          next = i / 6;
          if (this.config.drawStepInterval == 1) {
            color = cell.lines[i] ? colors[i + 1] : colors[0];
            adapter.drawShape(cell, r * cur, {fill: true, fillStyle: color});
          }
          else {
            if (q <= cur) {
              color = cell.lastLines[i] ? colors[i + 1] : colors[0];
              adapter.drawShape(cell, r * cur, {fill: true, fillStyle: color});
            }
            if (q > next) {
              color = cell.lines[i] ? colors[i + 1] : colors[0];
              adapter.drawShape(cell, Math.min(r * q, r * cur), {fill: true, fillStyle: color});
            }
          }
        }
      });
    }
  }
}
Board.registerPlugin(Hexagrams);

 class MidiMap extends Plugin {
  static getNoteLabels() {
    let labels = {};
    let scale = 'C#D#EF#G#A#B'.split('').map((e, i, a) => (e == '#' ? a[i - 1] : '') + e);
    return Array(128).fill().map((_, i) => {
      let note = scale[i % 12];
      let octave = Math.floor(i / 12);
      return note + octave;
    });
  }

  defaultSettings() {
    return `
      {
        defaultInterval: 500,
        stopPrevious: false,
        homeCell: [0, 0, 0],
        homeNote: 0x3c,
        channelsIn: {
          // (vel, note, cell) => state
          1: (v, n, c) => 1,
        },
        channelsOut: {
          // (state, note, cell) => vel || [vel, interval]
          1: (s, n, c) => s == 1 ? 0x3f : 0,
        },
        uStride: 4,
        vStride: 7,
        range: [0, 128],
        showNoteInfo: true,
        showFrames: true,
        constrainFrameToHex: true,
        deviceInIndex: null,
        deviceOutIndex: 0,
      }
    `;
  }

  _onSaveSettings() {
    if (!this.enabled)
      return;
    this.players && this.players.forEach((player) => player.stop());
    this.noteCellMap = new Map();
    this.cellNoteMap = new Map();
    this.playlists = {};
    this.players = new Set();
    this.stuckCells = new Map();
    this.inFn = {};
    this.outFn = {};
    Object.entries(this.settings.channelsIn).forEach(([k, v]) => this.inFn[parseInt(k) - 1] = v);
    Object.entries(this.settings.channelsOut).forEach(([k, v]) => this.outFn[parseInt(k) - 1] = v);
    this.channelsIn = Object.keys(this.inFn).map((e) => parseInt(e));
    this.channelsOut = Object.keys(this.outFn).map((e) => parseInt(e));
    let home = this.settings.homeNote;
    let [floor, ceil] = this.settings.range;
    let relHome = home - floor;
    let relRange = ceil - floor;
    let relMid = Math.floor(relRange / 2);
    let minDist = relHome > relMid ? ceil - home : relHome;
    let maxDist = relRange - minDist;
    let dist, minmaxFn;
    if (this.settings.constrainFrameToHex) {
      dist = minDist;
      minmaxFn = Math.min;
    }
    else {
      dist = maxDist;
      minmaxFn = Math.max;
    }
    let uStride = this.settings.uStride;
    let vStride = this.settings.vStride;
    let uwRange = Math.abs(Math.floor(dist / uStride));
    let vwRange = Math.abs(Math.floor(dist / vStride));
    let uvRange = Math.abs(Math.floor(dist / (uStride - vStride)));
    let radius = this.radius = minmaxFn(uwRange, vwRange, uvRange) + 1;
    this.homeCell = this.model.cellAtCubic(this.settings.homeCell) || this.model.cells[0];
    let cells = this.homeCell.wrap(radius);
    // Assign cells from outside in so overflow cells keep innermost assignment
    cells.reverse();
    for (let cell of cells) {
      let [u, v, w] = cell.coord.map((e, i) => e - this.homeCell.coord[i]);
      let note = home + u * uStride + v * vStride;
      if (note >= floor && note < ceil) {
        // Each cell has one note
        this.cellNoteMap.set(cell, note);
        // But each note potentially has more than one cell
        let noteCells = this.noteCellMap.get(note) || [];
        this.noteCellMap.set(note, noteCells);
        noteCells.push(cell);
      }
    }
    this.cells = Array.from(this.cellNoteMap.keys());
    this.notes = Array.from(new Set(this.noteCellMap.keys()));
    this.notes.sort();
    this.channelsOut.forEach((channel) => {
      let notelist = {};
      this.playlists[channel] = notelist;
      this.notes.forEach((note) => notelist[note] = []);
    });
    this.setDevices();
    this.board.clearFg();
  }

  _activate() {
    this.registerHook('clear', () => this.killAll());
    this.registerHook('step', () => this.onStep());
    this.registerHook('drawFg', () => this.onDrawFg());
    this.registerHook('paint', (cells) => this.onPaint(cells));
    this.registerHook('select', (cell) => this.onSelect(cell));
    this.registerHook('debugSelect', (cell) => this.onDebugSelect(cell));
  }

  _enable() {
    this._onSaveSettings();
    this.board.hooks.midiMessage = this.board.hooks.midiMessage || [];
  }

  _disable() {
    this.unsetDevices();
    if (!this.board.action)
      this.board.setInfoBox('tool', '');
    this.board.clearFg();
  }

  setDevices() {
    this.unsetDevices();
    this.noteLabels = MidiMap.getNoteLabels();
    if (!navigator.requestMIDIAccess)
      throw new Hexular.HexError('No MIDI support! Lame!');
    if (!(this.model instanceof Hexular.CubicModel))
      throw new Hexular.HexError('MidiMap plugin requires cubic model!');
    navigator.requestMIDIAccess().then((e) => {
      this.midiAccess = e;
      this.inputs = Array.from(e.inputs);
      this.outputs = Array.from(e.outputs);
      let deviceInEntry = this.inputs[this.settings.deviceInIndex];
      let deviceOutEntry = this.outputs[this.settings.deviceOutIndex];
      this.in = deviceInEntry && deviceInEntry[1];
      this.out = deviceOutEntry && deviceOutEntry[1];
      if (this.in)
        this.in.onmidimessage = (msg) => this.handleMessage(msg);
    });
  }

  unsetDevices() {
    this.killAll();
    if (this.in) {
      this.in.onmidimessage = null;
      this.in.close();
      this.in = null;
    }
    if (this.out) {
      this.out.onmidimessage = null;
      this.out.close();
      this.out = null;
    }
    this.midiAccess = this.inputs = this.outputs = null;
  }

  onStep(adapter) {
    if (!this.out)
      return;
    this.stuckCells.forEach((state, cell) => cell.state = state);
    // Stop existing notes if stopPrevious enabled
    this.settings.stopPrevious && this.players.forEach((e) => e.stop());
    // Start new players
    this.startCells(this.cells.filter((e) => !this.stuckCells.has(e)));
  }

  onPaint(cells) {
    this.startCells(cells.filter((e) => this.cells.includes(e)));
  }

  onDrawFg() {
    if (this.settings.showFrames) {
      let opts = {
        stroke: true,
        strokeStyle: this.config.selectColor,
        lineWidth: this.config.selectWidth,
      };
      if (this.settings.constrainFrameToHex) {
        opts.type = Hexular.enums.TYPE_FLAT;
        let radius = this.radius * this.config.cellRadius * Hexular.math.apothem * 2;
        this.board.fgAdapter.drawShape(this.homeCell, radius, opts);
      }
      else {
        opts.type = Hexular.enums.TYPE_POINTY;
        this.cells.forEach((cell) => {
          this.board.fgAdapter.drawShape(cell, this.config.cellRadius, opts);
        });
      }
    }
  }

  onSelect(cell) {
    if (this.board.action || !this.settings.showNoteInfo)
      return;
    let note = this.cellNoteMap.get(cell);
    this.board.setInfoBox('tool', note ? this.noteLabels[note] : '');
  }

  onDebugSelect(cell) {
    if (this.cells.includes(cell))
      console.log(`Cell ${cell}: ${this.cellNoteMap.get(cell)}`);
  }

  killAll() {
    // TODO: Is this working?
    if (!this.out)
      return;
    this.players.forEach((player) => player.stop());
    for (let channel of this.channelsOut) {
      this.notes.forEach((note) => this.out.send([0x90 + channel, note, 0]));
    }
  }

  startNote(channel, note, vel, interval) {
    new MidiPlayer(this, channel, note, vel, interval);
  }

  startPlayer(player) {
    if (!this.out)
      return;
    this.players.add(player);
    let {channel, note, vel} = player;
    let list = this.playlists[channel][note];
    list.push(player);
    this.out.send([0x90 + channel, note, 0]);
    this.out.send([0x90 + channel, note, vel]);
  }

  stopPlayer(player) {
    this.players.delete(player);
    if (!this.out)
      return;
    let {channel, note} = player;
    let list = this.playlists[channel][note];
    let idx = list && list.indexOf(player);
    if (idx != null && idx != -1) {
      let player = list.splice(idx, 1);
      let nextPlayer = list.slice(-1)[0];
      let nextVel = nextPlayer ? nextPlayer.vel : 0;
      this.out.send([0x90 + channel, note, nextVel]);
    }
  }

  startCells(cells) {
    cells.forEach((cell) => this.startCell(cell));
  }

  startCell(cell, stuck=false) {
    let note = this.cellNoteMap.get(cell);
    this.channelsOut.forEach((channel) => {
      let value = this.outFn[channel](cell.state, note, cell);
      let [vel, interval] = value.length ? value : [value, this.settings.defaultInterval];
      vel && this.startNote(channel, note, vel, stuck ? null : interval);
      stuck && this.stuckCells.set(cell, cell.state);
    });
  }

  handleMessage(msg) {
    let [cmd, note, vel] = msg.data;
    if (cmd >= 0x80 && cmd < 0xa0) {
      let cmdChan = 0x80 ^ cmd;
      let cells = this.noteCellMap.get(note) || [];
      for (let cell of cells) {
        if (cmdChan < 16 || !vel) {
          this.stuckCells.delete(cell);
          let player = Array.from(this.players).find((e) => !e.interval);
          player && player.stop();

        }
        else if (this.inFn[cmdChan - 16]){
          let state = this.inFn[cmdChan - 16](vel, note, cell);
          if (state !== undefined) {
            cell.setState(state);
            this.startCell(cell, true);
            this.board.draw();
          }
        }
      }
    }
    this.board.runHooks('midiMessage', msg);
  }
}
Board.registerPlugin(MidiMap);

class MidiPlayer {
  constructor(plugin, channel, note, vel, interval) {
    this.plugin = plugin;
    this.channel = channel;
    this.note = note;
    this.vel = vel;
    this.interval = interval;
    this.active = true;
    this.plugin.startPlayer(this);
    this.timer = this.interval && window.setTimeout(() => this.stop(), this.interval);
  }

  stop() {
    clearInterval(this.timer);
    this.plugin.stopPlayer(this);
  }
}

class QuadraticLines extends Plugin {
  defaultSettings() {
    return `
      {
        minAlpha: 1,
        maxAlpha: 1,
        curveCoef: 0.5,
        curveDiff: 0.75,
        drawOn: (a, b) => b <= a,
        pivot: 0.5,
        color: null,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
        inclusive: false,
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let model = this.model;
    let ctx = adapter.context;
    let settings = this.settings;
    let q = this.board.drawStepQInc;
    let pivotQ = this.getPivot(q, settings.pivot);
    this.globalAlpha = pivotQ * (settings.maxAlpha - settings.minAlpha) + settings.minAlpha;
    let curveCoef = settings.curveCoef * pivotQ;
    let curveCoefInv = 1 - curveCoef;
    let curveDiff = settings.curveDiff;
    let curveDiffInv = 1 - settings.curveDiff;
    let drawOn = this.settings.drawOn || (() => true);
    if (this.settings.color)
      ctx.fillStyle = this.settings.color;

    // Draw
    this.drawEachCell((cell) => {
      let allowed = this.isAllowedState(cell.state);
      let allowedInclusive = allowed && this.settings.inclusive;
      if (cell.edge || (!allowed && !this.settings.inclusive)) return;
      if (!this.settings.color)
        adapter.fillColor = this.config.strokeColors[cell.state];
      let [x, y] = model.cellMap.get(cell);
      for (let i = 0; i < 6; i++) {
        let n0 = cell.nbrs[i + 1];
        let n1 = cell.nbrs[(i + 1) % 6 + 1];
        let nbrAllowed = this.isAllowedState(n0.state) && drawOn(cell.state, n0.state);
        if (allowedInclusive || nbrAllowed) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          let [xn, yn] = model.cellMap.get(n0);
          let x0 = (x + xn) / 2;
          let y0 = (y + yn) / 2;
          let [x1, y1] = model.cellMap.get(n1);
          let xa = x1 * curveCoef + x0 * curveCoefInv;
          let ya = y1 * curveCoef + y0 * curveCoefInv;
          ctx.quadraticCurveTo(xa, ya, xn, yn);
          xa = xa * curveDiff + x0 * curveDiffInv;
          ya = ya * curveDiff + y0 * curveDiffInv;
          ctx.quadraticCurveTo(xa, ya, x, y);
          ctx.fill();
        }
      }
    });
  }
}
Board.registerPlugin(QuadraticLines);

class QuickPlugin extends Plugin {
  defaultSettings() {
    return `
      {
        hooks: (plugin) => ({
          onDraw: (adapter) => {
            let opts = {
              type: Hexular.enums.TYPE_POINTY,
              fill: true,
              stroke: false,
              fillStyle: null,
              alpha: 1,
              strokeStyle: null,
              lineWidth: plugin.config.cellBorderWidth,
              lineJoin: 'miter',
            };
            let radius = plugin.config.innerRadius;
            plugin.drawEachCell((cell) => {
              if (!plugin.isAllowedState(cell.state)) return;
              opts.fillStyle = plugin.config.fillColors[cell.state];
              plugin.adapter.drawShape(cell, radius, opts);
            });
          },
          onDrawCell: (cell, adapter) => {},
          onClear: () => {},
          onBeforeStep: () => {},
          onAutopauseStep: () => {},
          onStep: () => {},
          onDrawStep: () => {},
          onPlayStart: () => {},
          onPlayStop: () => {},
          onSelect: (cell) => {},
          onDebugSelect: (cell) => {},
          onPaint: (cells) => {},
          onUpdatePreset: () => {},
          onUpdateTheme: () => {},
          onEnable: () => {},
          onDisable: () => {},
        }),
        stateWhitelist: null,
        stateBlacklist: null,
      }
    `;
  }

  _onSaveSettings() {
    this.hooks = this.settings.hooks && this.settings.hooks(this);
    this.board.draw();
  }

  _activate() {
    this.registerHook('draw', this.callFn('onDraw'));
    this.registerHook('drawCell', this.callFn('onDrawCell'));
    this.registerHook('clear', this.callFn('onClear'));
    this.registerHook('beforeStep', this.callFn('onBeforeStep'));
    this.registerHook('autopauseStep', this.callFn('onAutopauseStep'));
    this.registerHook('step', this.callFn('onStep'));
    this.registerHook('drawStep', this.callFn('onDrawStep'));
    this.registerHook('select', this.callFn('onSelect'));
    this.registerHook('debugSelect', this.callFn('onDebugSelect'));
    this.registerHook('paint', this.callFn('onPaint'));
    this.registerHook('updatePreset', this.callFn('onUpdatePreset'));
    this.registerHook('updateTheme', this.callFn('onUpdateTheme'));
  }

  _enable() {
    this.callFn('onEnable')();
  }

  _disable() {
    this.callFn('onDisable')();
  }

  callFn(key) {
    return (...args) => this.hooks[key] && this.hooks[key](...args);
  }
}
Board.registerPlugin(QuickPlugin);

class RotatorExpander extends Plugin {
  defaultSettings() {
    return `
      {
        angleOffset: 0,
        angleDelta: Math.PI / 3,
        fadeIndex: 0, // 0-1
        minRadius: 0.5,
        baseRadius: 1,
        maxRadius: 1.5,
        minAlpha: 1,
        baseAlpha: 1,
        maxAlpha: 1,
        fill: true,
        stroke: false,
        lineWidth: null,
        lineJoin: null,
        color: null,
        upQ: 1,
        downQ: 1,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let {
      angleOffset, angleDelta, fadeIndex, minRadius, baseRadius, maxRadius,
      minAlpha, baseAlpha, maxAlpha, fill, stroke, lineWidth, lineJoin, color, upQ, downQ
    } = this.settings;
    let q = this.board.drawStepQInc;
    upQ = this.getPivot(q, upQ);
    downQ = 1 - this.getPivot(q, downQ);
    let fadeQ = this.getFade(q);
    let angle = angleOffset + angleDelta * q;
    let upRadius = this.config.innerRadius * ((maxRadius - baseRadius) * upQ + baseRadius);
    let downRadius = this.config.innerRadius * ((baseRadius - minRadius) * downQ + minRadius);
    let upAlpha = (maxAlpha - baseAlpha) * upQ + baseAlpha;
    let downAlpha = (baseAlpha - minAlpha) * downQ + minAlpha;
    lineWidth = lineWidth != null ? lineWidth : this.config.cellBorderWidth;
    lineJoin = lineJoin || this.config.defaultJoin;
    let fillColors = this.config.fillColors.slice();
    let strokeColors = this.config.strokeColors.slice();
    if (this.settings.color) {
      ctx.fillStyle = this.settings.color;
      ctx.strokeStyle = this.settings.color;
    }

    // Draw
    this.drawEachCell((cell) => {
      if (!this.isAllowedState(cell.state)) return;
      let [r, a] = cell.state - cell.lastState > 0 ? [upRadius, upAlpha] : [downRadius, downAlpha];
      let p = [];
      for (let i = 0; i < 6; i++) {
        let x = r * Math.cos(angle + Hexular.math.tau / 6 * i);
        let y = r * Math.sin(angle + Hexular.math.tau / 6 * i);
        p.push([x, y]);
      }
      let color;
      adapter.drawPath(cell, p);
      let fade = fadeQ < 1;
      ctx.globalAlpha = a;
      if (this.settings.fill) {
        if (!this.settings.color) {
          color = fillColors[cell.state] || Color.t;
          if (fade) color = color.blend(fillColors[cell.lastState], fadeQ);
          adapter.fillColor = color;
        }
        ctx.fill();
      }
      if (this.settings.stroke && lineWidth) {
        if (!this.settings.color) {
          color = strokeColors[cell.state] || Color.t;
          if (fade) color = color.blend(strokeColors[cell.lastState], fadeQ);
          adapter.strokeColor = color;
        }
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = lineJoin;
        ctx.stroke();
      }
    });
  }
}
Board.registerPlugin(RotatorExpander);

class SimpleExpander extends Plugin {
  defaultSettings() {
    return `
      {
        shapeType: Hexular.enums.TYPE_POINTY,
        drawLast: true,
        drawTerminal: true,
        minRadius: 0,
        maxRadius: 1,
        fill: true,
        stroke: false,
        lineWidth: null,
        lineJoin: null,
        color: null,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let min = this.settings.minRadius;
    let max = this.settings.maxRadius;
    let r = this.config.innerRadius;
    let q = this.board.drawStepQInc;
    let radius = r * ((max - min) * q + min);
    let maxRadius = r * max;
    let invRadius = r * ((max - min) * (1 - q) + min);
    let opts = {
      type: this.settings.shapeType,
      fill: this.settings.fill,
      stroke: this.settings.stroke,
      lineWidth: this.settings.lineWidth != null ? this.settings.lineWidth : this.config.cellBorderWidth,
      lineJoin: this.settings.lineJoin || this.config.defaultJoin,
    };
    let fillColors = this.config.fillColors.slice();
    let strokeColors = this.config.strokeColors.slice();
    if (this.settings.color) {
      fillColors.fill(this.settings.color);
      strokeColors.fill(this.settings.color);
    }

    // Draw
    this.drawEachCell((cell) => {
      let allowed =this.isAllowedState(cell.state);
      let lastAllowed = this.isAllowedState(cell.lastState);
      let fill, stroke;
      if (lastAllowed) {
        opts.fillStyle = fillColors[cell.lastState];
        opts.strokeStyle = strokeColors[cell.lastState];
        if (allowed && this.settings.drawLast) {
          adapter.drawShape(cell,  maxRadius, opts);
        }
        else if (this.settings.drawTerminal) {
          adapter.drawShape(cell, invRadius, opts);
        }

      }
      if (allowed) {
        opts.fillStyle = fillColors[cell.state];
        opts.strokeStyle = strokeColors[cell.state];
        adapter.drawShape(cell, radius, opts);
      }
    });
  }
}
Board.registerPlugin(SimpleExpander);

class SimpleLines extends Plugin {
  defaultSettings() {
    return `
      {
        color: 'max', // 'max'|'min'|'blend'|string|function
        fadeIndex: 0, // 0-1
        minAlpha: 1,
        maxAlpha: 1,
        minWidth: null,
        maxWidth: null,
        lineCap: null,
        alphaPivot: 0.5,
        widthPivot: 0.5,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
        inclusive: false,
        isolate: false,
        edges: false,
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  onDraw(adapter) {
    // Setup
    let ctx = adapter.context;
    let colors = this.config.strokeColors;
    let settings = this.settings;
    let minWidth = this.settings.minWidth != null ? this.settings.minWidth : this.config.cellBorderWidth;
    let maxWidth = this.settings.maxWidth != null ? this.settings.maxWidth : this.config.cellBorderWidth;
    let q = this.board.drawStepQInc;
    let fadeQ = this.getFade(q);
    let alphaPivotQ = this.getPivot(q, this.settings.alphaPivot);
    let widthPivotQ = this.getPivot(q, this.settings.widthPivot);
    this.globalAlpha = settings.minAlpha + alphaPivotQ * (settings.maxAlpha - settings.minAlpha);
    let width = minWidth + widthPivotQ * (maxWidth - minWidth);
    let lineCap = this.settings.lineCap || 'round';
    let verts = Hexular.math.scalarOp(Hexular.math.flatVertices, this.config.cellRadius * 2 * Hexular.math.apothem);

    let colorSetting = this.settings.color;
    let colorFn = (typeof colorSetting == 'function') ? colorSetting : null;
    // Draw
    if (width) {
      this.drawEachCell((cell) => {
        let allowed = this.isAllowedState(cell.state);
        let allowedInclusive = allowed && this.settings.inclusive;
        if (!allowed && !this.settings.inclusive) return;
        let [x, y] = this.model.cellMap.get(cell);
        for (let i = 0; i < 6; i += 2) {
          let nbr = cell.nbrs[i + 1];
          let nbrAllowed = this.isAllowedState(nbr.state);
          let cond = this.settings.isolate ? nbr.state == cell.state : allowedInclusive || nbrAllowed;
          if (cond && (this.settings.edges || cell.edge + nbr.edge < 2)) {
            let color;
            if (colorFn)
              color = colorFn(cell, nbr);
            else if (colorSetting == 'max')
              color = colors[Math.max(cell.state, nbr.state)] || Color.t;
            else if (colorSetting == 'min')
              color = colors[Math.min(cell.state, nbr.state)] || Color.t;
            else if (colorSetting == 'blend')
              color = Color.blend(colors[cell.state], colors[nbr.state]);
            if (!color)
              ctx.strokeStyle = colorSetting;
            else if (fadeQ < 1) {
              let lastColor;
              if (colorFn)
                color = colorFn(cell, nbr);
              else if (colorSetting == 'max')
                lastColor = colors[Math.max(cell.lastState, nbr.lastState)] || Color.t;
              else if (colorSetting == 'min')
                lastColor = colors[Math.min(cell.lastState, nbr.lastState)] || Color.t;
              else if (colorSetting == 'blend')
                lastColor = Color.blend(colors[cell.lastState], colors[nbr.lastState]);
              adapter.strokeColor = color.blend(lastColor, fadeQ);
            }
            else
              adapter.strokeColor = color;
            ctx.lineWidth = width;
            ctx.lineCap = lineCap;
            let xn = x + verts[i][0];
            let yn = y + verts[i][1];
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(xn, yn);
            ctx.stroke();
          }
        }
      });
    }
  }
}
Board.registerPlugin(SimpleLines);

class VertexShapes extends Plugin {
  defaultSettings() {
    return `
      {
        shapeType: Hexular.enums.TYPE_TRI_AUTO,
        color: 'blend', // 'max'|'min'|'blend'|string|function
        fadeIndex: 0, // 0-1
        angleOffset: 0,
        angleDelta: 0,
        anglePivot: 0.5,
        minOpacity: 1,
        maxOpacity: 1,
        opacityPivot: 0.5,
        minRadius: 1,
        maxRadius: 1,
        radiusPivot: 0.5,
        minWidth: null,
        maxWidth: null,
        widthPivot: 0.5,
        fill: true,
        stroke: false,
        lineJoin: null,
        blendMode: null,
        stateWhitelist: null,
        stateBlacklist: [0],
        inclusive: true,
        isolate: false,
        edges: false,
      }
    `;
  }

  _onSaveSettings() {
    this.updateMaps();
  }

  _activate() {
    this.registerHook('clear', () => this.updateMaps());
    this.registerHook('step', () => this.onStep)
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  _enable() {
    this.updateMaps();
  }

  onDraw(adapter) {
    // Setup
    let model = this.model;
    let ctx = adapter.context;
    let fillColors = this.config.fillColors;
    let strokeColors = this.config.strokeColors;
    let q = this.board.drawStepQInc;
    let {
      shapeType,
      angleOffset,
      angleDelta,
      anglePivot,
      minOpacity,
      maxOpacity,
      opacityPivot,
      minRadius,
      maxRadius,
      radiusPivot,
      minWidth,
      maxWidth,
      widthPivot,
      inclusive,
      isolate,
      edges,
    } = this.settings;
    minWidth = minWidth != null ? minWidth : this.config.cellBorderWidth;
    maxWidth = maxWidth != null ? maxWidth : this.config.cellBorderWidth;
    let fadeQ = this.getFade(q);
    let angleQ = this.getPivot(q, anglePivot);
    let opacityQ = this.getPivot(q, opacityPivot);
    let radiusQ = this.getPivot(q, radiusPivot);
    let widthQ = this.getPivot(q, widthPivot);
    let angle = angleQ * angleDelta + angleOffset;
    this.globalAlpha = opacityQ * (maxOpacity - minOpacity) + minOpacity;
    let radius = model.cellRadius * (radiusQ * (maxRadius - minRadius) + minRadius);
    let lineWidth = minWidth + widthQ * (maxWidth - minWidth);
    let lineJoin = this.settings.lineJoin || 'miter';
    let transVerts = Hexular.math.scalarOp(Hexular.math.pointyVertices, model.cellRadius);
    let paths;
    if (shapeType != Hexular.enums.TYPE_CIRCLE) {
      let matrix = Hexular.math.scalarOp(Hexular.math.rotationMatrix(angle), radius);
      if (adapter.shapes[shapeType]) {
        let path = adapter.shapes[shapeType].map((v) => Hexular.math.matrixMult(matrix, v));
        paths = [path, path];
      }
      else {
        let path0, path1;
        if (shapeType == Hexular.enums.TYPE_TRI_ANTI_AUTO) {
          path0 = adapter.shapes[Hexular.enums.TYPE_TRI_DOWN];
          path1 = adapter.shapes[Hexular.enums.TYPE_TRI_UP];
        }
        else { // Default to Hexular.enums.TYPE_TRI_AUTO
          path0 = adapter.shapes[Hexular.enums.TYPE_TRI_UP];
          path1 = adapter.shapes[Hexular.enums.TYPE_TRI_DOWN];
        }
        paths = [path0, path1].map((p) => p.map((v) => Hexular.math.matrixMult(matrix, v)));
      }
    }

    let colorSetting = this.settings.color;
    let colorFn = (typeof colorSetting == 'function') ? colorSetting : null;

    // Draw
    this.drawEachCell((cell) => {
      let allowed = this.isAllowedState(cell.state);
      if (!allowed && !inclusive) return;
      let [xo, yo] = model.cellMap.get(cell);
      let lastFill = this.lastFill.get(cell);
      let lastStroke = this.lastStroke.get(cell);
      for (let i = 0; i < 2; i++) {
        let n0 = cell.nbrs[i * 3 + 1];
        let n1 = cell.nbrs[i * 3 + 2];
        if (!edges && cell.edge + n0.edge + n1.edge > 2)
          continue;
        if (!isolate) {
          let allowed0 = this.isAllowedState(n0.state);
          let allowed1 = this.isAllowedState(n1.state);
          let allowedInclusive = inclusive && (allowed || allowed0 || allowed1);
          let allowedExclusive = allowedInclusive || allowed && allowed0 && allowed1;
          if (!allowedInclusive && !allowedExclusive)
            continue;
        }
        else if (n0.state != cell.state || n1.state != cell.state) {
          continue;
        }
        let [x, y] = transVerts[(i * 3 + 1) % 6];
        x += xo;
        y += yo;
        // Draw shapes
        if (shapeType == Hexular.enums.TYPE_CIRCLE) {
          ctx.moveTo(x, y);
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
        }
        else {
          adapter.drawPath([x, y], paths[i]);
        }
        // Fill and stroke
        let colorFill, colorStroke;
        if (colorFn) {
          colorFill = colorFn(cell, n0, n1, Hexular.enums.FILL);
          colorStroke = colorFn(cell, n0, n1, Hexular.enums.STROKE);
        }
        else if (colorSetting == 'max') {
          colorFill = fillColors[Math.max(cell.state, n0.state, n1.state)];
          colorStroke = strokeColors[Math.max(cell.state, n0.state, n1.state)];
        }
        else if (colorSetting == 'min') {
          colorFill = fillColors[Math.min(cell.state, n0.state, n1.state)];
          colorStroke = strokeColors[Math.max(cell.state, n0.state, n1.state)];
        }
        else if (colorSetting == 'blend') {
          let c, c0, c1;
          c = fillColors[cell.state];
          c0 = fillColors[n0.state];
          c1 = fillColors[n1.state];
          colorFill = Color.blend(c, c0, c1);
          c = strokeColors[cell.state];
          c0 = strokeColors[n0.state];
          c1 = strokeColors[n1.state];
          colorStroke = Color.blend(c, c0, c1);
        }
        else {
          ctx.fillStyle = colorSetting;
          ctx.strokeStyle = colorSetting;
        }
        if (colorFill) {
          if (fadeQ < 1) {
            colorFill = colorFill.blend(lastFill[i], fadeQ);
            colorStroke = colorStroke.blend(lastStroke[i], fadeQ);
          }
          adapter.fillColor = colorFill;
          adapter.strokeColor = colorStroke;
        }
        this.settings.fill && ctx.fill();
        if (this.settings.stroke && lineWidth) {
          ctx.lineJoin = lineJoin;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }
        lastFill[i] = colorFill;
        lastStroke[i] = colorStroke;
      }
    });
  }

  updateMaps() {
    this.lastFill = new Map();
    this.lastStroke = new Map();
    this.model.eachCell((cell) => {
      this.lastFill.get(cell) ||
        this.lastFill.set(cell, Array(3).fill().map(() => Color.t));
      this.lastStroke.get(cell) ||
        this.lastStroke.set(cell, Array(3).fill().map(() => Color.t));
    });
  }
}
Board.registerPlugin(VertexShapes);

class WaveCore extends Plugin {
  defaultSettings() {
    return `
      {
        // Requires custom drawing functionality provided by e.g. WaveDraw plugin
        c: (cell) => 0.5,
        decay: (cell) => 1,
        friction: (cell) => 1,
        initialState: (cell) => 0,
        initialV: (cell) => 0,
        initialA: (cell) => 0,
        beforeStep: (plugin) => {
          return; // Remove to enable
          let period = 60;
          let amp = 120;
          let add = false;
          let step = plugin.config.steps % period;
          let cell = plugin.model.cells[0];
          let lastS = plugin.sMap.get(cell);
          let lastV = plugin.vMap.get(cell);
          let newS = Math.sin(step / period * Math.PI * 2) * amp;
          newS += add ? lastS : 0;
          let newV = newS - lastS;
          let newA = newV - lastV;
          plugin.sMap.set(cell, newS);
          plugin.vMap.set(cell, newV);
          plugin.aMap.set(cell, newA);
        }
      }
    `;
  }

  _activate() {
    this.registerHook('beforeStep', () => this.onBeforeStep());
    this.registerHook('autopauseStep', () => this.onAutopauseStep());
    this.registerHook('clear', () => this.onClear());
    this.registerHook('debugSelect', (cell) => {
      let s = this.sMap.get(cell);
      let v = this.vMap.get(cell);
      let a = this.aMap.get(cell);
      console.log(cell.coord, s, v, a);
    });
  }

  _enable() {
    this.sMap = this.shared.get(this, 'sMap', new Map());
    this.vMap = this.shared.get(this, 'vMap', new Map());
    this.aMap = this.shared.get(this, 'aMap', new Map());
    let setS = this.sMap.size == 0;
    let setV = this.vMap.size == 0;
    let setA = this.aMap.size == 0;
    this.initCells(setS, setV, setA);
  }

  _disable() {
    this.shared.delete(this, 'sMap');
    this.shared.delete(this, 'vMap');
    this.shared.delete(this, 'aMap');
  }

  initCells(setS, setV, setA) {
    this.model.eachCell((cell) => {
      setS && this.sMap.set(cell, this.settings.initialState(cell));
      setV && this.vMap.set(cell, this.settings.initialV(cell));
      setA && this.aMap.set(cell, this.settings.initialA(cell));
    });
  }

  onClear() {
    this.initCells(true, true, true);
  }

  onBeforeStep() {
    this.settings.beforeStep && this.settings.beforeStep(this);
  } 

  onAutopauseStep() {
    let curMap = new Map(this.sMap);
    let minIdx = this.model.cells[0].minIdx;
    let maxIdx = this.model.cells[0].maxIdx;
    for (let cell of this.model.cells) {
      let sTotal = 0;
      for (let i = minIdx; i < maxIdx; i++) {
        sTotal += curMap.get(cell.nbrs[i]);
      }
      let a = (sTotal - this.sMap.get(cell) * cell.neighborhood) * this.settings.c(cell) ** 2;
      let v = (this.vMap.get(cell) + a) * this.settings.friction(cell);
      let s = (curMap.get(cell) + v) * this.settings.decay(cell);
      this.sMap.set(cell, s);
      this.vMap.set(cell, v);
      this.aMap.set(cell, a);
    }
    this.sArray = Float64Array.from(this.sMap.values());
    this.vArray = Float64Array.from(this.vMap.values());
    this.aArray = Float64Array.from(this.aMap.values());
    // TODO: Save this to meta
    this.model.changed = true;
  }
}
Board.registerPlugin(WaveCore);

class WaveDraw extends Plugin {
  defaultSettings() {
    return `
      {
        // For use with WaveCore plugin
        drawFn: (plugin, cell, s, v, a) => {
          let hue = s;
          let sat = 1 - Math.tanh(Math.abs(v));
          let light = Math.tanh(Math.abs(a));
          plugin.adapter.context.fillStyle = \`hsl(\${hue * 60}, \${sat * 100}%, \${light * 100}%)\`;
          plugin.adapter.drawPath(cell, plugin.config.pointyVertices);
          plugin.adapter.context.fill();
        },
        // Set to [0, 1] to use only current cell value, [0, 19] for full 19-cell average, etc.
        selectNeighborRange: [0, 7],
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  _enable() {
    this.sMap = this.shared.get(this, 'sMap', new Map());
    this.vMap = this.shared.get(this, 'vMap', new Map());
    this.aMap = this.shared.get(this, 'aMap', new Map());
  }

  _disable() {
    this.shared.delete(this, 'sMap');
    this.shared.delete(this, 'vMap');
    this.shared.delete(this, 'aMap');
  }

  onDraw(adapter) {
    let ctx = adapter.context;
    let avgMapS = new Map();
    let avgMapV = new Map();
    let avgMapA = new Map();
    let [nStart, nEnd] = this.settings.selectNeighborRange;
    let nSize = nEnd - nStart;
    this.model.eachCell((cell) => {
      let totalS = 0;
      let totalV = 0;
      let totalA = 0;
      for (let i = nStart; i < nEnd; i++) {
        totalS += this.sMap.get(cell.nbrs[i]);
        totalV += this.vMap.get(cell.nbrs[i]);
        totalA += this.aMap.get(cell.nbrs[i]);
      }
      avgMapS.set(cell, totalS / nSize);
      avgMapV.set(cell, totalV / nSize);
      avgMapA.set(cell, totalA / nSize);
    });
    this.drawEachCell((cell) => {
      let s = avgMapS.get(cell);
      let v = avgMapV.get(cell);
      let a = avgMapA.get(cell);
      this.settings.drawFn(this, cell, s, v, a);
    });
  }
}
Board.registerPlugin(WaveDraw);
