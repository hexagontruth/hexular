Hexular
=======

An extensible hexagonal CA platform.

(C) 2020 Graham Steele. Distributed under the Hexagonal Awareness License.

## Overview

- View demo: https://hexagrahamaton.github.io/hexular
- Github: https://github.com/hexagrahamaton/hexular

Hexular is an extensible hexagonal cellular automata (CA) platform for JavaScript environments, presently built around several core concepts:

 - A **model** represents a topology of cells with a given state. Hexular includes two built-in model classes:
    - `CubicModel` (default)
    - `OffsetModel`
 - **Cells** represents individual elements in a model topology. Each is associated with a particular state. Many included helper functions assume this state will be a natural number, but it can be anything.
 - **Adapters** are extensions for e.g. rendering a model's state. Particularly, e.g., `CanvasAdapter`, which displays a model on a user agent canvas.

 The `Hexular` function (defined globally in the DOM or exported by the standalone module) returns a new model instance.

 The `Hexular` object also contains the following attributes, providing ergonomic access to all functionality necessary for the
 end user to implement her own extensions via the Hexular API:

 - `Hexular`
    - `classes`
      - `models`
      - `adapters`
    - `filters`
    - `math`
    - `rules`
    - `util`

Some useful `Model` methods:

- `step()` — Perform single state increment step
- `clear()` — Clear all cell states

States are not drawn or redrawn on screen with adapters. Useful `Adapter` methods include:

- `draw()` — Draws all cells
- `drawCell(cell)` — Draws an individual cell
- `selectCell(cell)` — Highlights individual cell
- `cellAt(x, y)` — Returns cell at given coordinates on the canvas

## Customization

### General configuration

The Hexular constructor accepts option arguments, which differ between different topologies.

`CubicModel` is morphologically determined by its `radius`, which gives the number of rings of cells from the center to the edge. So, e.g., a seven-cell grid would have radius 2. Conversely, `OffsetModel` takes `rows` and `cols` arguments (whose meaning should be obvious).

`numStates` can be similarly set on instantiation or changed at any time, and is only used internally by `modFilter`, when enabled, to compute cell states.

### Rules

Cell rules are given on a per-state basis, and applied individually to each cell. The rules are stored in the `hexular.rules` array, and can be reassigned at any time.

A valid rule is a function that take a cell as an argument, and return a value corresponding to the next desired state. Hexular is generally strongly opinionated towards these states being natural numbers, but they can in principle be anything that can be coerced into a JavaScript object key. The rule function has access to the cell's current state, its neighbors' states (through `cell.nbrs` and the neighborhood-bound helper functions), and by extension the state of every cell in the grid — though philosophically speaking CAs should only consider cell states within some finite local neighborhood.

One could, if one were so inclined, create rules utilizing larger local neighborhoods, additional internal state data, etc.

#### Rule helpers

Cell instances have several helper methods to perform common rule calculations:

- `total` — Returns sum of all neighboring states
- `count` — Returns count of activated (nonzero) neighbors
- `histogram` — Returns a `numStates`-sized array with counts of individual states across all neighbors

A cell's `neighborhood` property determines which cells to iterate over when a rule calls these methods. The default is a cell's immediate six neighbors, however this can be set to several more expansive options, including the optional ability to include a cell's own state. Rules can call these helper methods on neighborhoods specifically via the `cell.with` attribute, e.g.:

        cell.with[19].count

All cell neighborhoods can be set via `model.setNeighborhood(n)`, where `n` is one of `[6, 12, 18, 7, 13, 19]`.

## Demo

The main control buttons are, from left to right:

- Start (Tab) — Step model at 100ms intervals (though this may be significantly slower for larger grids)
- Step (Space) — Perform individual step
- Clear (Ctrl+C)
- Undo (Ctrl+Z)
- Redo (Ctrl+Shift+Z)
- Config — Open configuration modal
- Save (Ctrl+S)
- Load (Ctrl+O)
- Resize board
- Show documentation

Additionally, `<Escape>` toggles button and coordinate indicator visibility, or conversely closes the configuration modal if it is open.

Cell states are changed by clicking and — on desktops — dragging. The new state is determined by the state of the initially-clicked cell, and is the successor to the current state modulo `hexular.numStates`. Right clicking, conversely, decrements the cell state by one. Shift clicking clears states.

### Prepopulated rules

Several predefined rules are given in `demo/rules.js`, though these are largely for convenience and not meant to be exhaustive. Additionally, the rules are organized into several "presets," or lists of 2-12 rules.

### Configuration

The configuration modal consists of the following fields:

- Slider input to set the number of available states, from 2-12
- Preset dropdown menu
- Text area for entering custom rules
- Bulk rule assignment dropdown with "select all" button
- Individual dropdowns for each of the twelve possible states supported by the demo
- A dropdown to set the default cell neighborhood

### Customization

In the configuration modal, rule assignment select menus are populated with the contents of the `rules` object loaded from `demo/rules.js`. Custom rules may be added to this object via the console, via:

        board.AddRule(name, function)

This can also be affected via the modal by adding rules directly in the given text area. This should be a JavaScript object of one or more key-value pairs, where the value is a function that takes a `Cell` instance and returns a state value.

We can also add our own rule presets via the console:

        board.addPreset(name, array)

And add filters such as e.g. `edgeFilter`, which has the effect of disabling wraparound topology:

        hexular.addFilter(Hexular.filters.edgeFilter)

And remove filter, such as the `modFilter` which is enabled by default:

        hexular.removeFilter(Hexular.filters.modFilter)

## Links

- This program was originally inspired as a generalization of David Siaw's similarly browser-based Hexlife program: https://github.com/davidsiaw/hexlife

- Also, Charlotte Dann's Hexagonal Generative Art, which incorporates CA-type rules along with more elaborate logic: http://codepen.io/pouretrebelle/post/hexagons

- Despite my general expertise in this area, I continue to find Amit Patel's "Hexagonal Grids" page to be an invaluable resource when dealing with hex grids: http://www.redblobgames.com/grids/hexagons/

- For more information on HEXAGONAL AWARENESS, please visit:
    - https://hexnet.org/
    - https://twitter.com/hexagonalnews
    - https://facebook.com/hexagons
    - https://reddit.com/r/hexagons
