Hexular
=======

An extensible hexagonal CA platform.

(C) 2020 Graham Steele. Distributed under the Hexagonal Awareness License.

  - [Hexular Studio (Demo)](https://hexagrahamaton.github.io/hexular)
  - [Documentation](https://hexagrahamaton.github.io/hexular/doc/)
  - [GitHub](https://github.com/hexagrahamaton/hexular/)

For more information on the hexagonal consciousness movement, visit [Hexagon.link](https://hexagon.link/).

To view some examples of media created with Hexular, see our [YouTube channel](https://www.youtube.com/channel/UCf-ml0bmw7OJZHZCIB0cx3g).

## Contents

  - [Overview](#overview)
  - [Hexular Core](#hexular-core)
    - [Basic configuration](#basic-configuration)
    - [Cells](#cells)
    - [Rules](#rules)
    - [Filters](#filters)
  - [Hexular Studio](#hexular-studio)
    - [Interface](#interface)
    - [Model configuration](#model-configuration)
    - [Theming and drawing](#theming-and-drawing)
    - [Plugins](#plugins)
    - [Simple Rulebuilder](#simple-rulebuilder-2)
    - [Template Rulebuilder](#template-rulebuilder-2)
    - [Additional options](#additional-options)
  - [More information](#more-information)

## Overview

Hexular is an extensible hexagonal cellular automaton (CA) platform for JavaScript environments. The present project is composed of two principal components:

- Hexular Core (hexular.js) &mdash; A core automaton management engine coupled with an extensible topological interface
- Hexular Studio &mdash; A browser-based platform for designing, composing, recording, and exporting hexagonal CAs

The latter evolved out of a fairly lightweight "demo" page for what was intended to be, at its core, an interface-agnostic CA engine. At this point the two components should probably be either integrated more fully or spun off into truly separate projects, but having effectively reached the limits of what I can do in contemporary browsers vis-a-vis this sort of compute-bound work, I'm not sure it's worth sinking too much additional effort into. The next iteration of this project will probably be a desktop app written in e.g. Python. There may or may not be a web client front-end for that, but I'm eager to move the actual automaton computation to a backend system of some sort that more fully leverages e.g. threading, modern GPU capabilities, etc.

## Hexular Core

Hexular Core can be used in any e.g. Node.js project via `npm install -s hexular`, or by simply copying the file `hexular/hexular.js` from the project directory. I'm under no illusions that this will actually be useful to anyone &mdash; nobody in their right mind would choose to implement a hexagonal CA in JavaScript unless they had to.

The structure of Hexular has undergone several changes since its somewhat halfassed inception in 2017, but in broad terms it is a file that returns a single `Hexular` function &mdash; either via `module.exports` when available or via assignment to a global constant of the same name. This function can be called to instantiate new automata, and serves as a self-contained namespace for a variety of subsidiary classes and utility functions. The simplest usage in Node.js, using all default settings, would be as follows:

        require('hexular');
        let model = Hexular();

A model is an instance of a subclass of the base [`Hexular.Model`](Model.html) class, where each subclass defines a particular topology of hexagonal cells. Currently two built-in models are defined, [`Hexular.CubicModel`](CubicModel.html) and [`Hexular.OffsetModel`](OffsetModel.html), with the former being the default.

Models have constituent [`Hexular.Cell`](Cell.html) instances, which can be accessed via [`model.getCells()`](Model.html#getCells) in their user-sorted state, via [`model.cells`](Model.html#cells) in their original order, and iterated over via [`model.eachCell(callback)`](Model.html#eachCell).

Some additional classes, objects, and namespaces within the `Hexular` object:

  - [`Hexular.math`](Hexular.math.html)
  - [`Hexular.rules`](Hexular.rules.html)
  - [`Hexular.util`](Hexular.util.html)

Some useful `Model` methods:

  - [`step()`](Model.html#step) &mdash; Perform single state increment step
  - [`clear()`](Model.html#clear) &mdash; Clear all cell states
  - [`export()`](Model.html#export) &mdash; Export model states to [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) in an order defined by the model subclass
  - [`import()`](Model.html#import) &mdash; Import model states from an array in a similar fashion

### Basic configuration

The Hexular function accepts an optional first argument giving a model class (e.g. `Hexular.OffsetModel`), and any number of settings arguments. Different settings are required by different model classes.

      let model = Hexular(MyCustomModel, myOpts, moarOpts, iCantBelieveItsEvenMoreOpts);

`CubicModel` is morphologically determined by its `order`, which gives the number of rings of cells from the center to the edge. So, e.g., a seven-cell grid would have order 1, and a one-cell grid would have order 0. Conversely, `OffsetModel` takes `rows` and `cols` arguments.

      let offsetModel = Hexular(Hexular.OffsetModel, {rows: 64, cols: 32}); // 2,048 cells
      let cubicModel = Hexular({order: 26});  // 2,107 cells

For global model configuration options, please see the [`Model`](Model.html) documentation.

### Cells

Cells consist of a cell state accessible via [`cell.state`](Cell.html#state), along with coordinate information _specific to the model topology_ at [`cell.coord`](Cell.html#coord). Note that the format of these coordinates differs between e.g. `CubicModel` and `OffsetModel`, with the former giving an array of three coordinates &mdash; customarily defined as `u`, `v`, and `w`, where the sum of all three always equals zero, and the latter a more customary Cartesian pair.

Cells also have an array of neighboring cells at [`cell.nbrs`](Cell.html#nbrs). This is, in full, a 19-element array of cell references, structured as follows:

  - 0: The cell itself
  - 1-6: The cell's six immediate neighbors
  - 7-12: The six cells one edge-length from the home cell's vertices (i.e. the next six closest cells)
  - 13-18: The six cells one full cell from the home cell (i.e. opposite the original six neighbors)

The `nbrs` array is ordered in this way to allow continuous subarray iteration between 6, 7, 12, 13, 18, and 19 cell neighborhoods, according to the requirements of different automaton configurations. (Sometimes we wish to consider a cell's own state in performing bulk calculations of e.g. neighbor state totals, and sometimes we do not, which is why there are two variants for each "ring.")

The exact spatial orientation of the neighborhood is implementation-specific, but in the default configuration used by Hexular Studio a cell's first inner neighbor at `cell.nbrs[1]` is located on the bottom right, with the next five progressing counterclockwise.

#### Cell helpers

Cell instances have several helper methods to perform common rule calculations:

  - [`total`](Cell.html#total) &mdash; Returns sum of all neighboring states
  - [`count`](Cell.html#count) &mdash; Returns count of activated (nonzero) neighbors
  - [`histogram`](Cell.html#histogram) &mdash; Returns a [`numStates`](Model.html#numStates)-sized array with counts of individual states across all neighbors

These methods are defined with ES6 getter syntax, and are thus called without parentheses.

A cell's [`neighborhood`](Cell.html#neighborhood) property determines which cells to iterate over when a rule calls these methods. The default is a cell's immediate six neighbors, however this can be set globally in a model to any of the other five neighborhoods defined above via [`model.setNeighborhood(n)`](Model.html#setNeighborhood), e.g.:

        model.setNeighborhood(19);

Note that the cell neighborhood property is to some extent a "guideline" &mdash; any rule function has access to the full `nbrs` array and can consider whichever subset it wishes to avail itself of. The neighborhood property is exposed to provide an ergonomic means for neighborhood-agnostic functions to be defined orthogonally to neighborhood configuration.

Any of the above-described helper functions can be accessed for a specific neighborhood via [`cell.with`](Cell.html#with), e.g.:

        cell.with[19].count

(The cell-level versions of these functions are simply aliased to the ones in the `cell.with` array.)

### Rules

Cell states are, at this point and by custom, principally expected to be non-negative integer values, and all the built-in rules in Hexular and Hexular Studio reflect this assumption.

Cell rules &mdash; functions that take in the cell as an argument and return a new state value &mdash; are defined for each current state value, and applied individually to each cell on every call to `model.step()`. The rules are stored in the [`model.rules`](Model.html#rules) array, and can be reassigned at any time (there is no special getter or setter for them). So for instance a cell with a current state of `5` will be passed to the function at `model.rules[5]`, and after all cells have likewise been processed its state value will change to whatever was returned from this function.

        let model = Hexular();
        model.cells[0].state = 5;
        model.rules[5] = (cell) => cell.state + 1;
        model.step();
        console.log(model.cells[0].state) // 6

A valid rule is a function that takes a cell as an argument and returns a value corresponding to the next desired state. Hexular is, again, generally opinionated towards natural number states, but they can in principle be any value that can be coerced into a JavaScript object key. The rule function has access to the cell's current state, its neighbors' states (through [`cell.nbrs`](Cell.html#nbrs) and the neighborhood-bound helper functions), and by extension the state of every cell in the grid &mdash; though in principle CAs should only consider cell states within some finite local neighborhood. Larger neighborhoods can be extracted as necessary via the [`cell.wrap`](Cell.html#wrap) function, which returns an arbitrarily-large spiral-wrapped array of neighbors around a given cell.

One could, if one were so inclined, create rules utilizing additional internal state data, etc., though this may cause undesirable effects, particularly in Hexular Studio.

#### Simple Rulebuilder

The [`Hexular.util.ruleBuilder`](Hexular.util.html#.ruleBuilder) function allows for "convenient" generation of simple binary CA rules, analogous to Wolfram's [Elementary Cellular Automaton](http://mathworld.wolfram.com/ElementaryCellularAutomaton.html) rules. The function takes as an input either a single natural number (preferably in the form of a [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)), or an array of numbers each representing a single neighborhood state mask to add. It also accepts an optional `options` argument, overriding the following default values:

        {
          range: [1, 7],
          miss: 0,
          match: 1,
          missRel: 0,
          matchRel: 0,
          rel: 0,
        }

The `range` attribute determines which neighbors to consider when applying the rule, with the default being `[1, 7]` (corresponding to the immediate neighborhood N6). This can be changed to e.g. `[0, 7]` to include the home cell itself, or `[1, 19]` to consider the 18 nearest neighbors excluding the home cell. The individual state masks in the first argument array are thus 6 bits in the default case (0-63), or 7 bits in the latter case (0-127). The "rule number" produced will be up to 64 bits, or 18,446,744,073,709,551,616 possible combinations, for the 6-neighbor default, or up to 128 bits, or 340,282,366,920,938,463,463,374,607,431,768,211,456 possible combinations, for the 7-neighbor variant. If one were to consider the full `[0, 19]` neighborhood, one would have a 157,827-decimal-digit-long number of possible rules, which I will not repeat here. (This problem is approached differently by the template rulebuilder discussed below.)

 So e.g.. we might use this function as follows to create a rule to activate if and only if two opposite pairs of neighbors are exclusively active:

        let fancyElementaryRule = Hexular.util.ruleBuilder([
          0b001001,
          0b010010,
          0b100100
        ]);

If we wanted to have the same rule subtract 1 from the current cell state on rule match, and keep the current state otherwise, we would modify it like this:

        let fancyElementaryRule = Hexular.util.ruleBuilder([
          0b001001,
          0b010010,
          0b100100
        ], {miss: 0,  match: -1, missRel: true, matchRel: true});

Note this would be a somewhat useless rule under most circumstances.

Please see the relevant [documentation](Hexular.util.html#.ruleBuilder) for additional details on this function.

#### Template Rulebuilder

A more advanced rulebuilding function, suitable for larger neighborhoods, is provided by the [`Hexular.util.templateRuleBuilder`](Hexular.util.html#.templateRuleBuilder) function. It takes only one argument, an array of templates, each defining a set of neighbor state conditions and a resulting modification to the cell state ("templates" is perhaps not the best descriptor for these objects, but was chosen to avoid confusion with the "rules" themselves).

By default each template consists of the following values:

        {
          applyFn: (a, b) => 1,
          matchFn: (c, a, b) => c,
          match: 1,
          miss: -1,
          matchRel: 1,
          missRel: 1,
          sym: 0,
          states: Array(19).fill(-1),
        }

The salient difference from the simple rulebuilder described above is that the `states` attribute here consists of a 19-element array of ternary values &mdash; `-1`, `0`, or `1` &mdash; where `-1` means we don't care about the value of the neighbor at this position, `0` means it must be inactive, and `1` means it must be active. Activation is determined by the `matchFn` function, which takes three arguments, corresponding to the neighbor's state, the home cell's original state, and the state as modified by previous templates in this rule (but not yet applied). The default is to simply evaluate the boolean value of the neighbor's state itself &mdash; i.e., all nonzero states are active. We can change this to e.g. `(c, a, b) => c && c >= a` if we want to only match states that are equal to or greater than the home cell's current value, similar to the `rel` attribute in `ruleBuilder`.

The `applyFn` function likewise defines whether to invoke the template at all based on original and current home cell states. We can use this to make sure only one template of several is applied (i.e., to prevent a rule state from being, say, incremented multiple times in a single step) by changing this, under most circumstances, to `(a, b) => a == b` (though this will not always work depending on how other templates adjust the state).

It is possible to make needlessly complex rules with this rulebuilder, though not necessarily quickly or ergonomically. It is however also useful for defining rules that require a consideration of some portion of the full 19-cell neighborhood state, or that require the prioritized application of certain neighborhood patterns over others.

There are GUI implementations of both rulebuilders in the Hexular Studio interface, and it's probably easiest to get a feel for how they work there.

### Filters

Filters allow us to, e.g., perform a modulo operation on new cell states, to keep them confined to a certain range. This was historically the default behavior, but has now been spun out into a separate functionality that must be added explicitly to a new model via the [`model.filters.add(fn)`](HookList.html#add) method:

        model.filters.add(Hexular.filters.modFilter)

Filters can be any function that takes a state value and an optional [`cell`](Cell.html) instance, and return a new state value:

        model.filters.add((state) => state >> 1); // Divides all new states by 2

Filters can be removed with [`model.filters.delete(fn)`](HookList.html#delete). For more detail consult the [HookList](HookList.html) documentation.

The following additional filters are currently available in the core library:

  - [`modFilter`](Hexular.filters.html#.modFilter) &mdash; Discussed above
  - [`binaryFilter`](Hexular.filters.html#.binaryFilter) &mdash; Reduce all nonzero states to 1
  - [`deltaFilter`](Hexular.filters.html#.deltaFilter) &mdash; Add new state to existing state (this can be in addition to the same operation being expressed by rules themselves, and may result in unexpected behavior)
  - [`clipBottomFilter`](Hexular.filters.html#.clipBottomFilter) &mdash; Constrain values to >= 0
  - [`clipTopFilter`](Hexular.filters.html#.clipTopFilter) &mdash; Constrain values to < `model.numStates`
  - [`edgeFilter`](Hexular.filters.html#.edgeFilter) &mdash; Always set cells on edge of model to 0 (this has the effect, under conventional neighborhoods, of preventing wraparound behavior)

## Hexular Studio

Hexular Studio can be accessed at the GitHub Pages site linked above, or run locally via the prescribed Node.js dependencies or any other static web server. To compile and run on port 8000 (there is a minimal build system consisting of mostly the concatenation of JavaScript files):

  - Run `npm install` from the project directory
  - Run `npm start`

A custom port can be specified by setting the `port` environment variable, e.g.:

        port=8080 npm start

Yoiu can also just serve the contents of the "public" directory directory with your static server of choice. The files here can be recompiled at any time by running `npm run build`, and removed with `npm run clean`.

The principal Studio interface consists of a `CubicModel` instance centered on the page, with buttons and keyboard shortcuts implementing various functions. A number of settings can be set via URL parameters, but are presently overridden by themes and presets according to a somewhat complicated arrangement, and it's probably advisable to use the in-page configuration tools when possible. Generally things like tool settings and particular rule settings will persist for a current page session, while presets, rules, and themes themselves will persist across multiple sessions. Both can be cleared by clicking the "Clear locally-stored settings" button under the three-dotted config menu, or imported/exported to and from a JSON file via buttons on the lower left side of the screen.

### Interface

Control flow, state, and configuration buttons run along the along the top of the window:

  - Record/Stop (Shift+Tab) &mdash; Start timer and record canvas to webm video
  - Start/Pause (Tab) &mdash; Step model at, by default, 125ms intervals (this may be slower for larger grids or when certain custom drawing functions are used, depending on hardware, and can be set via the draw configuration modal)
  - Step (Space) &mdash; Perform individual step
  - Clear (Ctrl+C)
  - Configuration menu toggle
    - Model configuration modal (Ctrl+G)
    - Theme modal (Ctrl+E)
    - Draw configuration modal (Ctrl+D)
    - Plugin modal (Ctrl+Y)
    - Resize modal (Ctrl+R)
    - Simple Rulebuilder modal (Ctrl+B)
    - Template Rulebuilder modal (Ctrl+H)
    - Custom Code modal (Ctrl+F)
  - Undo (Ctrl+Z)
  - Redo (Ctrl+Shift+Z)
  - Save snapshot (Q)
  - Load snapshot (A)
  - Show documentation (F1)

Several buttons concerning file I/O run along the left side:

  - Save image (Ctrl+Shift+S)
  - Toggle image capture mode (Ctrl+I)
  - Load model (Ctrl+O)
  - Save model (Ctrl+S)
  - Load local settings (Ctrl+Alt+O)
  - Save local settings (Ctrl+Alt+S)
  - Toggle lock mode (Ctrl+L)
  - Clear local settings (Ctrl+X)

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
  - Toggle color mode (C) &mdash; Override the default color assignment on paint actions with specific state colors

Holding `<Shift>` will temporarily select the move tool by default, or whatever tool is given in the `Board.config.shiftTool` parameter. Holding `<Alt>` temporarily displays the default (pointy) hex for each cell state &mdash; useful when using plugins or drawing settings that may temporarily occult the drawn model state. `<Escape>` toggles button and coordinate indicator visibility, or conversely closes any open modal. Scrolling a central mouse wheel or pinch zooming will scale the canvas. Ctrl+L will lock the board to prevent cursor-initiated painting, scrolling, or zooming &mdash; though "re-scale and re-center" command will still work (this can be useful to prevent accidental adjustment of the board during recording). Hitting Ctrl+L again will unlock it.

Cell states are changed by clicking and dragging with a paint tool selected. By default, the painting state is determined by the state of the initially-clicked cell, and is the successor to the current state modulo `Board.instance.model.numStates`. Right clicking, conversely, decrements the cell state by one, and ctrl+clicking clears to the ground state. Setting a specific state color can be effected by toggling the color mode button on the bottom right (C).

The basic flow of the program is to set one's preferred state using either the mouse or by importing a saved file, setting desired rules, &c. in the model configuration modal, and then either starting the timer (tab) or incrementing the state one step at a time (space).

Additional options can be set or configured via the various modals. (Note that the modals aren't, at this point, strictly modal, as I've found it convenient to allow an automaton to be e.g. stopped and started while a "modal" is open. But the name remains as a sort of vestigial taxonomic artifact.)

### Model configuration

The somewhat-confusingly named model configuration modal (Ctrl+G) was the original and in some senses still principal configuration modal exposed by Hexular Studio. It consists of the following fields:

  - Preset dropdown menu and import/export buttons
  - Slider input to set the number of available states, with a default range of 2-12
  - Bulk rule assignment dropdown and "select all" button
  - Individual dropdowns for each of the twelve possible states supported by the demo
  - Default rule dropdown menu
  - Cell neighborhood dropdown &mdash; Again, not all rules use the default neighborhood (those constructed using the rulebuilder functions do not for instance), but most built-in rules involving totals, counts, &c. will
  - A series of buttons to activate and deactivate particular built-in filters
  
The states slider allows one to set the value of `model.numStates` (up to a maximum number that can be altered by calling `Board.config.setMaxNumStates(n)`). Note that this value only has meaning in the context of `moduloFilter`, `clipTopFilter`, or any other function that chooses to respect it &mdash; it doesn't impose any hard-and-fast constraints on the model &mdash; though it does cause the default rule to be executed for a given cell with a state out of that range, instead of whatever rule may nominally be associated with that number (e.g., if the state 5 rule is "ruleA" and the default rule is "ruleB", and you have a cell you set to state 5 while lowering the number of states to 2, "ruleB" will be called on to decide that cell's fate).

We can also set the default neighborhood (discussed in more depth above), and enable or disable built-in filters. All options on this modal can be saved to local storage, exported, and imported as presets.

Predefined rules are given in `client/library/rules.js`. Presets are defined `client/library/presets.js`. Both are provided principally as examples, and neither is meant to be exhaustive.

Rules are saved to local storage and thus exportable as part of the overall configuration, but rules are serialized/deserialized on storage and will lose access to any e.g. closure properties. Thus it is best to not define rules that rely on anything beyond the cell passed into them. (An exception to this is any rule created by either of the two rulebuilder functions, but these are serialized and restored according to a specific pattern.)

### Theming and drawing

Basic colors, spacing, and blending options can be set in the theme modal (Ctrl+E). Themes work generally the same as presets in the model configuration modal, and can be saved, etc. They are exported as part of the overall configuration export (Ctrl+Alt+S or Ctrl+Meta+S).

The draw configuration modal (Ctrl+D) allows us to set additional parameters related to how cells are drawn on screen, including which if any simple shape to draw for each cell, as well as the default zoom, play step interval, and number of intermediate "drawing steps" to perform between each model step. This allows e.g. complex animations with fading colors, animated shapes, etc., to occupy our minds as we enjoy the procession of our automata. The "draw scale" setting principally affects exported video and images, and should typically be kept at `1` unless these features are being used, as larger numbers will slow down drawing significantly.

### Plugins

Animations and other auxiliary effects can be configured via the plugin modal (Ctrl+Y). Plugins are configurable via a JavaScript object that is edited and saved in a free-form text field. These settings are fully-evaluable objects, not JSON strings, and can thus contain functions, employ global `Math` functions, etc.

Most plugins describe various types of animations, &c., but the `MidiMap` plugin also allows us to play music on a hardware or software MIDI synthesizer, or to set cell states via a MIDI controller (albeit somewhat weirdly): we can select MIDI input and output devices, map individual channels on each device to functions defining how a note should be played or interpreted, and configure the range, stride, and location of the note mapping.

The plugin system evolved from one-off animation experiments I developed while composing videos using earlier versions of Hexular Studio. Many, to be frank, don't make a lot of sense at this point &mdash; there's a lot of overlapping-yet-slightly-different behavior between them. The source code for these plugins &mdash; located sensibly in the "/plugins" directory &mdash; is a good place to start if you're interested in writing your own or extending the built-in ones.

Of particular note here are the increasingly-misnamed "pivot" attributes available in most animation plugins. These fields can take one of the following three forms:

- A single real number n where `0 <= n <= 1`, e.g. `0.5`
- A pair of such numbers in an array, e.g. `[0.1, 0.9]`
- An easing function such as `(t) => 1 - (1 - 2 * t) * ( 1 - 2 * t)`

These values describe the intensity or extent of an animation over the period of one intra-state drawing interval. So e.g. the default of `0.5` in most cases simply causes an animation to progress from its base state to its maximal state at halfway through the intra-step interval, then return again to its base state at the end, forming a sort of isosceles triangle graph. A value of `1` would likewise cause it to progress at a constant rate from 0 to 1 over the course of the full animation, describing a linear `y = x` function. A value of [0.25, 0.75] would cause it to up to its maximal state at one quarter of the way through, plateau for half the time, then return back to the base state. And a function like e.g. `(t) => Math.sin(t * Math.PI)` will cause a somewhat smoother ascent and descent.

Plugins can, again, be added, via the console or code import, but are not themselves saved as part of the local configuration &mdash; though specific instances of plugins are, along with their configurations.

### Simple Rulebuilder

The Simple Rulebuilder or SRB (Ctrl+B) exposes a somewhat-simplified interface for calling the [`ruleBuilder`](Hexular.util.html#.ruleBuilder) function discussed above, limited to the `N6` neighborhood, and six possible miss and match states, with the default being to set cell state to 0 on misses, and 1 on matches.

Note that the miss and match rules can interact with [`deltaFilter`](Hexular.filters.html#.deltaFilter) in strange ways. For instance, a rule built using the default settings in this modal, coupled with `deltaFilter`, will have the same effect as one without the filter, but with the match rule set to "State + 1." Likewise, if we then add the filter back in, we will add the state twice on matches &mdash; which may or may not be desirable, but is sort of weird.

The rule is copied to a text field at the bottom of the modal, where it can be further edited before instantiation by e.g. adding custom `miss` and `match` values, or saved as part of a larger scripted customization. The JSON array generated in this field can be fed directly to the `ruleBuilder` function using ES6 spread syntax (`...`).

Simple rules constructed through the rulebuilder interface are only a small subset of possible rules using the core cell API, and they do not, by default, differentiate between nonzero cell states. Thus they are not suited for "noisy" rulesets where all or most cells are in a nonzero state (e.g., what one sees with the built-in preset "grayGoo"). There is however an optional attribute `rel`, exposed in the generated JSON field, which causes the rule to compare neighbor states relative to the current state, matching where a neighbor has an equal or greater nonzero value to the current state.

Note that, as with most persistent attributes in the studio interface, previous values will simply be overwritten &mdash; this allows one to iterate quickly when developing an experimental rule.

### Template Rulebuilder

The Template Rulebuilder or TRB (Ctrl+H) follows the same general design metaphor of the SRB, but exposes a more complex if less intuitive interface for composing and editing rules. The backend, likewise, works differently and less efficiently than the Simple Rulebuilder, and may not be appropriate for larger models.

In the TRB, we consider a "full" neighborhood of 19 cells, including the home cell, and define rules according to a ternary scheme, where each cell in a neighborhood is defined as either active, inactive, or either. Since the 1,162,261,467 possible neighborhood states cannot be as practically represented on-screen as the 64 states considered by the SRB, we adopt a different approach: We create rules by composing "templates," each of which corresponds to one 19-cell ternary neighborhood map, along with various template rules regarding miss and match values, and how to apply the map with respect to specific home and neighbor cell values.

The TRB modal includes a list of templates attached to the current rule, a 19-cell map for composing and editing these templates, a set of four radio buttons related to symmetry transformations for matching the template to a neighborhood, and &mdash; as with the SRB &mdash; a free-form text field for editing the raw template JSON.

The JSON field object includes miss and match values, as well as two lambda functions, `applyFn` and `matchFn`, which can be given as strings or functions, but which will be reformatted as strings due to storage format limitations:

- `applyFn(originalState, currentState)` returns a boolean based on the original and current state of the home cell that determines whether the template is applied or skipped. The default is to always return true.
- `matchFn(cellState, originalState, currentState)` returns a boolean for each individual cell in a neighborhood that determines whether to treat that cell as active for the purposes of matching the template in question. The default returns the cell's state &mdash; i.e., treats all non-zero cell states as active.

The template rulebuilder may in general be a bit more difficult to work with than the simple rulebuilder.

### Additional options

The resize modal (Ctrl+R) allows us to resize the model to a new size. Note that this effectively destroys the existing model and board and creates a wholly new one. Built-in settings and plugins will be copied over, but any more bespoke modifications may be lost. If the new order or radius is smaller than the current one, cells outside the new radius will simply be discarded. Conversely, if the new radius is larger, we of course keep all existing cells and insert blank ones around them.

#### Custom code

The custom code modal (Ctrl+F) allows us to execute arbitrary JavaScript code, or indeed upload raw JavaScript to be evaluated. This should probably only be used by users with a pretty solid grasp of JavaScript.

Custom code is evaluated with the global `Hexular` and `Board` made available. Every board instance (i.e., the currently displayed board) attaches the following attributes to the `Board` object:

- `Board.instance` - The board itself
- `Board.config` - Alias for `Board.instance.config`
- `Board.model` - Alias for `Board.instance.model`
- `Board.plugins` Alias for `Board.config.plugins`
- `Board.bgAdapter` - Alias for `Board.instance.bgAdapter`
- `Board.adapter` - Alias for `Board.instance.adapter`
- `Board.fgAdapter` - Alias for `Board.instance.fgAdapter`
- `Board.shared` - Alias for `Board.instance.shared`

Some built-in examples can be found in the "code snippets" dropdown. We can select e.g. "addRule" from the dropdown and modify it to add the following new rule:

        Board.config.addRule('fancyRule', (cell) => cell.count == 3 ? 1 : 0);

The same rule can be defined using a variation on the "binaryRuleFactory" example:

        Board.config.addRule('fancyRule', Util.binaryRuleFactory(3));

Binary rules are simple isotropic rules like that given in this example — for instance, the built-in "binary1" rule returns `1` if and only if the cell has one active neighbor, and `0` otherwise.

A variation on binary rules are symmetric rules, which can likewise be instantiated via the "symmetricRuleFactory" and associated example snippet:

        Board.config.addRule('symmetric26', Util.symmetricRuleFactory(2, 6));

Here, already-active cells are likewise sustained with an active neighbor count of 2 or 6. However, inactive cells are kept inactive by the *inverse* neighbor count relative to the current neighborhood, and activated otherwise. So in this case, under the default six-neighbor N6 neighborhood, inactive cells with 0 or 4 active neighbors are kept inactive, while all others are activated. In other words, this rule is equivalent to having a `binary12356` rule for state 0, and `binary26` for active states.

We can also add our own rule presets:

        Board.config.addPreset(
          'fancyPreset',
          new Preset(
            ['binary23', 'binary34', 'stepUp'],
            {filters: {deltaFilter: true, modFilter: true}}
          )
        )


We can define new snippets or overwrite existing ones with the "Save code snippet..." (plus sign) button.

As a practical matter it's usually easier to simply use your browser's dev console for anything this involved, but in cases where that isn't practical, the custom code modal offers a convenient and powerful alternative, as well as a mechanism for storing, importing, and exporting frequently-used blocks of code between sessions.

#### Board hooks

We can add callback functions to be run on the advent of particular events with the `board.addHook` method, e.g.:

        Board.instance.addHook('debugSelect', (cell) => console.log(cell.state));

The following hooks are currently supported

- incrementStep
- playStep
- autopauseStep
- step
- draw
- drawCell
- drawStep
- timer \*
- playStart
- playStop
- recordStop
- resize
- center
- select
- debugSelect \*\*
- debugStep \*\*
- drawFg
- clear
- paint \*\*
- updatePreset
- updateTheme

\* Requires trigger argument.

\*\* Callback function accepts one or more arguments &mdash; consult source code for details.

We can add functions to be called at a given time index during play or recording via the timer hook. For example, to turn cells with state 4 cyan after five seconds, we could run the following from the console or the custom code modal:

        Board.instance.addTrigger('timer', () => Board.config.setColor(3, '#33cccc'), 5000);

Timer hooks will be rerun at their appropriate time index after every stop/start event, but changes they make to e.g. the configuration object will persist until explicitly reset.

## More information

  - This program was originally inspired by Charlotte Dann's [Hexagonal Generative Art](http://codepen.io/pouretrebelle/post/hexagons), which incorporates CA-type rules along with more elaborate structural elements.

  - The initial implementation was modeled on David Siaw's similarly browser-based [Hexlife](https://github.com/davidsiaw/hexlife) program.

  - Despite my general expertise in this area, I continue to find Amit Patel's [Hexagonal Grids](http://www.redblobgames.com/grids/hexagons/) page to be an invaluable resource when dealing with hex grids, and much of the terminology I've used around cubic coordinates is taken from his distillation of the topic.

  - Many of the icons used in the Hexular Studio interface are taken from the [Material Design Icons](https://materialdesignicons.com/) project, and distributed under the Open Font License. The font itself was compiled using [Fontello](http://fontello.com/).

  - At the moment I am also using [jscolor](http://jscolor.com/), with some modifications, for theme color selectors.

  - For more information on HEXAGONAL AWARENESS, please check out:
    - [https://hexagon.link/](https://hexagon.link/)
    - [https://twitter.com/hexagonalnews](https://twitter.com/hexagonalnews)
    - [https://facebook.com/hexagons](https://facebook.com/hexagons)
    - [https://reddit.com/r/hexagons](https://reddit.com/r/hexagons)
    - [https://hexnet.org/](https://hexnet.org/)

  - Videos made with Hexular Studio can be found on our [YouTube channel](https://www.youtube.com/channel/UCf-ml0bmw7OJZHZCIB0cx3g).
