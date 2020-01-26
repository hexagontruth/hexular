Hexular
=======

An extensible hexagonal CA platform.

(C) 2020 Graham Steele. Distributed under the [Hexagonal Awareness License](../LICENSE.txt).

- [Demo](https://hexagrahamaton.github.io/hexular)
- [Documentation](https://hexagrahamaton.github.io/hexular/doc/)
- [Github](https://github.com/hexagrahamaton/hexular/)

## Overview

Hexular is an extensible hexagonal cellular automaton (CA) platform for JavaScript environments, presently built around several core concepts:

 - A **model** representing a grid of cells organized according to some topology. Hexular includes two built-in model classes:
    - [CubicModel](CubicModel.html) (default)
    - [OffsetModel](OffsetModel.html)
 - **Cells** representing individual elements in a model topology. Each is associated with a particular state. Many included helper functions assume this state will be a natural number, but it can be anything.
 - **Adapters** as extensions for e.g. rendering a model's state. Namely, in the present implementation, [CanvasAdapter](CanvasAdapter.html), which displays a model on a user agent canvas context.

 The `Hexular` function (defined globally in the DOM or exported by the standalone module) returns a new model instance when called directly, and also contains the following collection objects, providing ergonomic access to all functionality necessary for the
 end user to implement her own extensions via the Hexular API:

 - [`Hexular`](global.html#Hexular)
    - `classes`
      - `models`
        - [`CubicModel`](CubicModel.html)
        - [`OffsetModel`](OffsetModel.html)
      - `adapters`
        - [`CanvasAdapter`](CanvasAdapter.html)
    - [`filters`](Hexular.filters.html)
    - [`math`](Hexular.math.html)
    - [`rules`](Hexular.rules.html)
    - [`util`](Hexular.util.html)

Some useful `Model` methods:

- [`step()`](Model.html#step) &mdash; Perform single state increment step
- [`clear()`](Model.html#clear) &mdash; Clear all cell states

States are not drawn or redrawn on screen with adapters. Useful `CanvasAdapter` methods include:

- [`draw()`](CanvasAdapter.html#draw) &mdash; Draws all cells
- [`drawCell(cell)`](CanvasAdapter.html#drawCell) &mdash; Draws an individual cell
- [`selectCell(cell)`](CanvasAdapter.html#selectCell) &mdash; Highlights individual cell
- [`cellAt(x, y)`](CanvasAdapter.html#cellAt) &mdash; Returns cell at given coordinates on the canvas

## Customization

### General configuration

The Hexular constructor accepts an optional first argument giving a model class (e.g. `Hexular.classes.models.OffsetTopology`), and any number of settings arguments. Different settings are required by different model classes.

`CubicModel` is morphologically determined by its `radius`, which gives the number of rings of cells from the center to the edge. So, e.g., a seven-cell grid would have radius 2. Conversely, `OffsetModel` takes `rows` and `cols` arguments.

For additional model configuration options, please see the [`Model`](Model.html) documentation.

### Rules

Cell rules are given on a per-state basis, and applied individually to each cell. The rules are stored in the [`model.rules`](Model.html#rules) array, and can be reassigned at any time.

A valid rule is a function that take a cell as an argument, and return a value corresponding to the next desired state. Hexular is generally opinionated towards natural number states, but they can in principle be any values that can be coerced into a JavaScript object key. The rule function has access to the cell's current state, its neighbors' states (through [`cell.nbrs`](Cell.html#nbrs) and the neighborhood-bound helper functions), and by extension the state of every cell in the grid &mdash; though philosophically speaking CAs should only consider cell states within some finite local neighborhood.

One could, if one were so inclined, create rules utilizing larger local neighborhoods, additional internal state data, etc.

#### Rule helpers

Cell instances have several helper methods to perform common rule calculations:

- [`total`](Cell.html#total) &mdash; Returns sum of all neighboring states
- [`count`](Cell.html#count) &mdash; Returns count of activated (nonzero) neighbors
- [`histogram`](Cell.html#histogram) &mdash; Returns a [`numStates`](Model.html#numStates)-sized array with counts of individual states across all neighbors

A cell's [`neighborhood`](Cell.html#neighborhood) property determines which cells to iterate over when a rule calls these methods. The default is a cell's immediate six neighbors, however this can be set to several more expansive options, including optionally a cell's own state. Rules can call these helper methods on neighborhoods specifically via the [`cell.with`](Cell.html#with) array, e.g.:

        cell.with[19].count

All cell neighborhoods can be set via [`model.setNeighborhood(n)`](Model.html#setNeighborhood), where `n` is one of `[6, 12, 18, 7, 13, 19]`.

### Customization

Beyond adding or changing rules and neighborhoods, model behavior can be extended and modified in a number of ways.


#### Filters

Filters allow us to, e.g., perform a modulo operation on new cell states, to keep them confined to a certain range. This was historically the default behavior, but has now been spun out into a separate functionality that must be added explicitly to a new model:

        model.addFilter(Hexular.filters.modFilter)

Filters simply take a state value and an optional [`cell`](Cell.html) instance, and return a filtered state value.

#### Drawing hooks

We can also override or extend the default cell-drawing behavior of `CanvasAdapter` in arbitrary aesthetic ways, to create more complex renderings. For example, the following will add a tasteful red triangle between any three activated cells:

        adapter.onDrawCell.push(function(cell) {
          if (!cell.state)
            return;
          let slice = cell.with[6].nbrSlice;
          this.renderer.fillStyle = '#ff3300';
          for (let i = 0; i < 5; i++) {
            let n1 = slice[i];
            let n2 = slice[(i + 1) % 6];
            if (n1.state && n2.state && !n1.edge && !n2.edge) {
              this.renderer.beginPath();
              this.renderer.moveTo(...this.cellMap.get(cell));
              this.renderer.lineTo(...this.cellMap.get(n1));
              this.renderer.lineTo(...this.cellMap.get(n2));
              this.renderer.closePath();
              this.renderer.fill();
            }
          }
        });

## Demo

The main control buttons are, from left to right:

- Start (Tab) &mdash; Step model at 100ms intervals (though this may be slower for larger grids, depending on hardware)
- Step (Space) &mdash; Perform individual step
- Clear (Ctrl+C)
- Undo (Ctrl+Z)
- Redo (Ctrl+Shift+Z)
- Config &mdash; Open configuration modal
- Save (Ctrl+S)
- Load (Ctrl+O)
- Resize board
- Show documentation

Additionally, `<Escape>` toggles button and coordinate indicator visibility, or conversely closes the configuration modal if it is open.

Cell states are changed by clicking and &mdash; on desktop browsers at least &mdash; dragging. The new state is determined by the state of the initially-clicked cell, and is the successor to the current state modulo `hexular.numStates`. Right clicking, conversely, decrements the cell state by one. Shift clicking clears states.

### Prepopulated rules

Several predefined rules are given in `demo/rules.js` though these are largely for convenience and not meant to be exhaustive. There are also several built-in "presets," or lists of 2-12 rules.

### Demo configuration and customization

The configuration modal consists of the following fields:

- Slider input to set the number of available states, from 2-12
- Preset dropdown menu
- Text area for entering custom rules
- Bulk rule assignment dropdown with "select all" button
- Individual dropdowns for each of the twelve possible states supported by the demo
- A dropdown to set the default cell neighborhood

In the configuration modal, rule assignment select menus are populated with the contents of the `rules` object loaded from `demo/rules.js`, merged with those already available in Hexular core. Custom rules may be added to this object via the console:

        board.addRule(name, function)

This can also be effected via the modal by adding rules directly in the given text area. The entered code should be a JavaScript object of one or more key-value pairs, where the value is a function that takes a `Cell` instance and returns a state value. This will overwrite existing rules under a given name, though if in use the new rules will have to be re-selected from the dropdowns.

We can also add our own rule presets via the console:

        board.addPreset(name, array)

Additional customization on the `hexular` model instance can be performed as described above and in the documentation.

## Links

- This program was originally inspired as a generalization of David Siaw's similarly browser-based [Hexlife](https://github.com/davidsiaw/hexlife) program.

- Also, Charlotte Dann's [Hexagonal Generative Art](http://codepen.io/pouretrebelle/post/hexagons), which incorporates CA-type rules along with more elaborate emergent structure.

- Despite my general expertise in this area, I continue to find Amit Patel's [Hexagonal Grids](http://www.redblobgames.com/grids/hexagons/) page to be an invaluable resource when dealing with hex grids.

- For more information on HEXAGONAL AWARENESS, please visit:
    - [https://hexnet.org/](https://hexnet.org/)
    - [https://twitter.com/hexagonalnews](https://twitter.com/hexagonalnews)
    - [https://facebook.com/hexagons](https://facebook.com/hexagons)
    - [https://reddit.com/r/hexagons](https://reddit.com/r/hexagons)
