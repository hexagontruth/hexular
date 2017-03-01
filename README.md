Hexular
=======

An extensible hexagonal CA platform
-----------------------------------

### Overview

Hexular is an extensible platform for creating and running hexagonal cellular automata (CAs) in a browser, released in commemoration of Hexagonal Awareness Month 2017.

When initialized, a Hexular instance creates a toroidally-connected grid of cells and an associated canvas element. This canvas can then be attached to the DOM with the appropriate event handlers, etc.

Some useful instance methods:

- `draw()` — Draws all cells on canvas.
- `drawCell(cell)` — Draws an individual cell
- `selectCell(cell)` — Highlights individual cell
- `cellAtPosition(y, x)` — Returns cell at given coordinates on the canvas
- `start()` — Start step timer
- `stop()` — Stop step timer
- `step()` — Perform single state increment step (including redraw)

### Customization

#### General configuration

The Hexular constructor accepts one options object, and any number of rule functions. The arguments can be given in any order, but the rule functions are, sensibly, assigned sequentially starting at 0. The available options, along with their default values, can be found at the top of `hexular.js`. Some useful ones:

- rows
- cols
- numStates
- maxStates
- timer
- colors

`numStates` can be changed at any time, and is mostly only used internally for performing modular arithmetic calculations in the cell helper functions. Its value should be less than or equal to `maxStates`.

#### Rules

Cell rules are given on a per-state basis, and applied individually to each cell. The rules are stored in the `hexular.rules` array, and can be reassigned at any time.

A valid rule is a function that take a cell as an argument, and return an integer value corresponding to the next desired state. As such, the rule function has access to the cell's current state, its neighbors' states (through `cell.neighbors`), and by extension the state of every cell in the grid.

Thus one could, if one were so inclined, create rules utilizing larger local neighborhoods, additional internal state data, etc.

##### Rule helpers

Cell instances have several helper methods to perform common rule calculations:

- `total()` — Returns sum of all neighboring states
- `countAll()` — Returns count of nonzero neighbors
- `count(state)` — Returns number of neighbors with given state value
- `counts()` — Returns `numStates`-sized array with neighbor counts for each
- `stateMap()` — Returns array of neighbor states
- `max([states])` — Returns maximum of `states` or `stateMap()`
- `min([states])` — Returns minimum of `states` or `stateMap()`
- `offset(n)` — Increments state by `n` mod `numStates`

Some of these are computationally expensive and probably not advisable. In a simple two-state system, `total()` and `countAll()` will return the same values, and either will suffice to implement any simple, isotropic neighborhood rule.

### Demo

The main control buttons should be fairly self-explanatory. Cell states are changed by clicking and dragging. The "paint value" is determined by the state of the initially-clicked cell, and is the next state up, mod `numStates`.

#### Keyboard controls

- ESC — Toggle controls / close config overlay
- TAB — Start/Stop
- SPACE — Step
- SHIFT + CLICK — Set selected state to zero

#### Prepopulated rules

Several predefined rules are given in the `hexular-rules.js` file, though these are simply for convenience and not meant to be exhaustive. The default rule for zero cells is "standardOff," which promotes cells to state 1 when they have exactly 2 activated neighbors (state > 0), while the default rule for the remaining states is "simpleIncrementor," which I included largely as a simple Life-like demonstration of the multistate capabilities of Hexular. This rule does however have some interesting properties, such as a tendency to "gliderize" easily. (This seems true to some extent of many multistate rules involving sequential state progression, since they seem to produce "propulsion tails" that impart velocity to local configurations.)

For a more traditional binary state system roughly corresponding to the rules of Conway's Game of Life, set `numStates` to 2 and the state 1 rule to "standardOn."

#### Configuration

The configuration overlay consists of a range input for `numStates`, twelve select boxes for assigning predefined rules to state values, and an assign-all select box for setting all rules at once. The per-state select boxes are enabled or disabled as appropriate when the number of states is changed.

#### Customization

In the configuration interface provided in `hexular-demo`, the rule assignment select menus are populated with the contents of the `rules` object loaded from `hexular-rules.js`. Custom rules may be added to this object via the console, but the menus will only be refreshed when `initRuleMenus()` is run.

One can replace the entire Hexular instance, and refresh the rules menus, by running

        init([rows, [cols, [numStates]]])

### Additional notes

My consistent adherence to the right-hand rule with respect to coordinate vectors has led me to arrange all screen coordinate tuples in the order (y,x) rather than the more familiar (x,y) whenever possible. I make no apologies for this, and anyone who has a problem with it is wrong and should feel bad.

Finally, this wasn't really written for backwards compatibility, and may not work at all on older browsers. Replacing `let` and `const` with `var` may help.

#### Links

- This program was originally inspired as a generalization of David Siaw's similarly browser-based Hexlife program:

  https://github.com/davidsiaw/hexlife

- Despite my general expertise in this area, I continue to find Amit Patel's "Hexagonal Grids" page to be an invaluable resource when dealing with hex grids:

  http://www.redblobgames.com/grids/hexagons/

- For more information on HEXAGONAL AWARENESS, please visit:

  https://hexnet.org/
