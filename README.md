Hexular
=======

An extensible hexagonal CA platform.

(C) 2020 Graham Steele. Distributed under the [Hexagonal Awareness License](../LICENSE.txt).

  - [Hexular Studio (Demo)](https://hexagrahamaton.github.io/hexular)
  - [Documentation](https://hexagrahamaton.github.io/hexular/doc/)
  - [GitHub](https://github.com/hexagrahamaton/hexular/)

## Contents

  - [Overview](#overview)
  - [Configuration](#configuration)
    - [Rules](#rules)
    - [Customization](#customization)
  - [Hexular Studio](#hexular-studio)
    - [Interface](#interface)
    - [Prepopulated rules](#prepopulated-rules)
    - [Demo configuration and customization](#demo-configuration-and-customization)
  - [More information](#more-information)

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

## Configuration

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

#### Rule builder

The [`ruleBuilder`](Hexular.util.html#.ruleBuilder) function allows for "convenient" generation of elementary binary CA rules, analogous to Wolfram's [Elementary Cellular Automaton](http://mathworld.wolfram.com/ElementaryCellularAutomaton.html) rules. The function takes as an input either a single natural number (preferrably in the form of a [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)), or an array of numbers each representing a single neighborhood state mask to add.

An optional second argument determines the range of neighbors to consider when applying the rule, with the default being `[1, 7]` (corresponding to the immediate neighborhood N6). This can be changed to e.g. `[0, 7]` to include the home cell itself. The individual state masks in the first argument array are thus 6 bits in the default case (0-63), or 7 bits in the latter case (0-127). The "rule number" produced will be up to 64 bits, or 18,446,744,073,709,551,616 possible combinations, for the 6-neighbor default, or up to 128 bits, or 340,282,366,920,938,463,463,374,607,431,768,211,456 possible combinations, for the 7-neighbor variant. If one were to consider the full `[0, 19]` neighborhood, one would have a 157,827-decimal-digit-long number of possible rules, which I will not repeat here.

This representation is obviously a bit less well-suited to the brute indexing approach than Wolfram's 256 one-dimensional rules, but it is hoped that at least the array version will be helpful in constructing simple rules, which may then be composed into more complex rules, &c.

 So e.g.. we might use this function as follows to create a rule to activate if and only if two opposite pairs of neighbors are exclusively active:

        let fancyElementaryRule = Hexular.util.ruleBuilder([
          0b001001,
          0b010010,
          0b100100
        ]);

Please see the function documentation for additional details.

### Customization

Beyond modifying rules and neighborhoods, model behavior can be extended and modified in a number of ways.

#### Filters

Filters allow us to, e.g., perform a modulo operation on new cell states, to keep them confined to a certain range. This was historically the default behavior, but has now been spun out into a separate functionality that must be added explicitly to a new model:

        model.addFilter(Hexular.filters.modFilter)

Filters simply take a state value and an optional [`cell`](Cell.html) instance, and return a filtered state value.

#### Drawing hooks

We can also override or extend the default cell-drawing behavior of `CanvasAdapter` in arbitrary aesthetic ways, to create more complex renderings. For example opening the console in the Hexular Studio interface and running the following will add a tasteful red triangle between any three activated cells:

        Board.instance.bgAdapter.onDrawCell.push(function(cell) {
          if (!cell.state)
            return;
          let slice = cell.with[6].nbrSlice;
          this.context.fillStyle = '#ff3300';
          for (let i = 0; i < 5; i++) {
            let n1 = slice[i];
            let n2 = slice[(i + 1) % 6];
            if (n1.state && n2.state && !n1.edge && !n2.edge) {
              this.context.beginPath();
              this.context.moveTo(...this.model.cellMap.get(cell));
              this.context.lineTo(...this.model.cellMap.get(n1));
              this.context.lineTo(...this.model.cellMap.get(n2));
              this.context.closePath();
              this.context.fill();
            }
          }
        });

## Hexular Studio

The built-in demo site, Hexular Studio, can be run as-is with any static HTTP server, or built and run using NPM and Node:

  - Run `npm install` from the project directory
  - Then run `npm start`

The principal Studio interface consists of a `CubicModel` instance, centered on the page, with buttons and keyboard shortcuts implementing various functions. A number of settings can be set via URL parameters. Some debatably-important ones that presently aren't also configurable through the interface include:

  - `theme=light`
  - `borderWidth=1`
  - `showModelBackground=true`
  - `interval=100`
  - `groundState=0`
  - `undoStackSize=64`

URL parameters are overriden by themes and presets according to a somewhat complicated formula, and it's probably advisable to use the in-page configuration tools when possible. Generally things like tool settings and particular rule settings will persist for a current page session, while things like imported presets will persist across multiple sessions. Both can be cleared by clicking the "Clear locally-stored settings" button.

### Interface

Control flow and configuration buttons run along the along the top of the window:

  - Start/Pause (Tab) &mdash; Step model at 100ms intervals (this may be slower for larger grids, depending on hardware, and can be set via the `interval` URL parameter)
  - Step (Space) &mdash; Perform individual step
  - Clear (Ctrl+C)
  - Undo (Ctrl+Z)
  - Redo (Ctrl+Shift+Z)
  - Record/Stop (Shift+Tab) &mdash; Start timer and record canvas to webm video
  - Configure (Ctrl+K)
  - Resize board (Ctrl+R)
  - Add custom code (Ctrl+F)
  - Clear locally-stored settings
  - Show documentation (F1)

Several buttons concerning file I/O run along the left side:

  - Save snapshot (Q)
  - Load snapshot (A)
  - Save image (Ctrl+Shift+S)
  - Save (Ctrl+S)
  - Load (Ctrl+O)
  - Import custom JavaScript (Ctrl+I)

Tool buttons and various editorial options run along the bottom:

  - Move tool (M)
  - Fill tool (G)
  - Brush tool (B)
  - Line tool (L)
  - Locked line tool (/)
  - Filled hex tool (F)
  - Outline hex tool (H)
  - Set tool size to 1 (1)
  - Set tool size to 2 (2)
  - Set tool size to 3 (3)
  - Re-scale and re-center model (R)
  - Toggle color mode toggle (C) &mdash; Override the default color assignment on paint actions with specific color

Holding shift will temporarily select the move tool by default, or whatever tool is given in the `shiftTool` parameter.

Additionally, `<Escape>` toggles button and coordinate indicator visibility, or conversely closes the configuration modal if it is open. Scrolling a central mouse wheel or equivalent will zoom the canvas.

Cell states are changed by clicking and dragging with a paint tool selected. By default, the painting state is determined by the state of the initially-clicked cell, and is the successor to the current state modulo `Board.instance.model.numStates`. Right clicking, conversely, decrements the cell state by one, and ctrl+clicking clears to the ground state. Setting a specific state color can be effected by toggling the color mode button on the bottom right. Toggling color mode off brings back the default behavior.

The basic flow of the program is to set one's preferred state using either the mouse or by importing a saved file, setting desired rules, &c. in the configuration modal, and then either starting the timer (tab) or incrementing the state one step at a time (space).

### Prepopulated rules

Several predefined rules are given in `client/library/rules.js`. These are largely provided for convenience and aren't meant to be exhaustive. A number of built-in presets, or groups of rules, are defined `client/library/presets.js` and can be selected from the configuration modal in lieu of individual rules.

### Studio configuration and customization

The main configuration modal consists of the following fields:

  - Slider input to set the number of available states, from 2-12
  - Preset dropdown menu
  - Bulk rule assignment dropdown with "select all" button
  - Individual dropdowns for each of the twelve possible states supported by the demo
  - Default rule dropdown menu &mdash; This should only really matter when running rules without `modFilter` (which may cause other undesirable effects such as corrupted model exports, &c., and should generally be thought of as voiding the warranty)
  - Cell neighborhood dropdown &mdash; Not all rules use the default neighborhood, but most built-in rules involving totals, counts, &c. will do so
  - A series of buttons to activate and deactivate particular built-in filters

In the configuration modal, rule assignment select menus are populated with the contents of the `rules` object loaded from `demo/rules.js`, merged with those already available in Hexular core. Custom rules may be added to this object via the console, e.g.:

        Board.config.addRule(name, (cell) => cell.state == 3 ? 1 : 0)

We can also add our own rule presets via the console, e.g.:

        Board.config.addPreset('fancyPreset', new Preset(['offset23', 'offset34', 'stepUp']))

Such modifications can also be effected via the custom code modal (Ctrl+F) or JavaScript import button (Ctrl+I), using the same global objects, &c. Specifically, every board instance attaches the following to the global `Board` object:

- `Board.instance` - The board itself
- `Board.config` - Alias for `Board.instance.config`
- `Board.model` - Alias for `Board.instance.model`

Customization of the global `Board.model` model can be performed as described above and in the documentation.

## More information

  - This program was originally inspired as a generalization of David Siaw's similarly browser-based [Hexlife](https://github.com/davidsiaw/hexlife) program.

  - Also, Charlotte Dann's [Hexagonal Generative Art](http://codepen.io/pouretrebelle/post/hexagons), which incorporates CA-type rules along with more elaborate structural elements.

  - Despite my general expertise in this area, I continue to find Amit Patel's [Hexagonal Grids](http://www.redblobgames.com/grids/hexagons/) page to be an invaluable resource when dealing with hex grids, and much of the terminology I've used around cubic coordinates is taken from his distillation of the topic.

  - Many of the icons used in the Hexular Studio interface are taken from the [Material Design Icons](https://materialdesignicons.com/) project, and distributed under the Open Font License. The font itself was compiled using [Fontello](http://fontello.com/).

  - For more information on HEXAGONAL AWARENESS, please check out:
    - [https://twitter.com/hexagonalnews](https://twitter.com/hexagonalnews)
    - [https://facebook.com/hexagons](https://facebook.com/hexagons)
    - [https://reddit.com/r/hexagons](https://reddit.com/r/hexagons)
    - [https://hexnet.org/](https://hexnet.org/)