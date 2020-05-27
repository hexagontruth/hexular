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
      // Default size for cubic (hexagonal) topology
      radius: 30,
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
       * Enumerator representing flat-topped, the greatest of all hexagons.
       *
       * @name TYPE_FLAT
       * @default 0
       * @constant
       * @memberof Hexular.enums
       */
      TYPE_FLAT: 0,

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
       * @default 2
       * @constant
       * @memberof Hexular.enums
       */
      TYPE_CIRCLE: 2,

      /**
       * Enumerator representing triangles whose orientation can be contextually inferred.
       * 
       * (For instance, the alternating members of a hex grid's dual triangular grid.)
       *
       * @name TYPE_CIRCLE
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
      [-1, 0],
      [-0.5, -APOTHEM],
      [0.5, -APOTHEM],
      [1, 0],
      [0.5, APOTHEM],
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
     * @see {@link Model#arrayType})
     * @see {@link Model#export}
     */
    import(array) {
      this.cells.forEach((cell, idx) => {
        cell.setState(array[idx] || this.groundState);
      });
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
         * @name CubicModel#radius
         * @type number
         * @default 30
         */
        radius: Hexular.defaults.radius,
      };
      Object.assign(this, defaults, ...args);
      HexError.validateKeys(this, 'radius');
      this.size = this.radius * (this.radius - 1) * 3 + 1;
      let max = this.max = this.radius - 1;
      let cols = this.cols = this.radius * 2 - 1;
      this.rhombus = Array(cols * 2).fill(null);

      this.eachCoord(([u, v, w]) => {
          // Being on an edge affects draw actions involving neighbors
          let edge = absMax(u, v, w) == max;
          this.rhombus[u * cols + v] = new Cell(this, [u, v, w], {edge});
      });

      // A hack for the trivial case
      if (this.radius == 1) {
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
      }

      /**
       * `CubicModel` orders its `cells` array in rings from the center out, starting with a zero-indexed origin cell.
       * This allows cell states to be backed up and restored via {@link Model#export} and {@link Model#import} across
       * differently-sized maps. Cells always remain centered and in the correct order, though a smaller map will
       * truncate cells outside of its radius.
       *
       * @name CubicModel.cells
       * @type Cell[]
       */
      this.cells = hexWrap(this.rhombus[0], this.radius);

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

    getCoord(cell) {
      let r = this.cellRadius;
      let [u, v, w] = cell.coord;

      let [x, y] = matrixMult(this.basis, [v, u]);
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
      console.log(idx, idx >= -1);
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
        if (val == null) continue;
        let defaultBaseVal = Array.isArray(val) ? [] : typeof val == 'object' ? {} : null;
        let baseVal = base[key] || defaultBaseVal;
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

  // --- UTILITY FUNCTIONS ---

  /**
   * Given a cell with immediately-connected neighbors, find all cells out to a given radius, ordered by radial ring.
   *
   * This is used to order {@link CubicModel#cells}, and by the hex-drawing tools in Hexular Studio.
   *
   * @param {Cell} origin   Central cell
   * @param {number} radius A natural number greater than 0
   * @return {Cell[]}        An array of cells, including the origin, of length `3 * radius * (radius - 1) + 1`
   * @memberof Hexular.util
   * @see {@link Cell#nbrs}
   */
  function hexWrap(origin, radius) {
    let cells = [origin];
    for (let i = 1; i < radius; i++) {
      let cell = origin;
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
    else if (du > dw)
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
      hexWrap,
      ruleBuilder,
      templateRuleBuilder,
    },
    math: {
      mod,
      clamp,
      scalarOp,
      matrixMult,
      vectorAdd,
      absMax,
      cartesianToCubic,
      roundCubic,
      flatVertices: math.vertices,
      pointyVertices: math.vertices.map(([x, y]) => [y, x]),
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
